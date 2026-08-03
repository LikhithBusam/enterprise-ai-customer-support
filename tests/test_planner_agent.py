from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from src.agents import memory_manager, planner
from src.core.config import Settings
from src.models.planner import PlannerInput


def test_abstract_ticket_message_strips_identifiers() -> None:
    msg = "Refund $50.00 for order ORD-1002, customer CUST-0005, contact a@b.com"
    abstracted = planner.abstract_ticket_message(msg)
    assert "ORD-1002" not in abstracted
    assert "CUST-0005" not in abstracted
    assert "a@b.com" not in abstracted
    assert "$50.00" not in abstracted


def test_deterministic_fallback_when_llm_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(memory_manager, "retrieve_plan_templates", lambda **kwargs: ([], None))

    output = planner.run(
        PlannerInput(pending_tools=["crm", "order_lookup"], ticket_message="hi", client_id="c1"),
        settings=Settings(use_llm=False),
    )

    assert output.dag.layers == [["crm"], ["order_lookup"]]


def test_llm_plan_is_filtered_to_pending_tools(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(memory_manager, "retrieve_plan_templates", lambda **kwargs: ([], None))
    monkeypatch.setattr(memory_manager, "compute_tool_reliability", lambda *a, **k: 1.0)

    gateway = MagicMock()
    gateway.call.return_value = '[["crm"], ["order_lookup"], ["refund"]]'

    output = planner.run(
        PlannerInput(pending_tools=["crm", "order_lookup"], ticket_message="refund please", client_id="c1"),
        gateway=gateway,
    )

    # "refund" is dropped: it isn't in pending_tools even though the LLM's plan included it.
    assert output.dag.layers == [["crm"], ["order_lookup"], []]


def test_falls_back_to_deterministic_plan_on_unparsable_llm_output(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(memory_manager, "retrieve_plan_templates", lambda **kwargs: ([], None))
    monkeypatch.setattr(memory_manager, "compute_tool_reliability", lambda *a, **k: 1.0)

    gateway = MagicMock()
    gateway.call.return_value = "not valid json"

    output = planner.run(
        PlannerInput(pending_tools=["crm"], ticket_message="refund please", client_id="c1"),
        gateway=gateway,
    )

    assert output.dag.layers == [["crm"]]
