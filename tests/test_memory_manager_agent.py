from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from src.agents import memory_manager
from src.core.dag import ExecutionDAG
from src.memory.client_store import ClientStore


@pytest.fixture(autouse=True)
def _patch_registry(monkeypatch: pytest.MonkeyPatch, client_store: ClientStore) -> None:
    monkeypatch.setattr(memory_manager.ClientStoreRegistry, "get", lambda cid: client_store)


def test_compute_tool_reliability_starts_at_one(client_id: str) -> None:
    assert memory_manager.compute_tool_reliability(client_id, "refund") == 1.0


def test_compute_tool_reliability_drops_after_failures(client_id: str) -> None:
    memory_manager.write_tool_failure(
        client_id=client_id,
        tool_name="crm",
        predicted_category="timeout",
        context="ctx",
        recovery_strategy="retry",
        confidence=0.5,
    )
    assert memory_manager.compute_tool_reliability(client_id, "crm") < 1.0


def test_write_plan_success_skipped_for_invalid_dag(client_id: str) -> None:
    bad_dag = ExecutionDAG(layers=[["refund", "order_lookup"]])  # same layer: not dependency-ordered
    memory_manager.write_plan_success(client_id, "refund_request", bad_dag, "template")
    retrieved, _ = memory_manager.retrieve_plan_templates(client_id, "template")
    assert retrieved == []


def test_write_and_retrieve_plan_success(client_id: str) -> None:
    good_dag = ExecutionDAG(layers=[["crm"], ["order_lookup"], ["refund"]])
    memory_manager.write_plan_success(client_id, "refund_request", good_dag, "refund for {order_id}")
    retrieved, _ = memory_manager.retrieve_plan_templates(client_id, "refund for {order_id}")
    assert len(retrieved) == 1
    assert retrieved[0].intent_cluster == "refund_request"


def test_prune_removes_old_entries(client_id: str) -> None:
    memory_manager.write_tool_failure(
        client_id=client_id,
        tool_name="kb_search",
        predicted_category="ambiguous_data",
        context="ctx",
        recovery_strategy="disambiguate",
        confidence=0.5,
    )
    counts = memory_manager.prune(client_id, datetime.now(timezone.utc) + timedelta(days=1))
    assert counts["tool_failure"] >= 1


def test_write_tool_failure_redacts_pii_from_context(
    client_id: str, client_store: ClientStore
) -> None:
    memory_manager.write_tool_failure(
        client_id=client_id,
        tool_name="crm",
        predicted_category="timeout",
        context="reach me at a@b.com or 555-123-4567",
        recovery_strategy="retry",
        confidence=0.5,
    )
    failures = client_store.tool_failure.retrieve(
        client_id=client_id, query_text="reach me", top_k=5
    )
    assert len(failures) == 1
    assert "a@b.com" not in failures[0].context
    assert "555-123-4567" not in failures[0].context
    assert "[REDACTED_EMAIL]" in failures[0].context


def test_write_plan_success_redacts_residual_pii(client_id: str) -> None:
    good_dag = ExecutionDAG(layers=[["crm"], ["order_lookup"], ["refund"]])
    memory_manager.write_plan_success(
        client_id, "refund_request", good_dag, "call me back at 555-222-3333 re: {order_id}"
    )
    retrieved, _ = memory_manager.retrieve_plan_templates(client_id, "call me back")
    assert len(retrieved) == 1
    assert "555-222-3333" not in retrieved[0].parameterized_message
    assert "{order_id}" in retrieved[0].parameterized_message


def test_write_escalation_redacts_pii(client_id: str, client_store: ClientStore) -> None:
    memory_manager.write_escalation(
        client_id=client_id,
        ticket_id="T-1",
        human_correction="Customer's real email is a@b.com, please use that.",
        original_response="We could not verify a@b.com in our system.",
    )
    entries = client_store.escalation.retrieve(client_id=client_id, query_text="Customer", top_k=5)
    assert len(entries) == 1
    assert "a@b.com" not in entries[0].human_correction
    assert "a@b.com" not in entries[0].original_response
