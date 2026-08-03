from __future__ import annotations

import pytest

from src.agents import memory_manager
from src.graph.pipeline import build_pipeline, run_ticket
from src.memory.client_store import ClientStore
from src.tools.registry import ToolResult


class _FakeGateway:
    """Stands in for LLMProviderGateway: returns a fixed plan, and a fixed
    "order_lookup timed out" critic verdict whenever the Critic actually calls the LLM (it
    only does so when the quick observable-only gate already found a failure)."""

    def call(self, role: str, messages: list[dict]) -> str:
        if role == "planner":
            return '[["crm"], ["order_lookup"], ["refund"]]'
        if role == "critic":
            return (
                '{"resolved": false, "failed_tools": ["order_lookup"], '
                '"failures": [{"tool_name": "order_lookup", "predicted_category": "timeout", '
                '"confidence": 0.7, "recovery_strategy": "retry"}]}'
            )
        raise AssertionError(f"unexpected role: {role}")


def _happy_dispatch(tool_name: str, params: dict) -> ToolResult:
    if tool_name == "crm":
        return ToolResult(
            success=True,
            tool_name=tool_name,
            data={
                "customer_id": params.get("customer_id"),
                "status": "active",
                "tier": "gold",
                "lifetime_value": 100.0,
            },
        )
    if tool_name == "order_lookup":
        return ToolResult(
            success=True,
            tool_name=tool_name,
            data={"order_id": params.get("order_id"), "status": "delivered", "total_amount": 42.0},
        )
    if tool_name == "refund":
        return ToolResult(
            success=True,
            tool_name=tool_name,
            data={"refund_id": "RFND-1", "order_id": params.get("order_id"), "status": "approved"},
        )
    raise AssertionError(tool_name)


class _FlakyDispatch:
    """order_lookup fails once (timeout), then succeeds — exercises the replanning loop."""

    def __init__(self) -> None:
        self.order_lookup_calls = 0

    def __call__(self, tool_name: str, params: dict) -> ToolResult:
        if tool_name == "order_lookup":
            self.order_lookup_calls += 1
            if self.order_lookup_calls == 1:
                return ToolResult(
                    success=False,
                    tool_name=tool_name,
                    error="Upstream service timed out after 30 seconds",
                )
        return _happy_dispatch(tool_name, params)


def _always_fail_order_lookup(tool_name: str, params: dict) -> ToolResult:
    if tool_name == "order_lookup":
        return ToolResult(
            success=False, tool_name=tool_name, error="Upstream service timed out after 30 seconds"
        )
    return _happy_dispatch(tool_name, params)


@pytest.fixture(autouse=True)
def _isolate_memory(monkeypatch: pytest.MonkeyPatch, client_store: ClientStore) -> None:
    monkeypatch.setattr(memory_manager.ClientStoreRegistry, "get", lambda cid: client_store)


def test_pipeline_resolves_ticket_in_one_iteration_on_happy_path() -> None:
    pipeline = build_pipeline(gateway=_FakeGateway(), dispatch=_happy_dispatch)

    final_state = run_ticket(
        {
            "ticket_id": "T-100",
            "customer_id": "CUST-0001",
            "customer_message": "I need a refund for order ORD-1001, it arrived damaged.",
        },
        pipeline=pipeline,
    )

    assert final_state["resolved"] is True
    assert final_state["escalate"] is False
    assert final_state["iteration"] == 1
    assert {c["tool_name"] for c in final_state["tool_calls_made"]} == {
        "crm",
        "order_lookup",
        "refund",
    }
    assert "Resolved via DAG plan" in final_state["response_message"]


def test_pipeline_replans_after_transient_failure_and_still_resolves() -> None:
    dispatch = _FlakyDispatch()
    pipeline = build_pipeline(gateway=_FakeGateway(), dispatch=dispatch)

    final_state = run_ticket(
        {
            "ticket_id": "T-101",
            "customer_id": "CUST-0002",
            "customer_message": "I need a refund for order ORD-1002, it arrived damaged.",
        },
        pipeline=pipeline,
    )

    assert (
        dispatch.order_lookup_calls == 2
    )  # first call failed, second call (after replan) succeeded
    assert final_state["replanning_count"] == 1
    assert final_state["resolved"] is True
    assert final_state["iteration"] == 2


def test_build_pipeline_default_dispatch_is_the_simulated_tool_adapter() -> None:
    """build_pipeline(dispatch=None) (ENTERPRISE_ARCHITECTURE.md Phase 4) must default to
    SimulatedToolAdapter, not the research-only ToolRegistry — exercised end-to-end here with no
    dispatch override, unlike the other tests in this file which all inject one."""
    pipeline = build_pipeline(gateway=_FakeGateway())

    final_state = run_ticket(
        {
            "ticket_id": "T-103",
            "customer_id": "CUST-0001",
            "customer_message": "I need a refund for order ORD-1001, it arrived damaged.",
        },
        pipeline=pipeline,
    )

    assert final_state["resolved"] is True
    assert {c["tool_name"] for c in final_state["tool_calls_made"]} == {
        "crm",
        "order_lookup",
        "refund",
    }


def test_pipeline_escalates_when_max_iterations_exhausted() -> None:
    pipeline = build_pipeline(gateway=_FakeGateway(), dispatch=_always_fail_order_lookup)

    final_state = run_ticket(
        {
            "ticket_id": "T-102",
            "customer_id": "CUST-0003",
            "customer_message": "I need a refund for order ORD-1003, it arrived damaged.",
        },
        pipeline=pipeline,
    )

    assert final_state["resolved"] is False
    assert final_state["escalate"] is True
    assert "T-102" in final_state["escalation_summary"]
