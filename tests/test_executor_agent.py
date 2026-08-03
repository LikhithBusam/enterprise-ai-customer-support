from __future__ import annotations

from src.agents import executor
from src.core.dag import ExecutionDAG
from src.models.executor import ExecutorInput
from src.tools.registry import ToolResult


def test_dispatches_tools_in_layer_order_and_builds_records() -> None:
    calls: list[str] = []

    def fake_dispatch(tool_name: str, params: dict) -> ToolResult:
        calls.append(tool_name)
        return ToolResult(success=True, tool_name=tool_name, data={"order_id": params.get("order_id", "")})

    dag = ExecutionDAG(layers=[["crm"], ["order_lookup"]])
    output = executor.run(
        ExecutorInput(dag=dag, context={"customer_id": "CUST-0001", "order_id": "ORD-1001"}),
        dispatch=fake_dispatch,
    )

    assert [c.tool_name for c in output.tool_calls_made] == ["crm", "order_lookup"]
    assert calls == ["crm", "order_lookup"]


def test_skips_tool_whose_dependency_has_not_succeeded() -> None:
    def fake_dispatch(tool_name: str, params: dict) -> ToolResult:
        if tool_name == "order_lookup":
            return ToolResult(success=False, tool_name=tool_name, error="timeout")
        return ToolResult(success=True, tool_name=tool_name, data={})

    dag = ExecutionDAG(layers=[["order_lookup"], ["refund"]])
    output = executor.run(
        ExecutorInput(dag=dag, context={"order_id": "ORD-1001", "amount": 10.0}),
        dispatch=fake_dispatch,
    )

    called_tools = [c.tool_name for c in output.tool_calls_made]
    assert "order_lookup" in called_tools
    assert "refund" not in called_tools


def test_already_succeeded_from_prior_iteration_satisfies_dependency() -> None:
    def fake_dispatch(tool_name: str, params: dict) -> ToolResult:
        return ToolResult(
            success=True,
            tool_name=tool_name,
            data={"order_id": params.get("order_id"), "status": "approved", "refund_id": "RFND-1"},
        )

    dag = ExecutionDAG(layers=[["refund"]])
    output = executor.run(
        ExecutorInput(
            dag=dag,
            context={"order_id": "ORD-1001", "amount": 10.0},
            already_succeeded=["order_lookup"],
        ),
        dispatch=fake_dispatch,
    )

    assert [c.tool_name for c in output.tool_calls_made] == ["refund"]


def test_updates_context_from_successful_order_lookup() -> None:
    def fake_dispatch(tool_name: str, params: dict) -> ToolResult:
        return ToolResult(
            success=True,
            tool_name=tool_name,
            data={"order_id": "ORD-1001", "status": "delivered", "total_amount": 42.5},
        )

    dag = ExecutionDAG(layers=[["order_lookup"]])
    output = executor.run(
        ExecutorInput(dag=dag, context={"order_id": "ORD-1001"}), dispatch=fake_dispatch
    )

    assert output.updated_context["amount"] == 42.5
