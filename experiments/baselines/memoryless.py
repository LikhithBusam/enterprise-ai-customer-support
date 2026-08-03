import functools
import json
import logging
import os
import re
import threading
import time
from typing import Any

from dotenv import load_dotenv
import openai
from openai import OpenAI

from src.tools.registry import ToolRegistry

from experiments import BaselineResult

load_dotenv()

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 3

_LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "nim")
_PROVIDER_RPM = {
    "nim": int(os.environ.get("NIM_RPM", "35")),
    "gemini": int(os.environ.get("GEMINI_RPM", "1500")),
}


class _SlidingWindowRateLimiter:
    """Proactive rate limiter: at most max_calls per rolling window_seconds."""

    def __init__(self, max_calls: int = 35, window_seconds: float = 60.0):
        self.max_calls = max_calls
        self.window_seconds = window_seconds
        self._lock = threading.Lock()
        self._timestamps: list[float] = []

    def acquire(self) -> None:
        """Block until a call slot is available."""
        with self._lock:
            now = time.monotonic()
            cutoff = now - self.window_seconds
            self._timestamps[:] = [t for t in self._timestamps if t > cutoff]

            if len(self._timestamps) < self.max_calls:
                self._timestamps.append(now)
                return

            oldest = self._timestamps.pop(0)
            sleep_for = oldest + self.window_seconds - now + 0.05
            logger.warning(
                "Rate limit reached (%d calls in last %.0fs). "
                "Throttling %.1fs before next call.",
                self.max_calls, self.window_seconds, sleep_for,
            )
            time.sleep(sleep_for)
            self._timestamps.append(time.monotonic())


_llm_rate_limiter = _SlidingWindowRateLimiter(
    max_calls=_PROVIDER_RPM.get(_LLM_PROVIDER, 35),
)

_TOOL_LAYERS: dict[str, int] = {
    "crm": 0,
    "order_lookup": 1,
    "kb_search": 1,
    "refund": 2,
}

_DEPENDENCIES: dict[str, set[str]] = {
    "refund": {"order_lookup"},
}

_USE_LLM = os.environ.get("BASELINE_USE_LLM", "1") == "1"
LLM_CALL_TIMEOUT = float(os.environ.get("LLM_CALL_TIMEOUT", "30"))


@functools.lru_cache(maxsize=1)
def _get_client() -> OpenAI:
    if _LLM_PROVIDER == "gemini":
        return OpenAI(
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            api_key=os.environ["GEMINI_API_KEY"],
            timeout=LLM_CALL_TIMEOUT,
        )
    return OpenAI(
        base_url=os.environ["NVIDIA_BASE_URL"],
        api_key=os.environ["NVIDIA_API_KEY"],
        timeout=LLM_CALL_TIMEOUT,
    )


def _call_llm(model_env_key: str, messages: list[dict]) -> str:
    """Call the LLM with a single retry on timeout or connection error."""
    model = "gemini-2.5-flash" if _LLM_PROVIDER == "gemini" else os.environ[model_env_key]
    client = _get_client()

    for attempt in range(2):
        _llm_rate_limiter.acquire()
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.0,
            )
            return resp.choices[0].message.content or ""
        except (openai.APITimeoutError, openai.APIConnectionError) as exc:
            if attempt == 0:
                logger.warning(
                    "LLM call timed out / connection error (attempt %d/%d): %s — retrying once.",
                    attempt + 1, 2, exc,
                )
            else:
                logger.error(
                    "LLM call failed after 2 attempts: %s — giving up.", exc
                )
                raise
    raise RuntimeError("unreachable")


_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def _extract_context(message: str) -> dict[str, Any]:
    context: dict[str, Any] = {}
    order_match = re.search(r"(ORD-\d+)", message, re.IGNORECASE)
    if order_match:
        context["order_id"] = order_match.group(1).upper()
    email_match = _EMAIL_RE.search(message)
    if email_match:
        context["email"] = email_match.group(0)
    amount_match = re.search(r"\$(\d+\.?\d*)", message)
    if amount_match:
        try:
            context["amount"] = float(amount_match.group(1))
        except ValueError:
            pass
    return context


def _prepare_params(tool_name: str, context: dict[str, Any], ticket: dict[str, Any]) -> dict[str, Any]:
    if tool_name == "crm":
        return {
            "customer_id": context.get("customer_id"),
            "email": context.get("email"),
        }
    if tool_name == "order_lookup":
        return {
            "order_id": context.get("order_id", ""),
        }
    if tool_name == "refund":
        raw_amount = context.get("amount")
        amount = float(raw_amount) if raw_amount is not None else 0.0
        return {
            "order_id": context.get("order_id", ""),
            "amount": amount,
            "reason": f"customer request: {ticket.get('intent_label', 'unknown')}",
        }
    if tool_name == "kb_search":
        return {
            "query": ticket.get("customer_message", ""),
            "top_k": 3,
        }
    return {}


