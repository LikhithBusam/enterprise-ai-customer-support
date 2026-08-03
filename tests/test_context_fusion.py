from __future__ import annotations

import chromadb
import pytest

from experiments.context_fusion import PlanningContext, fuse_context
from memory import policy_store
from memory.policy_memory import PolicyMemory
from src.memory.client_store import ClientStore
from src.memory.episodic import EpisodicMemory
from src.memory.tool_failure import ToolFailureMemory


@pytest.fixture(autouse=True)
def _patch_policy_client(monkeypatch: pytest.MonkeyPatch, chroma_client: chromadb.Client) -> None:
    monkeypatch.setattr(policy_store.ClientStoreRegistry, "get_client", lambda: chroma_client)


def test_fuse_context_empty_stores_returns_empty_context(
    client_store: ClientStore, client_id: str
) -> None:
    context = fuse_context(client_id, "refund for my order", client_store)
    assert context.policies == []
    assert context.tool_failures == []
    assert context.episodes == []
    assert context.has_any_hit is False


def test_fuse_context_empty_query_text_returns_empty(
    client_store: ClientStore, client_id: str
) -> None:
    context = fuse_context(client_id, "", client_store)
    assert context.has_any_hit is False


def test_fuse_context_merges_all_three_memory_types(
    client_store: ClientStore, client_id: str
) -> None:
    policy_store.upsert_policy(
        client_id,
        PolicyMemory(
            policy_id="policy_x",
            intent_cluster="refund_request",
            workflow_template=[["crm"], ["order_lookup"], ["refund"]],
        ),
    )
    client_store.tool_failure.write(
        client_id=client_id,
        entry=ToolFailureMemory(
            tool_name="refund", failure_type="timeout", context="ctx", fix_applied="retry"
        ),
    )
    client_store.episodic.write(
        client_id=client_id,
        entry=EpisodicMemory(
            ticket_id="TKT-1",
            intent="refund_request",
            plan_dag={"layers": [["crm"]]},
            outcome="success",
        ),
    )

    context = fuse_context(client_id, "refund request for my order", client_store)
    assert len(context.policies) == 1
    assert len(context.tool_failures) == 1
    assert len(context.episodes) == 1
    assert context.has_any_hit is True


def test_fuse_context_survives_policy_retrieval_error(
    monkeypatch: pytest.MonkeyPatch, client_store: ClientStore, client_id: str
) -> None:
    def _raise(*args: object, **kwargs: object) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr("experiments.context_fusion.retrieve_policies", _raise)
    # Must fail closed (empty policies), not propagate the exception into planning.
    context = fuse_context(client_id, "refund request", client_store)
    assert context.policies == []


def test_fuse_context_survives_tool_failure_retrieval_error(
    monkeypatch: pytest.MonkeyPatch, client_store: ClientStore, client_id: str
) -> None:
    def _raise(*args: object, **kwargs: object) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr(client_store.tool_failure, "retrieve", _raise)
    context = fuse_context(client_id, "refund request", client_store)
    assert context.tool_failures == []


def test_to_prompt_text_empty_context_is_empty_string() -> None:
    assert PlanningContext().to_prompt_text() == ""


def test_to_prompt_text_includes_policy_workflow() -> None:
    context = PlanningContext(
        policies=[
            PolicyMemory(
                policy_id="policy_x",
                intent_cluster="refund_request",
                workflow_template=[["crm"], ["refund"]],
            )
        ]
    )
    text = context.to_prompt_text()
    assert "refund_request" in text
    assert "crm" in text
