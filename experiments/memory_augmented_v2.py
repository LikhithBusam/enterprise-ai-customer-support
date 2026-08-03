"""
Memory-augmented v2 baseline with:
- Failure-category-conditioned Critic (redesign item 1)
- Template-abstracted memory write (redesign item 2)
- Tool reliability scoring (novel contribution)
- Policy Memory (Contribution 2, Policy_Memory_Implementation_Plan.md) — gated by
  ENABLE_POLICY_MEMORY, see the "Policy Memory (Contribution 2)" section below
"""

from __future__ import annotations

import functools
import json
import logging
import os
import re
import threading
import time
from pathlib import Path
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
from experiments.context_fusion import PlanningContext, fuse_context
from memory.policy_store import (
    MAX_CREATED_FROM,
    get_policy,
    make_policy_id,
    running_average,
    upsert_policy,
    utcnow,
)
from memory.policy_memory import PolicyMemory

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_ITERATIONS = 3
CLIENT_ID = "experiment_client"

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

# Feature flags for ablation study (can be overridden via env vars)
def _enable_conditioned_critic() -> bool:
    return os.environ.get("ENABLE_CONDITIONED_CRITIC", "1") == "1"

def _enable_template_abstraction() -> bool:
    return os.environ.get("ENABLE_TEMPLATE_ABSTRACTION", "1") == "1"

def _enable_reliability_scoring() -> bool:
    return os.environ.get("ENABLE_RELIABILITY_SCORING", "1") == "1"

def _enable_policy_memory() -> bool:
    """Contribution 2 (Policy_Memory_Implementation_Plan.md). Off by default so existing
    baselines (v2_critic_only/v2_template_only/v2_full) keep their current PlanSuccessMemory-only
    retrieval behavior unchanged unless explicitly turned on — see scripts/run_experiment.py's
    "policy_memory" baseline entry.
    """
    return os.environ.get("ENABLE_POLICY_MEMORY", "0") == "1"

# ---------------------------------------------------------------------------
# Rate limiter
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
# LLM client helpers
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


def _load_prompt(filename: str) -> str:
    path = Path(__file__).resolve().parent.parent / "src" / "prompts" / filename
    with open(path) as f:
        return f.read().strip()


# ---------------------------------------------------------------------------
# Entity extraction & tool helpers
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


def _abstract_dag_template(ticket_message: str) -> str:
    """Strip ticket-specific values (order IDs, customer IDs, emails, amounts) from the message text."""
    # Strip order IDs: ORD-XXXX
    msg = re.sub(r"ORD-\d+", "{order_id}", ticket_message, flags=re.IGNORECASE)
    # Strip customer IDs: CUST-XXXX
    msg = re.sub(r"CUST-\d+", "{customer_id}", msg, flags=re.IGNORECASE)
    # Strip email addresses
    msg = _EMAIL_RE.sub("{email}", msg)
    # Strip dollar amounts: e.g. $89.00 or $54
    msg = re.sub(r"\$\d+(?:\.\d+)?", "{amount}", msg)
    return msg


def _compute_tool_reliability(store: ClientStore, tool_name: str) -> float:
    """Compute running reliability score from ToolFailureMemory for this tool."""
    try:
        failures: list[ToolFailureMemory] = store.tool_failure.retrieve(
            client_id=CLIENT_ID,
            query_text=f"tool={tool_name}",
            top_k=20,
        )
        failure_count = sum(1 for f in failures if f.tool_name == tool_name)
    except Exception:
        failure_count = 0

    if failure_count == 0:
        return 1.0
    return max(0.1, 1.0 - (failure_count * 0.05))