def _update_context(tool_name: str, result: Any) -> dict[str, Any]:
    if not result.success or not result.data:
        return {}
    data = result.data
    updated: dict[str, Any] = {}
    if tool_name == "crm":
        if (data.get("customer_id")
                and data["customer_id"] != "not_found"
                and data.get("status") not in ("not_found", "UNKNOWN")):
            updated["customer_id"] = data["customer_id"]
            updated["email"] = data.get("email", "")
    if tool_name == "order_lookup":
        if data.get("order_id"):
            updated["order_id"] = data["order_id"]
            raw = data.get("total_amount")
            if raw is not None:
                try:
                    updated["amount"] = float(raw)
                except (ValueError, TypeError):
                    pass
    return updated


def _plan_fallback(pending_tools: set[str]) -> list[list[str]]:
    layers: list[list[str]] = []
    used: set[str] = set()

    for layer_idx in sorted(set(_TOOL_LAYERS.get(t, 99) for t in pending_tools)):
        layer = sorted(t for t in pending_tools if _TOOL_LAYERS.get(t, 99) == layer_idx)
        if layer:
            layers.append(layer)
            used.update(layer)

    return layers


def _plan_llm(pending_tools: set[str], ticket_message: str) -> list[list[str]]:
    tool_list = sorted(pending_tools)
    user_prompt = (
        f"Available tools: {tool_list}\n"
        f"Customer message: {ticket_message}\n\n"
        "Return a JSON array of arrays (list of layers). "
        "Each inner array is a set of tools that can run in parallel.\n"
        "Rules:\n"
        "- crm before order_lookup before refund\n"
        "- kb_search is independent\n"
        "Return ONLY the JSON array."
    )
    content = _call_llm("PLANNER_MODEL", [
        {"role": "system", "content": "You are a tool planner. Output only valid JSON."},
        {"role": "user", "content": user_prompt},
    ])
    try:
        start = content.index("[")
        end = content.rindex("]") + 1
        dag = json.loads(content[start:end])
        return [[t for t in layer if t in pending_tools] for layer in dag]
    except (ValueError, json.JSONDecodeError, TypeError):
        return _plan_fallback(pending_tools)


def _plan(pending_tools: set[str], ticket_message: str = "") -> list[list[str]]:
    if _USE_LLM and ticket_message:
        return _plan_llm(pending_tools, ticket_message)
    return _plan_fallback(pending_tools)


def _tool_has_bad_data(entry: dict[str, Any]) -> bool:
    if not entry["success"]:
        return True
    if entry.get("failure_type") is not None:
        return True
    data = entry.get("data") or {}
    tool = entry["tool_name"]
    if tool in ("crm", "order_lookup"):
        status = data.get("status", "")
        if status in ("not_found", "UNKNOWN"):
            return True
    if tool == "crm":
        cid = data.get("customer_id")
        if not cid or cid == "not_found":
            return True
    if tool == "order_lookup":
        oid = data.get("order_id")
        if not oid:
            return True
        status = data.get("status", "")
        if status in ("not_found", "UNKNOWN"):
            return True
    return False


def _critic_fallback(
    dag: list[list[str]],
    results: list[dict[str, Any]],
) -> tuple[bool, set[str]]:
    failed: set[str] = set()
    for entry in results:
        if _tool_has_bad_data(entry):
            failed.add(entry["tool_name"])
    return len(failed) == 0, failed


def _critic_llm(
    dag: list[list[str]],
    results: list[dict[str, Any]],
) -> tuple[bool, set[str]]:
    user_prompt = (
        f"DAG: {json.dumps(dag)}\n"
        f"Results: {json.dumps(results, default=str)}\n\n"
        "Return a JSON object with:\n"
        '- "resolved": true only if every tool returned valid data '
        '(no not_found, no UNKNOWN status, no failure_type, '
        'all required entity lookups found the record)\n'
        '- "failed_tools": list of failed tool names\n'
        "Return ONLY the JSON object."
    )
    content = _call_llm("CRITIC_MODEL", [
        {"role": "system", "content": "You are a tool-call critic. Output only valid JSON."},
        {"role": "user", "content": user_prompt},
    ])
    try:
        start = content.index("{")
        end = content.rindex("}") + 1
        parsed = json.loads(content[start:end])
        failed = set(parsed.get("failed_tools", []))
        return len(failed) == 0, failed
    except (ValueError, json.JSONDecodeError, TypeError):
        return _critic_fallback(dag, results)


