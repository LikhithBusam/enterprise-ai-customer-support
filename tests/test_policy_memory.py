from __future__ import annotations

from datetime import datetime, timedelta, timezone

import chromadb
import pytest

from memory import policy_store
from memory.policy_memory import PolicyMemory

CLIENT_ID = "test_client"


@pytest.fixture(autouse=True)
def _patch_client(monkeypatch: pytest.MonkeyPatch, chroma_client: chromadb.Client) -> None:
    monkeypatch.setattr(policy_store.ClientStoreRegistry, "get_client", lambda: chroma_client)


def _make_policy(
    policy_id: str, intent_cluster: str = "refund_request", usage_count: int = 1
) -> PolicyMemory:
    return PolicyMemory(
        policy_id=policy_id,
        intent_cluster=intent_cluster,
        workflow_template=[["crm"], ["order_lookup"], ["refund"]],
        dependency_graph={"refund": ["order_lookup"]},
        tool_constraints={"tool_layers": {"crm": 0, "order_lookup": 1, "refund": 2}},
        usage_count=usage_count,
        created_from=["TKT-1"],
    )


class TestMakePolicyId:
    def test_deterministic_for_same_inputs(self) -> None:
        workflow = [["crm"], ["order_lookup"], ["refund"]]
        assert policy_store.make_policy_id("refund_request", workflow) == policy_store.make_policy_id(
            "refund_request", workflow
        )

    def test_differs_by_intent_cluster(self) -> None:
        workflow = [["crm"], ["kb_search"]]
        id1 = policy_store.make_policy_id("account_issue", workflow)
        id2 = policy_store.make_policy_id("general_inquiry", workflow)
        assert id1 != id2

    def test_differs_by_workflow_shape(self) -> None:
        id1 = policy_store.make_policy_id("refund_request", [["crm"], ["refund"]])
        id2 = policy_store.make_policy_id("refund_request", [["crm"], ["order_lookup"], ["refund"]])
        assert id1 != id2


class TestUpsertAndGet:
    def test_get_missing_policy_returns_none(self) -> None:
        assert policy_store.get_policy(CLIENT_ID, "policy_doesnotexist") is None

    def test_upsert_then_get_round_trips(self) -> None:
        policy_store.upsert_policy(CLIENT_ID, _make_policy("policy_abc"))
        fetched = policy_store.get_policy(CLIENT_ID, "policy_abc")
        assert fetched is not None
        assert fetched.policy_id == "policy_abc"
        assert fetched.workflow_template == [["crm"], ["order_lookup"], ["refund"]]

    def test_upsert_updates_in_place_not_duplicated(self) -> None:
        policy_store.upsert_policy(CLIENT_ID, _make_policy("policy_dup", usage_count=1))
        policy_store.upsert_policy(CLIENT_ID, _make_policy("policy_dup", usage_count=2))
        fetched = policy_store.get_policy(CLIENT_ID, "policy_dup")
        assert fetched is not None
        assert fetched.usage_count == 2
        assert policy_store.count_policies(CLIENT_ID) == 1


class TestRetrievePolicies:
    def test_empty_query_returns_empty(self) -> None:
        policies, distances = policy_store.retrieve_policies(CLIENT_ID, "", top_k=3)
        assert policies == []
        assert distances == []

    def test_retrieves_written_policy_by_semantic_query(self) -> None:
        policy_store.upsert_policy(CLIENT_ID, _make_policy("policy_search"))
        policies, distances = policy_store.retrieve_policies(
            CLIENT_ID, "refund_request workflow", top_k=3
        )
        assert len(policies) == 1
        assert policies[0].policy_id == "policy_search"
        assert len(distances) == 1

    def test_isolated_per_client(self) -> None:
        policy_store.upsert_policy("client_a", _make_policy("policy_shared_id"))
        policies, _ = policy_store.retrieve_policies("client_b", "refund_request", top_k=3)
        assert policies == []


class TestPrunePolicies:
    def test_prune_removes_old_entries(self) -> None:
        policy_store.upsert_policy(CLIENT_ID, _make_policy("policy_old"))
        removed = policy_store.prune_policies(
            CLIENT_ID, datetime.now(timezone.utc) + timedelta(days=1)
        )
        assert removed == 1
        assert policy_store.get_policy(CLIENT_ID, "policy_old") is None

    def test_prune_keeps_recent_entries(self) -> None:
        policy_store.upsert_policy(CLIENT_ID, _make_policy("policy_recent"))
        removed = policy_store.prune_policies(
            CLIENT_ID, datetime.now(timezone.utc) - timedelta(days=1)
        )
        assert removed == 0
        assert policy_store.get_policy(CLIENT_ID, "policy_recent") is not None


class TestResetPolicyCollection:
    def test_reset_clears_existing_policies(self) -> None:
        policy_store.upsert_policy(CLIENT_ID, _make_policy("policy_to_clear"))
        assert policy_store.count_policies(CLIENT_ID) == 1
        policy_store.reset_policy_collection(CLIENT_ID)
        assert policy_store.count_policies(CLIENT_ID) == 0

    def test_reset_on_nonexistent_collection_does_not_raise(self) -> None:
        policy_store.reset_policy_collection("never_touched_client")


class TestRunningAverage:
    def test_first_observation(self) -> None:
        assert policy_store.running_average(0.0, 0, 5.0) == 5.0

    def test_incorporates_new_value(self) -> None:
        assert policy_store.running_average(4.0, 1, 8.0) == 6.0
