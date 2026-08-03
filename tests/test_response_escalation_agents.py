from __future__ import annotations

from src.agents import escalation, response
from src.models.escalation import EscalationInput
from src.models.executor import ToolCallRecord
from src.models.response import ResponseInput


def _usable_call(tool_name: str) -> ToolCallRecord:
    return ToolCallRecord(tool_name=tool_name, success=True, data={"status": "ok"}, iteration=1)


def test_response_resolved_message_lists_used_tools() -> None:
    output = response.run(
        ResponseInput(ticket_message="refund please", tool_calls_made=[_usable_call("crm")], resolved=True)
    )
    assert "Resolved via DAG plan" in output.message
    assert "crm" in output.message


def test_response_unresolved_message_lists_failures() -> None:
    failed = ToolCallRecord(tool_name="order_lookup", success=False, error="timeout", iteration=1)
    output = response.run(
        ResponseInput(ticket_message="refund please", tool_calls_made=[failed], resolved=False)
    )
    assert "Unable to fully resolve" in output.message
    assert "order_lookup" in output.message


def test_escalation_no_escalate_when_resolved() -> None:
    output = escalation.run(
        EscalationInput(ticket_id="T-1", ticket_message="msg", tool_calls_made=[], resolved=True)
    )
    assert output.escalate is False
    assert output.summary == ""


def test_escalation_summarizes_failed_tools_when_unresolved() -> None:
    failed = ToolCallRecord(tool_name="refund", success=False, error="timeout", iteration=1)
    output = escalation.run(
        EscalationInput(
            ticket_id="T-2", ticket_message="please refund me", tool_calls_made=[failed], resolved=False
        )
    )
    assert output.escalate is True
    assert "refund" in output.summary
    assert "T-2" in output.summary
