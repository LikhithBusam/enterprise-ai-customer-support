"""Executor Agent: the only agent that calls tools (AGENTS.md convention — the Planner must
never call tools directly).

Dispatch is injected as a plain callable rather than importing src.tools.registry.ToolRegistry
directly: ToolRegistry.dispatch() bakes `failure_rate`/`rng` into every handler call, which is
synthetic-failure injection for the research harness with no analog for a real backend. This
keeps the Executor decoupled from that signature — src/tools/adapter.py's `ToolAdapter` classes
(ENTERPRISE_ARCHITECTURE.md Phase 4) are the production dispatch sources; any of their `.dispatch`
methods satisfies `DispatchFn` below without this file changing. src/graph/pipeline.py's
build_pipeline() defaults to `SimulatedToolAdapter().dispatch`.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from src.core.dag import TOOL_DEPENDENCIES
from src.core.telemetry import span
from src.models.executor import ExecutorInput, ExecutorOutput, ToolCallRecord
from src.tools.registry import ToolResult

DispatchFn = Callable[[str, dict[str, Any]], ToolResult]


def _prepare_params(tool_name: str, context: dict[str, Any]) -> dict[str, Any]:
    """Mirrors experiments/memory_augmented_v2.py::_prepare_params."""
    if tool_name == "crm":
        return {"customer_id": context.get("customer_id"), "email": context.get("email")}
    if tool_name == "order_lookup":
        return {"order_id": context.get("order_id", "")}
    if tool_name == "refund":
        raw_amount = context.get("amount")
        return {
            "order_id": context.get("order_id", ""),
            "amount": float(raw_amount) if raw_amount is not None else 0.0,
            "reason": context.get("refund_reason", "customer request"),
        }
    if tool_name == "kb_search":
        return {"query": context.get("customer_message", ""), "top_k": 3}
    return {}


def _update_context(tool_name: str, result: ToolResult) -> dict[str, Any]:
    """Mirrors experiments/memory_augmented_v2.py::_update_context."""
    if not result.success or not result.data:
        return {}
    data = result.data
    updated: dict[str, Any] = {}
    if tool_name == "crm":
        if (
            data.get("customer_id")
            and data["customer_id"] != "not_found"
            and data.get("status") not in ("not_found", "UNKNOWN")
        ):
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


def run(input: ExecutorInput, dispatch: DispatchFn) -> ExecutorOutput:
    """Dispatch every tool in the DAG's layers in order, skipping a tool whose dependency (per
    TOOL_DEPENDENCIES) hasn't already produced a usable result — either earlier in this same
    call (a prior layer) or in `input.already_succeeded` (prior iterations of this ticket).
    """
    with span("agent.executor", iteration=input.iteration):
        return _run(input, dispatch)


def _run(input: ExecutorInput, dispatch: DispatchFn) -> ExecutorOutput:
    context = dict(input.context)
    succeeded = set(input.already_succeeded)
    tool_calls_made: list[ToolCallRecord] = []

    for layer in input.dag.layers:
        for tool_name in layer:
            deps = TOOL_DEPENDENCIES.get(tool_name, set())
            if deps and not deps.issubset(succeeded):
                continue

            params = _prepare_params(tool_name, context)
            with span("tool.dispatch", tool_name=tool_name, iteration=input.iteration):
                result = dispatch(tool_name, params)

            record = ToolCallRecord(
                tool_name=tool_name,
                params=params,
                success=result.success,
                error=result.error,
                data=result.data,
                iteration=input.iteration,
            )
            tool_calls_made.append(record)
            context.update(_update_context(tool_name, result))
            if record.is_usable:
                succeeded.add(tool_name)

    return ExecutorOutput(tool_calls_made=tool_calls_made, updated_context=context)
