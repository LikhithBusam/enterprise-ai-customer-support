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

MAX_STEPS = 10

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

_USE_LLM = os.environ.get("BASELINE_USE_LLM", "1") == "1"
LLM_CALL_TIMEOUT = float(os.environ.get("LLM_CALL_TIMEOUT", "30"))

_DEPENDENCIES: dict[str, set[str]] = {
    "refund": {"order_lookup"},
}


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


def _extract_context(message: str) -> dict[str, Any]:
    context: dict[str, Any] = {}
    order_match = re.search(r"(ORD-\d+)", message, re.IGNORECASE)
    if order_match:
        context["order_id"] = order_match.group(1).upper()
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


def _next_tool_fallback(
    expected_tools: list[str],
    tool_calls_made: list[dict[str, Any]],
) -> str | None:
    # A tool is "resolved" only when it has a successful call with clean data.
    resolved = {c["tool_name"] for c in tool_calls_made if c["success"] and not _tool_has_bad_data(c)}
    failed_and_retried = {
        c["tool_name"] for c in tool_calls_made
        if not c["success"] and c.get("retried")
    }

    for tool in expected_tools:
        if tool in resolved:
            continue
        if tool in failed_and_retried:
            continue
        return tool
    return None


def _next_tool_llm(
    expected_tools: list[str],
    tool_calls_made: list[dict[str, Any]],
    ticket_message: str,
) -> str | None:
    # Compute which tools are genuinely resolved (success + clean data).
    resolved = {c["tool_name"] for c in tool_calls_made if c["success"] and not _tool_has_bad_data(c)}
    remaining = [t for t in expected_tools if t not in resolved]
    if not remaining:
        return None

    user_prompt = (
        f"Tools still needed (call one of these): {remaining}\n"
        f"Already resolved tools (do NOT call again): {sorted(resolved)}\n"
        f"Recent calls: {json.dumps(tool_calls_made[-6:], default=str)}\n"
        f"Customer message: {ticket_message}\n\n"
        "Return a JSON object with:\n"
        '- "next_tool": ONE tool name from the \'still needed\' list, or null if all done\n'
        '- "reason": brief explanation\n'
        "Return ONLY the JSON object."
    )
    content = _call_llm("PLANNER_MODEL", [
        {"role": "system", "content": "You are a tool selector. Output only valid JSON."},
        {"role": "user", "content": user_prompt},
    ])
    try:
        start = content.index("{")
        end = content.rindex("}") + 1
        parsed = json.loads(content[start:end])
        next_tool = parsed.get("next_tool")
        # Reject if LLM suggests a tool not in remaining
        if next_tool and next_tool in remaining:
            return next_tool
        return _next_tool_fallback(expected_tools, tool_calls_made)
    except (ValueError, json.JSONDecodeError, TypeError):
        return _next_tool_fallback(expected_tools, tool_calls_made)


def _next_tool(
    expected_tools: list[str],
    tool_calls_made: list[dict[str, Any]],
    ticket_message: str = "",
) -> str | None:
    if _USE_LLM and ticket_message:
        return _next_tool_llm(expected_tools, tool_calls_made, ticket_message)
    return _next_tool_fallback(expected_tools, tool_calls_made)


def _critic_fallback(
    results: list[dict[str, Any]],
) -> tuple[bool, list[str]]:
    tools_needing_retry: list[str] = []
    for entry in results:
        if not entry["success"]:
            prev_failures = [c for c in results if c["tool_name"] == entry["tool_name"] and not c["success"]]
            if len(prev_failures) <= 1:
                tools_needing_retry.append(entry["tool_name"])
    all_success = all(entry["success"] for entry in results)
    return all_success, tools_needing_retry


