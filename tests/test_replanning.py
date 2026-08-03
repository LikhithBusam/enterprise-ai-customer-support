from __future__ import annotations

from unittest.mock import patch

import pytest

from src.agents import critic_replanner, memory_manager
from src.core.config import Settings
from src.core.dag import ExecutionDAG
from src.core.llm_client import LLMProviderGateway
from src.graph.pipeline import MAX_ITERATIONS, _route_after_critic
from src.memory.tool_failure import ToolFailureMemory
from src.models.critic import CriticInput
from src.models.executor import ToolCallRecord


def _record(tool_name: str, success: bool, data: dict | None = None, params: dict | None = None) -> ToolCallRecord:
    return ToolCallRecord(tool_name=tool_name, success=success, data=data, params=params or {}, iteration=1)


def test_critic_resolves_when_all_results_usable() -> None:
    dag = ExecutionDAG(layers=[["order_lookup"]])
    results = [
        _record(
            "order_lookup",
            True,
            data={"order_id": "ORD-1001", "status": "delivered"},
            params={"order_id": "ORD-1001"},
        )
    ]

    output = critic_replanner.run(CriticInput(dag=dag, results=results, client_id="test_client"))

    assert output.resolved is True
    assert output.failed_tools == []


def test_critic_triggers_replan_on_failed_tool_without_memory(monkeypatch: pytest.MonkeyPatch) -> None:
    dag = ExecutionDAG(layers=[["order_lookup"]])
    results = [_record("order_lookup", False, data=None, params={"order_id": "ORD-9999"})]

    monkeypatch.setattr(memory_manager, "retrieve_tool_failure", lambda **kwargs: [])

    output = critic_replanner.run(
        CriticInput(dag=dag, results=results, client_id="test_client"),
        settings=Settings(use_llm=False),
    )

    assert output.resolved is False
    assert output.failed_tools == ["order_lookup"]
    assert output.predicted_category == "timeout"
    assert output.memory_hit is False


def test_critic_applies_stored_recovery_strategy_on_memory_hit(monkeypatch: pytest.MonkeyPatch) -> None:
    dag = ExecutionDAG(layers=[["order_lookup"]])
    results = [
        _record("order_lookup", True, data={"status": "UNKNOWN"}, params={"order_id": "ORD-1001"})
    ]

    stored = ToolFailureMemory(
        tool_name="order_lookup",
        failure_type="ambiguous_data",
        context="past ticket",
        fix_applied="disambiguate",
        recovery_strategy="disambiguate",
        confidence=0.9,
    )
    monkeypatch.setattr(memory_manager, "retrieve_tool_failure", lambda **kwargs: [stored])

    with patch.object(LLMProviderGateway, "call") as mock_call:
        output = critic_replanner.run(CriticInput(dag=dag, results=results, client_id="test_client"))

    mock_call.assert_not_called()  # a memory hit must short-circuit the LLM replan call
    assert output.resolved is False
    assert output.memory_hit is True
    assert output.recovery_strategy == "disambiguate"
    assert output.confidence == 0.9


def test_route_after_critic_finalizes_when_no_pending_tools() -> None:
    assert _route_after_critic({"pending_tools": [], "iteration": 1}) == "finalize"


def test_route_after_critic_replans_when_tools_pending_and_under_max_iterations() -> None:
    assert _route_after_critic({"pending_tools": ["order_lookup"], "iteration": 1}) == "replan"


def test_route_after_critic_finalizes_at_max_iterations_even_with_pending_tools() -> None:
    state = {"pending_tools": ["order_lookup"], "iteration": MAX_ITERATIONS}
    assert _route_after_critic(state) == "finalize"
