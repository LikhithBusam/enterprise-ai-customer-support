"""
Memory-augmented baseline.

Differences from memoryless.py:
- Before planning, the Planner retrieves top-3 similar entries from
  PlanSuccessMemory and injects their DAG templates into the planning prompt.
- The Critic/Replanner checks ToolFailureMemory for similar past failures
  before calling the LLM to replan.  If a matching fix_applied exists,
  it is applied directly without an LLM call.
- After every ticket:
    - EpisodicMemory is written (always).
    - PlanSuccessMemory is written on success.
    - ToolFailureMemory is written for each failed tool on failure.
- A single client_id='experiment_client' is used for the whole run so
  memory accumulates across tickets.
- BaselineResult gains a `memory_hit` field (bool): True if retrieved
  memory influenced planning or replanning for this ticket.
"""

from __future__ import annotations

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
from src.memory.client_store import ClientStoreRegistry, ClientStore
from src.memory.episodic import EpisodicMemory
from src.memory.plan_success import PlanSuccessMemory
from src.memory.tool_failure import ToolFailureMemory

from experiments import BaselineResult

load_dotenv()

logger = logging.getLogger(__name__)

import atexit

_DIAG_INJECTED = {"timeout": 0, "ambiguous_data": 0, "wrong_result": 0}
_DIAG_DETECTED = {"timeout": 0, "ambiguous_data": 0, "wrong_result": 0}
_DIAG_CLASSIFIED = {"timeout": 0, "ambiguous_data": 0, "wrong_result": 0}
_DIAG_IGNORED_WRONG_RESULT_EXAMPLE = None

def _print_diagnostics():
    if sum(_DIAG_INJECTED.values()) == 0:
        return
    print("\nInjected failures:")
    print(f"timeout: {_DIAG_INJECTED['timeout']}")
    print(f"ambiguous_data: {_DIAG_INJECTED['ambiguous_data']}")
    print(f"wrong_result: {_DIAG_INJECTED['wrong_result']}")
    print()
    print("Detected by _tool_has_bad_data():")
    print(f"timeout: {_DIAG_DETECTED['timeout']}")
    print(f"ambiguous_data: {_DIAG_DETECTED['ambiguous_data']}")
    print(f"wrong_result: {_DIAG_DETECTED['wrong_result']}")
    print()
    print("Sent to classifier:")
    print(f"timeout: {_DIAG_CLASSIFIED['timeout']}")
    print(f"ambiguous_data: {_DIAG_CLASSIFIED['ambiguous_data']}")
    print(f"wrong_result: {_DIAG_CLASSIFIED['wrong_result']}")
    print()
    if _DIAG_IGNORED_WRONG_RESULT_EXAMPLE:
        ex = _DIAG_IGNORED_WRONG_RESULT_EXAMPLE
        print("Ignored wrong_result example:")
        print(f"tool name: {ex['tool_name']}")
        print(f"request parameters: {ex['params']}")
        print(f"returned payload: {json.dumps(ex['data'])}")
        print(f"why _tool_has_bad_data() considered it valid: {ex['reason']}")

atexit.register(_print_diagnostics)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_ITERATIONS = 3
CLIENT_ID = "experiment_client"
MEMORY_HIT_DISTANCE_THRESHOLD = 1.65

_LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "nim")
_PROVIDER_RPM = {
    "nim": int(os.environ.get("NIM_RPM", "35")),
    "gemini": int(os.environ.get("GEMINI_RPM", "1500")),
}

_USE_LLM = os.environ.get("BASELINE_USE_LLM", "1") == "1"
LLM_CALL_TIMEOUT = float(os.environ.get("LLM_CALL_TIMEOUT", "30"))

_TOOL_LAYERS: dict[str, int] = {
    "crm": 0,
    "order_lookup": 1,
    "kb_search": 1,
    "refund": 2,
}

_DEPENDENCIES: dict[str, set[str]] = {
    "refund": {"order_lookup"},
}

# ---------------------------------------------------------------------------
# Rate limiter (identical to memoryless.py)
# ---------------------------------------------------------------------------


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

