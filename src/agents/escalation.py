"""Escalation Agent: decides human handoff and summarizes the ticket for a human agent.

Does not write to EscalationMemory here — that schema requires a `human_correction`
(src/memory/escalation_memory.py), which only exists once a human actually responds. AGENTS.md's
Current Status still lists "Escalation Agent + human feedback loop" as an open TODO; writing
EscalationMemory is that future feedback-loop work, not an oversight in this module.
"""

from __future__ import annotations

from src.core.telemetry import span
from src.models.escalation import EscalationInput, EscalationOutput


def run(input: EscalationInput) -> EscalationOutput:
    with span("agent.escalation", ticket_id=input.ticket_id):
        if input.resolved:
            return EscalationOutput(escalate=False)

        failed_tools = sorted(
            {c.tool_name for c in input.tool_calls_made if not c.success or not c.is_usable}
        )
        summary = (
            f"Ticket {input.ticket_id} could not be auto-resolved. "
            f"Failed/ambiguous tools: {', '.join(failed_tools) or 'none'}. "
            f"Original message: {input.ticket_message[:200]}"
        )
        return EscalationOutput(escalate=True, summary=summary)
