"""Memory Manager Agent: retrieval, writes, and pruning across all memory stores.

Centralizes ClientStore access behind typed functions so the Planner/Critic never touch
ChromaStore directly — experiments/ calls store.* inline; this is a deliberate cleanup for the
production track, not a change to the underlying MemoryManager[T]/ChromaStore/ClientStore
contracts, which are reused unmodified.
"""

from __future__ import annotations

import logging
from datetime import datetime

from src.core.dag import ExecutionDAG
from src.core.pii import redact_pii
from src.memory.client_store import ClientStore, ClientStoreRegistry
from src.memory.episodic import EpisodicMemory
from src.memory.escalation_memory import EscalationMemory
from src.memory.plan_success import PlanSuccessMemory
from src.memory.tool_failure import ToolFailureMemory

logger = logging.getLogger(__name__)


def _store(client_id: str) -> ClientStore:
    return ClientStoreRegistry.get(client_id)


def retrieve_plan_templates(
    client_id: str, query_text: str, top_k: int = 3
) -> tuple[list[PlanSuccessMemory], float | None]:
    if not query_text:
        return [], None
    try:
        entries, distances = _store(client_id).plan_success.retrieve(
            client_id=client_id, query_text=query_text, top_k=top_k, return_distances=True
        )
    except Exception as exc:
        logger.warning("PlanSuccessMemory retrieval failed: %s", exc)
        return [], None
    return entries, (distances[0] if distances else None)


def retrieve_tool_failure(
    client_id: str, tool_name: str, failure_type: str, context: str, top_k: int = 1
) -> list[ToolFailureMemory]:
    try:
        return _store(client_id).tool_failure.retrieve(
            client_id=client_id,
            query_text=f"tool={tool_name} failure_type={failure_type} context={context[:200]}",
            query_filter={"failure_type": failure_type},
            top_k=top_k,
        )
    except Exception as exc:
        logger.warning("ToolFailureMemory retrieval failed: %s", exc)
        return []


def compute_tool_reliability(client_id: str, tool_name: str) -> float:
    """Mirrors experiments/memory_augmented_v2.py::_compute_tool_reliability."""
    try:
        failures: list[ToolFailureMemory] = _store(client_id).tool_failure.retrieve(
            client_id=client_id, query_text=f"tool={tool_name}", top_k=20
        )
        failure_count = sum(1 for f in failures if f.tool_name == tool_name)
    except Exception:
        failure_count = 0

    if failure_count == 0:
        return 1.0
    return max(0.1, 1.0 - (failure_count * 0.05))


def write_episodic(client_id: str, ticket_id: str, intent: str, dag: ExecutionDAG, outcome: str) -> None:
    try:
        _store(client_id).episodic.write(
            client_id=client_id,
            entry=EpisodicMemory(
                ticket_id=ticket_id, intent=intent, plan_dag=dag.to_dict(), outcome=outcome
            ),
        )
    except Exception as exc:
        logger.warning("Failed to write EpisodicMemory: %s", exc)


def write_plan_success(
    client_id: str, intent_cluster: str, dag: ExecutionDAG, parameterized_message: str
) -> None:
    if not dag.is_dependency_ordered():
        logger.warning(
            "Skipping PlanSuccessMemory write: DAG failed dependency-order check. dag=%s", dag
        )
        return
    try:
        _store(client_id).plan_success.write(
            client_id=client_id,
            entry=PlanSuccessMemory(
                intent_cluster=intent_cluster,
                dag_template=dag.to_dict(),
                success_rate=1.0,
                # planner.abstract_ticket_message already replaces order/customer/email/amount
                # with placeholders; redact_pii is a second, compliance-focused pass over whatever
                # free text remains (phone/SSN/card-like sequences), per ENTERPRISE_ARCHITECTURE.md
                # Phase 5 — belt-and-suspenders, not a replacement for that abstraction.
                parameterized_message=redact_pii(parameterized_message),
            ),
        )
    except Exception as exc:
        logger.warning("Failed to write PlanSuccessMemory: %s", exc)


def write_tool_failure(
    client_id: str,
    tool_name: str,
    predicted_category: str,
    context: str,
    recovery_strategy: str,
    confidence: float,
) -> None:
    try:
        _store(client_id).tool_failure.write(
            client_id=client_id,
            entry=ToolFailureMemory(
                tool_name=tool_name,
                failure_type=predicted_category or "unknown",
                # context is raw ticket text (src/graph/pipeline.py's _memory_write_node passes
                # state["customer_message"] straight through) — redact before it reaches
                # ChromaStore, per ENTERPRISE_ARCHITECTURE.md Phase 5.
                context=redact_pii(context)[:300],
                fix_applied=recovery_strategy,
                recovery_strategy=recovery_strategy,
                confidence=confidence,
            ),
        )
    except Exception as exc:
        logger.warning("Failed to write ToolFailureMemory: %s", exc)


def write_escalation(
    client_id: str, ticket_id: str, human_correction: str, original_response: str
) -> None:
    """Not yet called from src/graph/pipeline.py — EscalationMemory requires a human_correction,
    which only exists once the human-feedback loop (AGENTS.md's still-open "Escalation Agent +
    human feedback loop" TODO) is wired up. Added now so that loop's write path already redacts
    PII from day one instead of retrofitting it later (ENTERPRISE_ARCHITECTURE.md Phase 5).
    """
    try:
        _store(client_id).escalation.write(
            client_id=client_id,
            entry=EscalationMemory(
                ticket_id=ticket_id,
                human_correction=redact_pii(human_correction),
                original_response=redact_pii(original_response),
            ),
        )
    except Exception as exc:
        logger.warning("Failed to write EscalationMemory: %s", exc)


def prune(client_id: str, before: datetime) -> dict[str, int]:
    """Retention primitive over the existing MemoryManager.prune() implementations. Not yet
    wired to a scheduler — that's ENTERPRISE_ARCHITECTURE.md Phase 5.
    """
    store = _store(client_id)
    return {
        "episodic": store.episodic.prune(client_id, before),
        "tool_failure": store.tool_failure.prune(client_id, before),
        "plan_success": store.plan_success.prune(client_id, before),
        "escalation": store.escalation.prune(client_id, before),
    }