# ---------------------------------------------------------------------------
# LLM client helpers (identical to memoryless.py)
# ---------------------------------------------------------------------------


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
        except (openai.APITimeoutError, openai.APIConnectionError, openai.RateLimitError, openai.InternalServerError) as exc:
            if attempt == 0:
                if isinstance(exc, openai.RateLimitError):
                    logger.warning(
                        "LLM call rate limited: %s — sleeping 20s before retrying.", exc
                    )
                    time.sleep(20.0)
                elif isinstance(exc, openai.InternalServerError):
                    logger.warning(
                        "LLM call received 5xx server error: %s — sleeping 10s before retrying.", exc
                    )
                    time.sleep(10.0)
                else:
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


# ---------------------------------------------------------------------------
# Entity extraction & tool helpers (identical to memoryless.py)
# ---------------------------------------------------------------------------

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


# NOTE: We have removed the oracle dependency that checked entry.get("failure_type").
# Consequently, wrong_result detection is expected to degrade or drop to near-zero
# as mock tool wrong_payloads return syntactically valid but incorrect data that is
# undetectable without external context. This is a known, expected consequence of
# removing the oracle label leak and not a regression.
def _kb_score(query: str, article: dict[str, Any]) -> float:
    query_terms = {term for term in query.lower().split() if term}
    haystack = f"{article.get('title', '')} {article.get('snippet', '')} {' '.join(article.get('tags', []))}".lower()
    matches = sum(1 for term in query_terms if term in haystack)
    return matches / max(len(query_terms), 1)


def _tool_has_bad_data(entry: dict[str, Any]) -> bool:
    if not entry["success"]:
        return True
    data = entry.get("data") or {}
    tool = entry["tool_name"]
    params = entry.get("params") or {}

    # Check for parameter-payload mismatch / inconsistencies
    if tool == "crm":
        req_cid = params.get("customer_id")
        req_email = params.get("email")
        ret_cid = data.get("customer_id")
        ret_email = data.get("email")
        if req_cid and ret_cid and req_cid != ret_cid:
            return True
        if req_email and ret_email and req_email != ret_email:
            return True
            
        status = data.get("status", "")
        if status in ("not_found", "UNKNOWN"):
            return True
        cid = data.get("customer_id")
        if not cid or cid == "not_found":
            return True

    elif tool == "order_lookup":
        req_oid = params.get("order_id")
        ret_oid = data.get("order_id")
        if req_oid and ret_oid and req_oid != ret_oid:
            return True
            
        status = data.get("status", "")
        if status in ("not_found", "UNKNOWN"):
            return True
        oid = data.get("order_id")
        if not oid:
            return True

    elif tool == "refund":
        req_oid = params.get("order_id")
        req_amount = params.get("amount")
        ret_oid = data.get("order_id")
        ret_amount = data.get("amount")
        if req_oid and ret_oid and req_oid != ret_oid:
            return True
        if req_amount is not None and ret_amount is not None and abs(req_amount - ret_amount) > 0.01:
            return True

    elif tool == "kb_search":
        query = params.get("query", "")
        results = data.get("results") or []
        for r in results:
            actual_score = round(_kb_score(query, r), 2)
            if abs(r.get("relevance", 0.0) - actual_score) > 0.01:
                return True

    return False


# ---------------------------------------------------------------------------
# Fallback planner / critic (no LLM)
# ---------------------------------------------------------------------------


def _plan_fallback(pending_tools: set[str]) -> list[list[str]]:
    layers: list[list[str]] = []
    for layer_idx in sorted(set(_TOOL_LAYERS.get(t, 99) for t in pending_tools)):
        layer = sorted(t for t in pending_tools if _TOOL_LAYERS.get(t, 99) == layer_idx)
        if layer:
            layers.append(layer)
    return layers


def _critic_fallback(
    dag: list[list[str]],
    results: list[dict[str, Any]],
) -> tuple[bool, set[str]]:
    failed: set[str] = set()
    for entry in results:
        if _tool_has_bad_data(entry):
            failed.add(entry["tool_name"])
    return len(failed) == 0, failed


# ---------------------------------------------------------------------------
# Memory-augmented planner
# ---------------------------------------------------------------------------


