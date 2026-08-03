from __future__ import annotations

import chromadb
import pytest

import experiments.memory_augmented_v2 as mv2
from memory import policy_store
from src.memory.client_store import ClientStore


@pytest.fixture(autouse=True)
def _patch_policy_client(monkeypatch: pytest.MonkeyPatch, chroma_client: chromadb.Client) -> None:
    monkeypatch.setattr(policy_store.ClientStoreRegistry, "get_client", lambda: chroma_client)


@pytest.fixture(autouse=True)
def _no_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    """_plan()'s fallback path never calls the LLM regardless of ENABLE_POLICY_MEMORY — keeps
    these tests offline/deterministic without needing a real API key. _USE_LLM is a module-level
    constant snapshotted at import time from os.environ, so it has to be patched directly rather
    than via monkeypatch.setenv (which wouldn't reach an already-imported module attribute).
    """
    monkeypatch.setattr(mv2, "_USE_LLM", False)


@pytest.fixture(autouse=True)
def _use_test_client_id(monkeypatch: pytest.MonkeyPatch, client_id: str) -> None:
    """Redirects the module's hardcoded CLIENT_ID to the test client so writes/reads in these
    tests land in the isolated per-test Chroma directory instead of "experiment_client"."""
    monkeypatch.setattr(mv2, "CLIENT_ID", client_id)


class TestBuildDependencyGraph:
    def test_keeps_only_dependencies_present_in_workflow(self) -> None:
        graph = mv2._build_dependency_graph([["crm"], ["order_lookup"], ["refund"]])
        assert graph == {"refund": ["order_lookup"]}

    def test_drops_dependency_not_present_in_workflow(self) -> None:
        graph = mv2._build_dependency_graph([["crm"], ["refund"]])
        assert graph == {}


class TestBuildToolConstraints:
    def test_records_layer_index_per_tool(self) -> None:
        constraints = mv2._build_tool_constraints([["crm"], ["order_lookup"], ["refund"]])
        assert constraints == {"tool_layers": {"crm": 0, "order_lookup": 1, "refund": 2}}


class TestWritePolicyMemory:
    def test_first_write_creates_policy_with_usage_count_one(self, client_id: str) -> None:
        ticket = {"ticket_id": "TKT-1", "intent_label": "refund_request"}
        dag = [["crm"], ["order_lookup"], ["refund"]]
        mv2._write_policy_memory(ticket, dag, replanning_count=0)

        policy_id = policy_store.make_policy_id("refund_request", dag)
        policy = policy_store.get_policy(client_id, policy_id)
        assert policy is not None
        assert policy.usage_count == 1
        assert policy.created_from == ["TKT-1"]
        assert policy.average_tool_calls == 3.0

    def test_second_write_for_same_workflow_updates_in_place(self, client_id: str) -> None:
        dag = [["crm"], ["order_lookup"], ["refund"]]
        mv2._write_policy_memory({"ticket_id": "TKT-1", "intent_label": "refund_request"}, dag, replanning_count=0)
        mv2._write_policy_memory({"ticket_id": "TKT-2", "intent_label": "refund_request"}, dag, replanning_count=2)

        policy_id = policy_store.make_policy_id("refund_request", dag)
        policy = policy_store.get_policy(client_id, policy_id)
        assert policy is not None
        assert policy.usage_count == 2
        assert policy.created_from == ["TKT-1", "TKT-2"]
        assert policy.average_replans == 1.0  # (0 + 2) / 2
        assert policy_store.count_policies(client_id) == 1  # upsert, not a duplicate

    def test_different_intent_cluster_creates_a_separate_policy(self, client_id: str) -> None:
        dag = [["crm"], ["kb_search"]]
        mv2._write_policy_memory({"ticket_id": "TKT-1", "intent_label": "account_issue"}, dag, replanning_count=0)
        mv2._write_policy_memory({"ticket_id": "TKT-2", "intent_label": "general_inquiry"}, dag, replanning_count=0)
        assert policy_store.count_policies(client_id) == 2

    def test_empty_dag_is_skipped(self, client_id: str) -> None:
        mv2._write_policy_memory({"ticket_id": "TKT-1", "intent_label": "x"}, [], replanning_count=0)
        assert policy_store.count_policies(client_id) == 0

    def test_storage_failure_does_not_raise(self, monkeypatch: pytest.MonkeyPatch) -> None:
        def _raise(*args: object, **kwargs: object) -> None:
            raise RuntimeError("boom")

        monkeypatch.setattr(mv2, "upsert_policy", _raise)
        # Must not raise — mirrors _write_episodic/_write_plan_success/_write_tool_failures.
        mv2._write_policy_memory(
            {"ticket_id": "TKT-1", "intent_label": "refund_request"}, [["crm"]], replanning_count=0
        )


class TestPlanPolicyMemoryGate:
    def test_disabled_by_default_returns_extended_tuple_with_no_policy_fields(
        self, monkeypatch: pytest.MonkeyPatch, client_store: ClientStore
    ) -> None:
        monkeypatch.delenv("ENABLE_POLICY_MEMORY", raising=False)
        result = mv2._plan({"crm"}, "", client_store)
        assert len(result) == 6
        _, _, _, policy_hit, policy_id_used, usage_count = result
        assert policy_hit is False
        assert policy_id_used is None
        assert usage_count is None

    def test_enabled_with_empty_stores_has_no_policy_hit_but_still_plans(
        self, monkeypatch: pytest.MonkeyPatch, client_store: ClientStore
    ) -> None:
        monkeypatch.setenv("ENABLE_POLICY_MEMORY", "1")
        dag, memory_hit, distance, policy_hit, policy_id_used, usage_count = mv2._plan(
            {"crm", "order_lookup", "refund"}, "I need a refund for my order", client_store
        )
        assert policy_hit is False
        assert memory_hit is False
        assert dag  # fallback planner still produces a usable DAG

    def test_enabled_retrieves_previously_written_policy(
        self, monkeypatch: pytest.MonkeyPatch, client_store: ClientStore
    ) -> None:
        monkeypatch.setenv("ENABLE_POLICY_MEMORY", "1")
        mv2._write_policy_memory(
            {"ticket_id": "TKT-1", "intent_label": "refund_request"},
            [["crm"], ["order_lookup"], ["refund"]],
            replanning_count=0,
        )

        _, memory_hit, _, policy_hit, policy_id_used, usage_count = mv2._plan(
            {"crm", "order_lookup", "refund"},
            "I need a refund for my broken order",
            client_store,
        )
        assert policy_hit is True
        assert memory_hit is True
        assert policy_id_used is not None
        assert usage_count == 1

    def test_disabled_path_ignores_policy_memory_even_if_written(
        self, monkeypatch: pytest.MonkeyPatch, client_store: ClientStore
    ) -> None:
        """Backward compatibility (Policy_Memory_Implementation_Plan.md's Success Criteria):
        with the flag off, planning must behave exactly as v2_full always has — PlanSuccessMemory
        retrieval only, never touching Policy Memory even if some exists in the store."""
        monkeypatch.delenv("ENABLE_POLICY_MEMORY", raising=False)
        mv2._write_policy_memory(
            {"ticket_id": "TKT-1", "intent_label": "refund_request"},
            [["crm"], ["order_lookup"], ["refund"]],
            replanning_count=0,
        )
        _, _, _, policy_hit, policy_id_used, usage_count = mv2._plan(
            {"crm", "order_lookup", "refund"}, "I need a refund for my broken order", client_store
        )
        assert policy_hit is False
        assert policy_id_used is None