def _plan_llm_memory(
    pending_tools: set[str],
    ticket_message: str,
    retrieved_plans: list[PlanSuccessMemory],
    store: ClientStore,
) -> tuple[list[list[str]], bool]:
    """Like _plan_llm in memoryless, but injects retrieved DAG templates and reliability scores."""
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

    reliability_context = ""
    if _enable_reliability_scoring():
        scores = {}
        for tool in pending_tools:
            scores[tool] = _compute_tool_reliability(store, tool)

        scores_str = "\n".join(f"  - {tool}: {scores[tool]:.2f}" for tool in pending_tools)
        reliability_context = (
            "Recent tool reliability scores (1.00 = perfect, lower = more frequent failures):\n"
            f"{scores_str}\n"
            "Consider these reliability scores when planning. Prefer reliable tools early and plan alternative paths for less reliable ones.\n\n"
        )

    user_prompt = (
        f"{memory_context}"
        f"{reliability_context}"
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


def _plan_llm_policy(
    pending_tools: set[str],
    ticket_message: str,
    context: PlanningContext,
    store: ClientStore,
) -> tuple[list[list[str]], bool]:
    """Policy Memory (Contribution 2) planning path — same shape as _plan_llm_memory, but the
    injected memory context comes from Context Fusion (top-3 Policy + top-2 Failure + top-3
    Episodic) instead of bare PlanSuccessMemory templates. This swap is the entire controlled
    variable for testing "does policy-based memory generalize better than ticket-based memory":
    everything else (Critic, reliability scoring, dependency gating) stays identical to v2_full.
    """
    tool_list = sorted(pending_tools)
    memory_hit = context.has_any_hit

    memory_context = context.to_prompt_text()

    reliability_context = ""
    if _enable_reliability_scoring():
        scores = {tool: _compute_tool_reliability(store, tool) for tool in pending_tools}
        scores_str = "\n".join(f"  - {tool}: {scores[tool]:.2f}" for tool in pending_tools)
        reliability_context = (
            "Recent tool reliability scores (1.00 = perfect, lower = more frequent failures):\n"
            f"{scores_str}\n"
            "Consider these reliability scores when planning. Prefer reliable tools early and "
            "plan alternative paths for less reliable ones.\n\n"
        )

    user_prompt = (
        f"{memory_context}"
        f"{reliability_context}"
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
) -> tuple[list[list[str]], bool, float | None, bool, str | None, int | None]:
    """Plan the next DAG layer.

    Returns (dag, memory_hit, retrieval_distance, policy_hit, policy_id_used,
    policy_usage_count_at_use). The last three are always present (defaulting to
    False/None/None) regardless of which ablation is active, so callers don't need to branch on
    _enable_policy_memory() themselves.
    """
    query_text = ticket_message
    if _enable_template_abstraction():
        query_text = _abstract_dag_template(ticket_message)

    if _enable_policy_memory():
        context = fuse_context(CLIENT_ID, query_text, store) if ticket_message else PlanningContext()
        policy_hit = bool(context.policies)
        policy_id_used = context.policies[0].policy_id if context.policies else None
        policy_usage_count = context.policies[0].usage_count if context.policies else None
        retrieval_distance = context.policy_distances[0] if context.policy_distances else None

        if _USE_LLM and ticket_message:
            dag, mem_hit = _plan_llm_policy(pending_tools, ticket_message, context, store)
        else:
            dag, mem_hit = _plan_fallback(pending_tools), context.has_any_hit

        return dag, mem_hit, retrieval_distance, policy_hit, policy_id_used, policy_usage_count

    retrieved: list[PlanSuccessMemory] = []
    distances: list[float] = []

    if ticket_message:
        try:
            # We use retrieve with return_distances = True
            retrieved, distances = store.plan_success.retrieve(
                client_id=CLIENT_ID,
                query_text=query_text,
                top_k=3,
                return_distances=True,
            )
        except Exception:
            retrieved = []
            distances = []

    retret_dist = distances[0] if distances else None

    if _USE_LLM and ticket_message:
        dag, mem_hit = _plan_llm_memory(pending_tools, ticket_message, retrieved, store)
        return dag, mem_hit, retret_dist, False, None, None

    return _plan_fallback(pending_tools), bool(retrieved), retret_dist, False, None, None


# ---------------------------------------------------------------------------
# Memory-augmented critic / replanner
# ---------------------------------------------------------------------------


def _classify_failure(entry: dict[str, Any]) -> str:
    """Classify the failure from observable symptoms only."""
    if not entry["success"]:
        error_msg = (entry.get("error") or "").lower()
        if "timeout" in error_msg or "timed out" in error_msg:
            return "timeout"
        return "timeout"

    data = entry.get("data") or {}
    status = data.get("status", "")
    if status == "UNKNOWN" or data.get("note", ""):
        return "ambiguous_data"
    if status == "not_found":
        return "wrong_result"

    return "wrong_result"


def _critic_llm_memory_v2(
    dag: list[list[str]],
    results: list[dict[str, Any]],
    store: ClientStore,
    ticket_message: str,
) -> tuple[bool, set[str], bool, str, float, str]:
    """Critic with category-conditioned failure prediction and memory routing.

    Returns (resolved, failed_tools, memory_hit, predicted_category, confidence, recovery_strategy).
    """
    quick_failed: set[str] = set()
    for entry in results:
        if _tool_has_bad_data(entry):
            quick_failed.add(entry["tool_name"])

    if not quick_failed:
        return True, set(), False, "", 1.0, ""

    # Classify the first failed tool we find
    failed_tool = sorted(quick_failed)[0]
    failed_entry = next(entry for entry in results if entry["tool_name"] == failed_tool)
    predicted_category = _classify_failure(failed_entry)

    memory_hit = False
    recovery_strategy = "retry"
    confidence = 1.0

    if _enable_conditioned_critic():
        query = f"tool={failed_tool} failure_type={predicted_category} context={ticket_message[:200]}"
        try:
            hits: list[ToolFailureMemory] = store.tool_failure.retrieve(
                client_id=CLIENT_ID,
                query_text=query,
                query_filter={"failure_type": predicted_category},
                top_k=1,
            )
        except Exception:
            hits = []

        for hit in hits:
            if hit.tool_name == failed_tool and hit.failure_type == predicted_category:
                recovery_strategy = hit.recovery_strategy or hit.fix_applied
                confidence = hit.confidence
                memory_hit = True
                break

    if memory_hit:
        logger.info(
            "Memory hit in Critic for tool %s (%s) — applying stored recovery strategy '%s' without LLM replan.",
            failed_tool, predicted_category, recovery_strategy,
        )
        return False, quick_failed, True, predicted_category, confidence, recovery_strategy

    # No memory hit or conditioned critic disabled -> call the LLM
    if _USE_LLM:
        try:
            prompt_template = _load_prompt("critic_conditioned_v2.txt")
            user_prompt = prompt_template.format(
                dag_json=json.dumps(dag),
                results_json=json.dumps(results, default=str)
            )

            content = _call_llm("CRITIC_MODEL", [
                {"role": "system", "content": "You are a failure-aware tool execution critic. Output only valid JSON."},
                {"role": "user", "content": user_prompt},
            ])

            start = content.index("{")
            end = content.rindex("}") + 1
            parsed = json.loads(content[start:end])

            resolved = parsed.get("resolved", False)
            failed_list = parsed.get("failed_tools", [])
            failed_set = set(failed_list) if failed_list else quick_failed

            failures = parsed.get("failures", [])
            pred_cat = predicted_category
            conf = 0.8
            rec_strat = "retry"
            if failures:
                f_obj = next((f for f in failures if f.get("tool_name") == failed_tool), {})
                if f_obj:
                    pred_cat = f_obj.get("predicted_category", predicted_category)
                    conf = float(f_obj.get("confidence", 0.8))
                    rec_strat = f_obj.get("recovery_strategy", "retry")

            return resolved, failed_set, False, pred_cat, conf, rec_strat
        except Exception as e:
            logger.warning("Failed Critic LLM call, falling back: %s", e)

    # Fallback path
    ok, failed_set = _critic_fallback(dag, results)
    return ok, failed_set, False, predicted_category, 0.5, "retry"


def _critic(
    dag: list[list[str]],
    results: list[dict[str, Any]],
    store: ClientStore,
    ticket_message: str,
) -> tuple[bool, set[str], bool, str, float, str]:
    """Returns (resolved, failed_tools, memory_hit, predicted_category, confidence, recovery_strategy)."""
    if _USE_LLM:
        return _critic_llm_memory_v2(dag, results, store, ticket_message)
    ok, failed = _critic_fallback(dag, results)
    return ok, failed, False, "", 1.0, ""


# ---------------------------------------------------------------------------
# Resolution check & response builder
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
    # Strip trailing empty layers
    non_empty = [layer for layer in dag if layer]
    if not non_empty:
        return False

    last_non_empty_idx = max(i for i, layer in enumerate(dag) if layer)
    for i in range(last_non_empty_idx):
        if not dag[i]:
            return False

    tool_layer: dict[str, int] = {}
    for layer_idx, layer in enumerate(dag):
        for tool in layer:
            tool_layer[tool] = layer_idx

    for tool, deps in _DEPENDENCIES.items():
        if tool not in tool_layer:
            continue
        for dep in deps:
            if dep not in tool_layer:
                continue
            if tool_layer[dep] >= tool_layer[tool]:
                return False

    return True


def _write_plan_success(
    store: ClientStore,
    ticket: dict[str, Any],
    dag: list[list[str]],
) -> None:
    if not _dag_is_valid(dag, ticket):
        logger.warning(
            "Skipping PlanSuccessMemory write for ticket %s: DAG failed dependency-order check. dag=%s",
            ticket.get("ticket_id", "?"), dag,
        )
        return

    ticket_message = ticket.get("customer_message", "")
    parameterized = _abstract_dag_template(ticket_message) if _enable_template_abstraction() else ticket_message

    try:
        store.plan_success.write(
            client_id=CLIENT_ID,
            entry=PlanSuccessMemory(
                intent_cluster=ticket.get("intent_label", "unknown"),
                dag_template=_dag_to_dict(dag),
                success_rate=1.0,
                parameterized_message=parameterized,
            ),
        )
    except Exception as exc:
        logger.warning("Failed to write PlanSuccessMemory: %s", exc)


def _build_dependency_graph(workflow_template: list[list[str]]) -> dict[str, list[str]]:
    """tool_name -> sorted list of tools *within this workflow* it depends on, restricted to the
    module-level _DEPENDENCIES map. A dependency on a tool this workflow doesn't actually use
    (shouldn't happen given how the DAG is built, but defensive regardless) is dropped rather
    than surfaced as a dangling reference.
    """
    present = {tool for layer in workflow_template for tool in layer}
    return {
        tool: sorted(deps & present)
        for tool, deps in _DEPENDENCIES.items()
        if tool in present and (deps & present)
    }


def _build_tool_constraints(workflow_template: list[list[str]]) -> dict[str, Any]:
    """Structural metadata beyond the dependency graph — currently just each tool's layer index.
    Policy_Memory_Implementation_Plan.md doesn't pin this field's shape further than `dict`."""
    return {
        "tool_layers": {
            tool: layer_idx for layer_idx, layer in enumerate(workflow_template) for tool in layer
        }
    }


def _write_policy_memory(
    ticket: dict[str, Any],
    dag: list[list[str]],
    replanning_count: int,
) -> None:
    """Policy Memory write-back (Contribution 2): "extract workflow, build dependency graph,
    remove customer-specific information, update existing matching policy or create a new one"
    (Policy_Memory_Implementation_Plan.md's "Writing Policy Memory" section). Write-on-success-
    only, mirroring _write_plan_success's existing behavior — called from the same call sites,
    immediately after it, gated by _enable_policy_memory().
    """
    intent_cluster = ticket.get("intent_label", "unknown")
    workflow_template = [list(layer) for layer in dag if layer]
    if not workflow_template:
        return

    policy_id = make_policy_id(intent_cluster, workflow_template)
    ticket_id = ticket["ticket_id"]
    tool_calls_count = sum(len(layer) for layer in workflow_template)

    try:
        existing = get_policy(CLIENT_ID, policy_id)

        if existing is not None:
            usage_count = existing.usage_count + 1
            avg_tool_calls = running_average(existing.average_tool_calls, existing.usage_count, tool_calls_count)
            avg_replans = running_average(existing.average_replans, existing.usage_count, replanning_count)
            confidence = min(1.0, existing.confidence + 0.05)
            created_from = existing.created_from
            if ticket_id not in created_from:
                created_from = created_from + [ticket_id]
            created_from = created_from[-MAX_CREATED_FROM:]
        else:
            usage_count = 1
            avg_tool_calls = float(tool_calls_count)
            avg_replans = float(replanning_count)
            confidence = 0.5
            created_from = [ticket_id]

        policy = PolicyMemory(
            policy_id=policy_id,
            intent_cluster=intent_cluster,
            workflow_template=workflow_template,
            dependency_graph=_build_dependency_graph(workflow_template),
            tool_constraints=_build_tool_constraints(workflow_template),
            success_rate=1.0,
            usage_count=usage_count,
            average_tool_calls=avg_tool_calls,
            average_replans=avg_replans,
            confidence=confidence,
            created_from=created_from,
            last_updated=utcnow(),
        )
        upsert_policy(CLIENT_ID, policy)
    except Exception as exc:
        logger.warning("Failed to write PolicyMemory: %s", exc)


def _write_tool_failures(
    store: ClientStore,
    tool_calls_made: list[dict[str, Any]],
    ticket_message: str,
    predicted_category: str = "",
    recovery_strategy: str = "retry",
    confidence: float = 0.8,
) -> None:
    for entry in tool_calls_made:
        if not _tool_has_bad_data(entry):
            continue
        try:
            store.tool_failure.write(
                client_id=CLIENT_ID,
                entry=ToolFailureMemory(
                    tool_name=entry["tool_name"],
                    failure_type=predicted_category or ("api_error" if not entry["success"] else "bad_data"),
                    context=ticket_message[:300],
                    fix_applied=recovery_strategy,
                    recovery_strategy=recovery_strategy,
                    confidence=confidence,
                ),
            )
        except Exception as exc:
            logger.warning("Failed to write ToolFailureMemory: %s", exc)


# ---------------------------------------------------------------------------
# Extended result type
# ---------------------------------------------------------------------------


class MemoryAugmentedV2Result(BaselineResult):
    memory_hit: bool = False
    replanning_count: int = 0
    predicted_category: str = ""
    actual_category: str = ""
    critic_confidence: float = 1.0
    retrieval_distance: float | None = None
    recovery_strategy: str = ""
    # Policy Memory (Contribution 2) — always present (default False/None), only meaningful when
    # ENABLE_POLICY_MEMORY=1; see scripts/analyze_policy_memory.py for how these feed the Policy
    # Retrieval / Reuse / Transfer metrics from Policy_Memory_Implementation_Plan.md's Evaluation
    # section.
    policy_hit: bool = False
    policy_id_used: str | None = None
    policy_usage_count_at_use: int | None = None


# ---------------------------------------------------------------------------
# Main run function
# ---------------------------------------------------------------------------


def run(ticket: dict[str, Any], registry: ToolRegistry) -> MemoryAugmentedV2Result:
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

    # Fields to log for our failure category prediction evaluation
    pred_category = ""
    act_category = ""
    crit_conf = 1.0
    ret_dist: float | None = None
    rec_strat = ""

    # Policy Memory (Contribution 2) fields — captured from the most recent planning iteration,
    # same pattern as ret_dist above.
    any_policy_hit = False
    policy_id_used: str | None = None
    policy_usage_count_at_use: int | None = None

    for iteration in range(1, MAX_ITERATIONS + 1):
        iteration_count = iteration

        # --- Planner (memory-augmented) ---
        dag, plan_memory_hit, current_ret_dist, plan_policy_hit, current_policy_id, current_policy_usage = _plan(
            pending_tools, ticket_message, store
        )
        last_dag = dag
        if plan_memory_hit:
            any_memory_hit = True
        if current_ret_dist is not None:
            ret_dist = current_ret_dist
        if plan_policy_hit:
            any_policy_hit = True
        if current_policy_id is not None:
            policy_id_used = current_policy_id
            policy_usage_count_at_use = current_policy_usage

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

        # --- Critic (memory-augmented) ---
        resolved, failed, critic_memory_hit, current_pred_cat, current_conf, current_rec_strat = _critic(
            dag, iteration_results, store, ticket_message
        )
        if critic_memory_hit:
            any_memory_hit = True

        if not resolved:
            replanning_count += 1
            pred_category = current_pred_cat
            crit_conf = current_conf
            rec_strat = current_rec_strat
            
            # Find oracle actual category for failed tool
            failed_tool = sorted(failed)[0] if failed else None
            if failed_tool:
                failed_entry = next((e for e in iteration_results if e["tool_name"] == failed_tool), {})
                act_category = failed_entry.get("failure_type") or ("api_error" if not failed_entry.get("success") else "bad_data")
            
            pending_tools = failed | (
                pending_tools - {e["tool_name"] for e in iteration_results if e["success"]}
            )
        else:
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
                if _enable_policy_memory():
                    _write_policy_memory(ticket, last_dag, replanning_count)
            else:
                _write_tool_failures(store, tool_calls_made, ticket_message, pred_category, rec_strat, crit_conf)

            return MemoryAugmentedV2Result(
                ticket_id=ticket_id,
                resolved=properly_resolved,
                steps_taken=iteration_count,
                tool_calls_made=list(tool_calls_made),
                final_response=_build_response(ticket_message, tool_calls_made, properly_resolved),
                memory_hit=any_memory_hit,
                replanning_count=replanning_count,
                predicted_category=pred_category,
                actual_category=act_category,
                critic_confidence=crit_conf,
                retrieval_distance=ret_dist,
                recovery_strategy=rec_strat,
                policy_hit=any_policy_hit,
                policy_id_used=policy_id_used,
                policy_usage_count_at_use=policy_usage_count_at_use,
            )

    # --- Max iterations reached ---
    properly_resolved = _check_resolved(ticket, tool_calls_made)
    outcome = "success" if properly_resolved else "failure"

    _write_episodic(store, ticket, last_dag, outcome)
    if properly_resolved:
        _write_plan_success(store, ticket, last_dag)
        if _enable_policy_memory():
            _write_policy_memory(ticket, last_dag, replanning_count)
    else:
        _write_tool_failures(store, tool_calls_made, ticket_message, pred_category, rec_strat, crit_conf)

    return MemoryAugmentedV2Result(
        ticket_id=ticket_id,
        resolved=properly_resolved,
        steps_taken=iteration_count,
        tool_calls_made=list(tool_calls_made),
        final_response=_build_response(ticket_message, tool_calls_made, properly_resolved),
        memory_hit=any_memory_hit,
        replanning_count=replanning_count,
        predicted_category=pred_category,
        actual_category=act_category,
        critic_confidence=crit_conf,
        retrieval_distance=ret_dist,
        recovery_strategy=rec_strat,
        policy_hit=any_policy_hit,
        policy_id_used=policy_id_used,
        policy_usage_count_at_use=policy_usage_count_at_use,
    )