def _plan_llm_memory(
    pending_tools: set[str],
    ticket_message: str,
    retrieved_plans: list[PlanSuccessMemory],
    failure_category: str | None = None,
    failed_tool: str | None = None,
) -> tuple[list[list[str]], bool]:
    """
    Like _plan_llm in memoryless, but injects retrieved DAG templates.
    Returns (dag, memory_hit) where memory_hit=True when retrieved_plans
    were non-empty and fed to the prompt.
    """
    tool_list = sorted(pending_tools)
    memory_hit = bool(retrieved_plans)

    memory_context = ""
    if retrieved_plans:
        templates = []
        for i, mem in enumerate(retrieved_plans, 1):
            templates.append(
                f"  [{i}] intent_cluster={mem.intent_cluster!r}, "
                f"success_rate={mem.success_rate:.2f}, "
                f"dag_template={json.dumps(mem.dag_template)}"
            )
        memory_context = (
            "Past successful DAG templates for similar tickets "
            "(use these as a starting point if relevant):\n"
            + "\n".join(templates)
            + "\n\n"
        )

    # Category-specific instructions
    category_instructions = ""
    if failure_category:
        if failure_category == "timeout":
            category_instructions = (
                f"ATTENTION: The tool '{failed_tool}' timed out multiple times or failed to connect.\n"
                f"You must replan using alternative tools if possible, or try a different approach.\n\n"
            )
        elif failure_category == "ambiguous_data":
            category_instructions = (
                f"ATTENTION: The tool '{failed_tool}' previously returned ambiguous data (e.g. status='UNKNOWN' or multiple matching records).\n"
                f"You must request clarification or try an alternate tool (e.g. searching the knowledge base or looking up different info in the CRM) to disambiguate.\n\n"
            )
        elif failure_category == "wrong_result":
            category_instructions = (
                f"ATTENTION: The tool '{failed_tool}' previously returned wrong result or no data (e.g. status='not_found').\n"
                f"You must discard that result and replan with a completely different approach (e.g. lookup order/customer via different parameters, or check KB first).\n\n"
            )

    user_prompt = (
        f"{memory_context}"
        f"{category_instructions}"
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
        dag = [[t for t in layer if t in pending_tools] for layer in dag]
        return dag, memory_hit
    except (ValueError, json.JSONDecodeError, TypeError):
        return _plan_fallback(pending_tools), memory_hit


def _plan(
    pending_tools: set[str],
    ticket_message: str,
    store: ClientStore,
    failure_category: str | None = None,
    failed_tool: str | None = None,
) -> tuple[list[list[str]], bool]:
    """
    Plan the next DAG layer.  Retrieves top-3 from PlanSuccessMemory and
    injects them into the LLM prompt.
    Returns (dag, memory_hit).
    """
    retrieved: list[PlanSuccessMemory] = []
    distances: list[float] = []
    if ticket_message:
        try:
            retrieved, distances = store.plan_success.retrieve(
                client_id=CLIENT_ID,
                query_text=ticket_message,
                top_k=3,
                return_distances=True,
            )
        except Exception:
            # Chroma raises if the collection has no documents yet.
            retrieved = []
            distances = []

    # memory_hit is True only if at least one retrieved entry's distance is below the threshold
    memory_hit = any(d < MEMORY_HIT_DISTANCE_THRESHOLD for d in distances) if distances else False

    if _USE_LLM and ticket_message:
        dag, _ = _plan_llm_memory(pending_tools, ticket_message, retrieved, failure_category, failed_tool)
        return dag, memory_hit

    # Fallback path: no LLM, but still report memory_hit correctly.
    return _plan_fallback(pending_tools), memory_hit


# ---------------------------------------------------------------------------
# Memory-augmented critic / replanner
# ---------------------------------------------------------------------------
# FREEZE WARNING: This subsystem (including _classify_failure, _tool_has_bad_data,
# critic replanning, and associated wrong_payload mock tool implementations)
# is frozen for experimental reproducibility. Do not modify these components
# unless a correctness bug is discovered.


def _classify_failure(entry: dict[str, Any]) -> str:
    """Classify the failure from observable symptoms only."""
    actual_fail_type = entry.get("failure_type")
    if actual_fail_type in _DIAG_CLASSIFIED:
        _DIAG_CLASSIFIED[actual_fail_type] += 1
    if not entry.get("success", False):
        error_msg = str(entry.get("error") or "").lower()
        if "timeout" in error_msg or "timed out" in error_msg or "time out" in error_msg:
            return "timeout"
        return "wrong_result"

    data = entry.get("data") or {}
    status = str(data.get("status") or "").upper()
    message = str(data.get("message") or data.get("note") or "").lower()

    # Check for ambiguous data patterns across all tools
    is_ambiguous = (
        status in ("UNKNOWN", "PENDING_REVIEW") or
        "multiple" in message or
        "unclear" in message or
        "incomplete" in message or
        data.get("open_tickets") == "unclear" or
        data.get("tier") == "unknown" or
        any(r.get("article_id") == "KB-???" for r in data.get("results") or [])
    )

    if is_ambiguous:
        return "ambiguous_data"
    
    # crm specific checks
    if entry.get("tool_name") == "crm":
        cid = data.get("customer_id")
        if not cid or cid == "not_found" or status == "NOT_FOUND":
            return "wrong_result"
            
    # order_lookup specific checks
    if entry.get("tool_name") == "order_lookup":
        oid = data.get("order_id")
        if not oid or status == "NOT_FOUND":
            return "wrong_result"

    return "wrong_result"


def _critic_llm_memory(
    dag: list[list[str]],
    results: list[dict[str, Any]],
    store: ClientStore,
    ticket_message: str,
) -> tuple[bool, set[str], bool, str, str]:
    """
    Critic with ToolFailureMemory lookup.

    Before calling the LLM, check whether any failed tool has a known
    fix_applied in memory.  If so, mark resolved=False but return the
    memory-derived failed-tool set directly (skipping the LLM replan call).

    Returns (resolved, failed_tools, memory_hit, predicted_category, actual_category).

    NOTE: We only use entry["success"] and _tool_has_bad_data() to determine
    failures — we never read entry["failure_type"] as an oracle label.
    """
    # Identify failed tools from observable facts only.
    quick_failed: set[str] = set()
    failed_entries: list[dict[str, Any]] = []
    for entry in results:
        if _tool_has_bad_data(entry):
            quick_failed.add(entry["tool_name"])
            failed_entries.append(entry)

    if not quick_failed:
        return True, set(), False, "", ""

    # Classify the first failed tool we find from observable symptoms
    failed_entry = sorted(failed_entries, key=lambda x: x["tool_name"])[0]
    predicted_cat = _classify_failure(failed_entry)
    actual_cat = failed_entry.get("failure_type") or ("api_error" if not failed_entry.get("success") else "bad_data")

    # Check ToolFailureMemory for any of the failed tools.
    memory_hit = False
    memory_fixes: dict[str, str] = {}  # tool_name -> fix_applied
    for tool_name in quick_failed:
        query = f"tool={tool_name} context={ticket_message[:200]}"
        try:
            hits: list[ToolFailureMemory] = store.tool_failure.retrieve(
                client_id=CLIENT_ID,
                query_text=query,
                top_k=1,
            )
        except Exception:
            hits = []

        for hit in hits:
            if hit.tool_name == tool_name and hit.fix_applied:
                memory_fixes[tool_name] = hit.fix_applied
                memory_hit = True
                break

    if memory_hit:
        # Apply fixes directly — skip LLM replan call.
        # fix_applied is a free-text hint ("retry", "skip", etc.).
        # We surface the failed tools back; the executor will re-plan.
        logger.info(
            "Memory hit in Critic for tools %s — applying stored fix without LLM replan.",
            list(memory_fixes.keys()),
        )
        return False, quick_failed, True, predicted_cat, actual_cat

    # No memory hit — fall through to LLM critic.
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
        return len(failed) == 0, failed, False, predicted_cat, actual_cat
    except (ValueError, json.JSONDecodeError, TypeError):
        ok, failed = _critic_fallback(dag, results)
        return ok, failed, False, predicted_cat, actual_cat


def _critic(
    dag: list[list[str]],
    results: list[dict[str, Any]],
    store: ClientStore,
    ticket_message: str,
) -> tuple[bool, set[str], bool, str, str]:
    """Returns (resolved, failed_tools, memory_hit, predicted_category, actual_category)."""
    if _USE_LLM:
        return _critic_llm_memory(dag, results, store, ticket_message)
    ok, failed = _critic_fallback(dag, results)
    
    predicted_cat = ""
    actual_cat = ""
    if not ok and failed:
        failed_entries = [e for e in results if e["tool_name"] in failed]
        if failed_entries:
            failed_entry = sorted(failed_entries, key=lambda x: x["tool_name"])[0]
            predicted_cat = _classify_failure(failed_entry)
            actual_cat = failed_entry.get("failure_type") or ("api_error" if not failed_entry.get("success") else "bad_data")
            
    return ok, failed, False, predicted_cat, actual_cat


# ---------------------------------------------------------------------------
# Resolution check & response builder (identical to memoryless.py)
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Memory write-back helpers
# ---------------------------------------------------------------------------


def _dag_to_dict(dag: list[list[str]]) -> dict:
    """Convert a DAG (list of layers) to a JSON-serialisable dict."""
    return {"layers": dag}


def _write_episodic(
    store: ClientStore,
    ticket: dict[str, Any],
    dag: list[list[str]],
    outcome: str,
) -> None:
    """Write an EpisodicMemory entry after ticket completion."""
    try:
        store.episodic.write(
            client_id=CLIENT_ID,
            entry=EpisodicMemory(
                ticket_id=ticket["ticket_id"],
                intent=ticket.get("intent_label", "unknown"),
                plan_dag=_dag_to_dict(dag),
                outcome=outcome,
            ),
        )
    except Exception as exc:
        logger.warning("Failed to write EpisodicMemory: %s", exc)


def _dag_is_valid(dag: list[list[str]], ticket: dict[str, Any]) -> bool:
    """
    Return True only if the DAG is a sound template worth storing.

    Checks:
    1. No layer is empty before the last non-empty layer (guards against
       plans like [[], [], ["refund"]] that skip upstream tools).
    2. For every tool, all of its _DEPENDENCIES entries appear in a
       strictly earlier layer — i.e. proper topological order is maintained.
    3. Every tool in the ticket's expected_tool_sequence that is present
       in the DAG satisfies rule 2.
    """
    # Strip trailing empty layers for the emptiness check.
    non_empty = [layer for layer in dag if layer]
    if not non_empty:
        return False  # nothing in the plan at all

    # Rule 1: no empty layer before the last non-empty one.
    last_non_empty_idx = max(i for i, layer in enumerate(dag) if layer)
    for i in range(last_non_empty_idx):
        if not dag[i]:
            logger.debug(
                "DAG rejected for PlanSuccessMemory: empty layer %d precedes tool in layer %d.",
                i, last_non_empty_idx,
            )
            return False

    # Build a layer-index map: tool_name -> layer index it appears in.
    tool_layer: dict[str, int] = {}
    for layer_idx, layer in enumerate(dag):
        for tool in layer:
            tool_layer[tool] = layer_idx

    # Rule 2: every tool's dependencies must be in a strictly earlier layer.
    for tool, deps in _DEPENDENCIES.items():
        if tool not in tool_layer:
            continue  # tool not in this plan — skip
        for dep in deps:
            if dep not in tool_layer:
                continue  # dep not in plan — ok (might have been skipped legitimately)
            if tool_layer[dep] >= tool_layer[tool]:
                logger.debug(
                    "DAG rejected for PlanSuccessMemory: '%s' (layer %d) must come "
                    "after its dependency '%s' (layer %d).",
                    tool, tool_layer[tool], dep, tool_layer[dep],
                )
                return False

    return True


def _write_plan_success(
    store: ClientStore,
    ticket: dict[str, Any],
    dag: list[list[str]],
) -> None:
    """Write a PlanSuccessMemory entry when a ticket resolves successfully.

    The DAG is validated against dependency-order rules before writing;
    malformed plans (e.g. empty upstream layers, out-of-order dependencies)
    are silently dropped to avoid poisoning the memory store.
    """
    if not _dag_is_valid(dag, ticket):
        logger.warning(
            "Skipping PlanSuccessMemory write for ticket %s: DAG failed dependency-order check. dag=%s",
            ticket.get("ticket_id", "?"), dag,
        )
        return
    try:
        store.plan_success.write(
            client_id=CLIENT_ID,
            entry=PlanSuccessMemory(
                intent_cluster=ticket.get("intent_label", "unknown"),
                dag_template=_dag_to_dict(dag),
                success_rate=1.0,
            ),
        )
    except Exception as exc:
        logger.warning("Failed to write PlanSuccessMemory: %s", exc)


def _write_tool_failures(
    store: ClientStore,
    tool_calls_made: list[dict[str, Any]],
    ticket_message: str,
    fix_hint: str = "retry",
) -> None:
    """Write a ToolFailureMemory entry for each failed/bad-data tool call."""
    for entry in tool_calls_made:
        if not _tool_has_bad_data(entry):
            continue
        try:
            store.tool_failure.write(
                client_id=CLIENT_ID,
                entry=ToolFailureMemory(
                    tool_name=entry["tool_name"],
                    # failure_type derived only from observable facts —
                    # never from the oracle ToolResult.failure_type field.
                    failure_type=(
                        "api_error" if not entry["success"]
                        else "bad_data"
                    ),
                    context=ticket_message[:300],
                    fix_applied=fix_hint,
                ),
            )
        except Exception as exc:
            logger.warning("Failed to write ToolFailureMemory: %s", exc)


# ---------------------------------------------------------------------------
# Extended result type
# ---------------------------------------------------------------------------


class MemoryAugmentedResult(BaselineResult):
    """BaselineResult extended with memory_hit and replanning_count fields."""
    memory_hit: bool = False
    replanning_count: int = 0
    predicted_category: str = ""
    actual_category: str = ""


# ---------------------------------------------------------------------------
# Main run function
# ---------------------------------------------------------------------------


def run(ticket: dict[str, Any], registry: ToolRegistry) -> MemoryAugmentedResult:
    """
    Run the memory-augmented baseline on a single ticket.

    Memory accumulates across calls via the shared CLIENT_ID backed by
    persistent Chroma.  Process tickets in order so earlier outcomes can
    inform later planning.
    """
    ticket_id = ticket["ticket_id"]
    expected_tools = set(ticket.get("expected_tool_sequence", []))
    ticket_message = ticket.get("customer_message", "")

    store: ClientStore = ClientStoreRegistry.get(CLIENT_ID)

    tool_calls_made: list[dict[str, Any]] = []
    context = _extract_context(ticket_message)
    context["customer_id"] = ticket["customer_id"]

    pending_tools = set(expected_tools)
    iteration_count = 0
    any_memory_hit = False
    replanning_count = 0
    last_dag: list[list[str]] = []

    # To keep track of failures and retries
    retried_tools: set[str] = set()
    last_failed_tool = None
    last_failure_category = None

    # We store the first predicted/actual category to log to MemoryAugmentedResult
    first_predicted_category = ""
    first_actual_category = ""

    for iteration in range(1, MAX_ITERATIONS + 1):
        iteration_count = iteration

        # Check if we should do a timeout retry
        if last_failure_category == "timeout" and last_failed_tool and last_failed_tool not in retried_tools:
            logger.info("Executing timeout retry for tool %s", last_failed_tool)
            retried_tools.add(last_failed_tool)
            dag = [[last_failed_tool]]
            plan_memory_hit = False
        else:
            # --- Planner (memory-augmented) ---
            dag, plan_memory_hit = _plan(
                pending_tools,
                ticket_message,
                store,
                failure_category=last_failure_category,
                failed_tool=last_failed_tool
            )
        
        last_dag = dag
        if plan_memory_hit:
            any_memory_hit = True

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
                    "error": result.error,
                    "iteration": iteration,
                }
                
                # Diagnostic tracking
                actual_fail_type = entry.get("failure_type")
                if actual_fail_type in _DIAG_INJECTED:
                    _DIAG_INJECTED[actual_fail_type] += 1
                    detected = _tool_has_bad_data(entry)
                    if detected:
                        _DIAG_DETECTED[actual_fail_type] += 1
                    else:
                        global _DIAG_IGNORED_WRONG_RESULT_EXAMPLE
                        if actual_fail_type == "wrong_result" and _DIAG_IGNORED_WRONG_RESULT_EXAMPLE is None:
                            reason_parts = []
                            if entry.get("success"):
                                reason_parts.append("success is True")
                            data = entry.get("data") or {}
                            tool = entry["tool_name"]
                            if tool in ("crm", "order_lookup"):
                                reason_parts.append(f"status is {data.get('status')!r}")
                            if tool == "crm":
                                reason_parts.append(f"customer_id is {data.get('customer_id')!r}")
                            if tool == "order_lookup":
                                reason_parts.append(f"order_id is {data.get('order_id')!r}")
                            _DIAG_IGNORED_WRONG_RESULT_EXAMPLE = {
                                "tool_name": tool,
                                "params": entry.get("params"),
                                "data": entry.get("data"),
                                "reason": " and ".join(reason_parts) or "no anomaly detected by tool-specific rules"
                            }
                
                layer_results.append(entry)
                context.update(_update_context(tool_name, result))

            tool_calls_made.extend(layer_results)
            iteration_results.extend(layer_results)

        # --- Critic (memory-augmented) ---
        resolved, failed, critic_memory_hit, predicted_cat, actual_cat = _critic(
            dag, iteration_results, store, ticket_message
        )
        if critic_memory_hit:
            any_memory_hit = True

        if not resolved:
            # Log the categories on the very first failure we encounter
            if not first_predicted_category:
                first_predicted_category = predicted_cat
                first_actual_category = actual_cat

            for entry in iteration_results:
                if entry["tool_name"] in failed:
                    entry["predicted_category"] = predicted_cat
                    entry["actual_category"] = entry.get("failure_type") or ("api_error" if not entry.get("success") else "bad_data")

            replanning_count += 1
            last_failed_tool = sorted(failed)[0] if failed else None
            last_failure_category = predicted_cat

            pending_tools = failed | (
                pending_tools - {e["tool_name"] for e in iteration_results if e["success"]}
            )
        else:
            last_failed_tool = None
            last_failure_category = None
            pending_tools.difference_update(
                {e["tool_name"] for e in iteration_results if e["success"]}
            )

        if not pending_tools:
            properly_resolved = _check_resolved(ticket, tool_calls_made)
            outcome = "success" if properly_resolved else "partial_failure"

            # --- Memory write-back ---
            _write_episodic(store, ticket, last_dag, outcome)
            if properly_resolved:
                _write_plan_success(store, ticket, last_dag)
            else:
                _write_tool_failures(store, tool_calls_made, ticket_message)

            return MemoryAugmentedResult(
                ticket_id=ticket_id,
                resolved=properly_resolved,
                steps_taken=iteration_count,
                tool_calls_made=list(tool_calls_made),
                final_response=_build_response(ticket_message, tool_calls_made, properly_resolved),
                memory_hit=any_memory_hit,
                replanning_count=replanning_count,
                predicted_category=first_predicted_category,
                actual_category=first_actual_category,
            )

    # --- Max iterations reached ---
    properly_resolved = _check_resolved(ticket, tool_calls_made)
    outcome = "success" if properly_resolved else "failure"

    _write_episodic(store, ticket, last_dag, outcome)
    if properly_resolved:
        _write_plan_success(store, ticket, last_dag)
    else:
        _write_tool_failures(store, tool_calls_made, ticket_message)

    return MemoryAugmentedResult(
        ticket_id=ticket_id,
        resolved=properly_resolved,
        steps_taken=iteration_count,
        tool_calls_made=list(tool_calls_made),
        final_response=_build_response(ticket_message, tool_calls_made, properly_resolved),
        memory_hit=any_memory_hit,
        replanning_count=replanning_count,
        predicted_category=first_predicted_category,
        actual_category=first_actual_category,
    )