def _critic_llm(
    results: list[dict[str, Any]],
) -> tuple[bool, list[str]]:
    user_prompt = (
        f"Tool execution results: {json.dumps(results, default=str)}\n\n"
        "Return a JSON object with:\n"
        '- "all_resolved": true if all tools succeeded\n'
        '- "retry_tools": list of tool names that failed and should be retried (not ones already retried)\n'
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
        resolved = parsed.get("all_resolved", False)
        retry_tools = parsed.get("retry_tools", [])
        return resolved, list(retry_tools)
    except (ValueError, json.JSONDecodeError, TypeError):
        return _critic_fallback(results)


def _critic(
    results: list[dict[str, Any]],
) -> tuple[bool, list[str]]:
    if _USE_LLM:
        return _critic_llm(results)
    return _critic_fallback(results)


def _build_response(message: str, tool_calls_made: list[dict[str, Any]], resolved: bool) -> str:
    if resolved:
        calls = [c["tool_name"] for c in tool_calls_made if c["success"]]
        return (
            f"Resolved. Used: {', '.join(calls)}. "
            f"Reference: {message[:80]}{'...' if len(message) > 80 else ''}"
        )
    failures = [c["tool_name"] for c in tool_calls_made if not c["success"]]
    return (
        f"Unable to fully resolve. {len(failures)} tool(s) failed: {', '.join(failures)}. "
        f"Please contact support with ticket details."
    )


def run(ticket: dict[str, Any], registry: ToolRegistry) -> BaselineResult:
    ticket_id = ticket["ticket_id"]
    message = ticket["customer_message"]
    expected_tools = list(ticket.get("expected_tool_sequence", []))

    tool_calls_made: list[dict[str, Any]] = []
    context = _extract_context(message)
    context["customer_id"] = ticket["customer_id"]

    for step in range(1, MAX_STEPS + 1):
        next_tool = _next_tool(expected_tools, tool_calls_made, message)

        if next_tool is None:
            all_ok = all(
                any(c["tool_name"] == t and c["success"] and not _tool_has_bad_data(c) for c in tool_calls_made)
                for t in expected_tools
            )
            return BaselineResult(
                ticket_id=ticket_id,
                resolved=all_ok,
                steps_taken=step,
                tool_calls_made=list(tool_calls_made),
                final_response=_build_response(message, tool_calls_made, all_ok),
            )

        deps = _DEPENDENCIES.get(next_tool, set())
        dep_failed = False
        for dep in deps:
            dep_calls = [e for e in tool_calls_made if e["tool_name"] == dep]
            dep_ok = any(e["success"] and not _tool_has_bad_data(e) for e in dep_calls)
            if not dep_ok:
                dep_failed = True
                break
        if dep_failed:
            return BaselineResult(
                ticket_id=ticket_id,
                resolved=False,
                steps_taken=step,
                tool_calls_made=list(tool_calls_made),
                final_response=_build_response(message, tool_calls_made, False),
            )

        params = _prepare_params(next_tool, context, ticket)

        # --- Deduplication guard ---
        # If this exact call (tool + same params) already succeeded with clean data,
        # the LLM is stuck in a loop — skip dispatch silently and move to next step.
        _already_resolved = any(
            e["tool_name"] == next_tool
            and e["success"]
            and not _tool_has_bad_data(e)
            and e.get("params") == params
            for e in tool_calls_made
        )
        if _already_resolved:
            logger.debug(
                "Skipping redundant %s call — already resolved with same params %s.",
                next_tool, params,
            )
            continue

        result = registry.dispatch(next_tool, params)

        entry: dict[str, Any] = {
            "tool_name": next_tool,
            "params": dict(params),
            "success": result.success,
            "failure_type": result.failure_type,
            "data": result.data,
        }

        if not result.success:
            prev_failures = [c for c in tool_calls_made if c["tool_name"] == next_tool and not c["success"]]
            entry["retried"] = len(prev_failures) > 0

        tool_calls_made.append(entry)
        context.update(_update_context(next_tool, result))

        if not result.success:
            resolved, _retry_tools = _critic([entry])
            if not resolved:
                already_retried = next((
                    c for c in tool_calls_made
                    if c["tool_name"] == next_tool and not c["success"] and c.get("retried")
                ), None)
                if already_retried:
                    return BaselineResult(
                        ticket_id=ticket_id,
                        resolved=False,
                        steps_taken=step,
                        tool_calls_made=list(tool_calls_made),
                        final_response=_build_response(message, tool_calls_made, False),
                    )

    return BaselineResult(
        ticket_id=ticket_id,
        resolved=False,
        steps_taken=MAX_STEPS,
        tool_calls_made=list(tool_calls_made),
        final_response=_build_response(message, tool_calls_made, False),
    )
