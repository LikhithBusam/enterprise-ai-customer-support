from __future__ import annotations

from datetime import datetime, timezone

import pytest

from src.memory.base import BaseMemoryEntry
from src.memory.client_store import ChromaStore, ClientStore
from src.memory.episodic import EpisodicMemory
from src.memory.escalation_memory import EscalationMemory
from src.memory.plan_success import PlanSuccessMemory
from src.memory.tool_failure import ToolFailureMemory

FIXED_TIMESTAMP = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    ("store_name", "entry", "query_text"),
    [
        pytest.param(
            "episodic",
            EpisodicMemory(
                timestamp=FIXED_TIMESTAMP,
                ticket_id="TKT-001",
                intent="refund request",
                plan_dag={"nodes": ["lookup_order", "issue_refund"]},
                outcome="resolved",
            ),
            "customer wants money back for a defective product",
            id="episodic",
        ),
        pytest.param(
            "tool_failure",
            ToolFailureMemory(
                timestamp=FIXED_TIMESTAMP,
                tool_name="refund_api",
                failure_type="timeout",
                context="payment gateway did not respond within 30 seconds",
                fix_applied="retry with exponential backoff",
            ),
            "refund service timed out waiting for the payment processor",
            id="tool_failure",
        ),
        pytest.param(
            "plan_success",
            PlanSuccessMemory(
                timestamp=FIXED_TIMESTAMP,
                intent_cluster="billing_dispute",
                dag_template={"nodes": ["verify_account", "apply_credit"]},
                success_rate=0.92,
            ),
            "successful workflow for resolving billing complaints",
            id="plan_success",
        ),
        pytest.param(
            "escalation",
            EscalationMemory(
                timestamp=FIXED_TIMESTAMP,
                ticket_id="TKT-099",
                human_correction="offer store credit instead of cash refund",
                original_response="we cannot process your refund at this time",
            ),
            "human agent corrected the automated refund denial response",
            id="escalation",
        ),
    ],
)
def test_memory_retrieval_round_trip(
    client_store: ClientStore,
    client_id: str,
    store_name: str,
    entry: BaseMemoryEntry,
    query_text: str,
) -> None:
    store: ChromaStore = getattr(client_store, store_name)

    store.write(client_id, entry)
    results = store.retrieve(client_id, query_text, top_k=1)

    assert len(results) == 1
    retrieved = results[0]
    assert retrieved == entry