def _critic(
    dag: list[list[str]],
    results: list[dict[str, Any]],
) -> tuple[bool, set[str]]:
    if _USE_LLM:
        return _critic_llm(dag, results)
    return _critic_fallback(dag, results)


def _check_resolved(
    ticket: dict[str, Any],
    tool_calls_made: list[dict[str, Any]],
) -> bool:
    expected_tools = ticket.get("expected_tool_sequence", [])
    called_tools = {c["tool_name"] for c in tool_calls_made}

    for tool in expected_tools:
        if tool not in called_tools:
            return False
        calls_for_tool = [c for c in tool_calls_made if c["tool_name"] == tool]
        if not any(c["success"] and not _tool_has_bad_data(c) for c in calls_for_tool):
            return False

    return True


def _build_response(message: str, tool_calls_made: list[dict[str, Any]], resolved: bool) -> str:
    if resolved:
        calls = [c["tool_name"] for c in tool_calls_made if c["success"]]
        return (
            f"Resolved via DAG plan. Used: {', '.join(calls)}. "
            f"Reference: {message[:80]}{'...' if len(message) > 80 else ''}"
        )
    failures = [c["tool_name"] for c in tool_calls_made if not c["success"]]
    bad_data = [
        c["tool_name"] for c in tool_calls_made
        if c["success"] and _tool_has_bad_data(c)
    ]
    details = []
    if failures:
        details.append(f"{len(failures)} tool(s) failed: {', '.join(failures)}")
    if bad_data:
        details.append(f"{len(bad_data)} tool(s) returned bad data: {', '.join(bad_data)}")
    return (
        f"Unable to fully resolve after replanning. "
        f"{'; '.join(details)}. "
        f"Escalating to human agent."
    )


def run(ticket: dict[str, Any], registry: ToolRegistry) -> BaselineResult:
    ticket_id = ticket["ticket_id"]
    expected_tools = set(ticket.get("expected_tool_sequence", []))

    tool_calls_made: list[dict[str, Any]] = []
    context = _extract_context(ticket["customer_message"])
    context["customer_id"] = ticket["customer_id"]

    pending_tools = set(expected_tools)
    iteration_count = 0

    for iteration in range(1, MAX_ITERATIONS + 1):
        iteration_count = iteration
        dag = _plan(pending_tools, ticket.get("customer_message", ""))

        iteration_results: list[dict[str, Any]] = []

        for layer in dag:
            layer_results: list[dict[str, Any]] = []
            for tool_name in layer:
                deps = _DEPENDENCIES.get(tool_name, set())
                dep_failed = False
                for dep in deps:
                    dep_calls = [e for e in tool_calls_made if e["tool_name"] == dep]
                    dep_ok = any(e["success"] and not _tool_has_bad_data(e) for e in dep_calls)
                    if not dep_ok:
                        dep_failed = True
                        break
                if dep_failed:
                    continue

                params = _prepare_params(tool_name, context, ticket)
                result = registry.dispatch(tool_name, params)

                entry: dict[str, Any] = {
                    "tool_name": tool_name,
                    "params": dict(params),
                    "success": result.success,
                    "failure_type": result.failure_type,
                    "data": result.data,
                    "iteration": iteration,
                }
                layer_results.append(entry)
                context.update(_update_context(tool_name, result))

            tool_calls_made.extend(layer_results)
            iteration_results.extend(layer_results)

        resolved, failed = _critic(dag, iteration_results)
        if not resolved:
            pending_tools = failed | (pending_tools - {e["tool_name"] for e in iteration_results if e["success"]})
        else:
            pending_tools.difference_update({e["tool_name"] for e in iteration_results if e["success"]})

        if not pending_tools:
            properly_resolved = _check_resolved(ticket, tool_calls_made)
            return BaselineResult(
                ticket_id=ticket_id,
                resolved=properly_resolved,
                steps_taken=iteration_count,
                tool_calls_made=list(tool_calls_made),
                final_response=_build_response(
                    ticket["customer_message"], tool_calls_made, properly_resolved
                ),
            )

    properly_resolved = _check_resolved(ticket, tool_calls_made)
    return BaselineResult(
        ticket_id=ticket_id,
        resolved=properly_resolved,
        steps_taken=iteration_count,
        tool_calls_made=list(tool_calls_made),
        final_response=_build_response(
            ticket["customer_message"], tool_calls_made, properly_resolved
        ),
    )
