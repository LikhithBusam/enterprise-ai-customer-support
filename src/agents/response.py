"""Response Agent: drafts the customer-facing reply.

Deterministic string formatting — mirrors experiments/memory_augmented_v2.py::_build_response
exactly. No LLM call today, despite "response" being a defined role in
src/core/llm_client.py's default_role_providers: swapping in an LLM-drafted reply later is a
change inside this function, not to the ResponseInput/ResponseOutput contract.
"""

from __future__ import annotations

from src.core.telemetry import span
from src.models.response import ResponseInput, ResponseOutput


def run(input: ResponseInput) -> ResponseOutput:
    with span("agent.response", resolved=input.resolved):
        message = input.ticket_message
        calls = input.tool_calls_made

        if input.resolved:
            used = [c.tool_name for c in calls if c.success]
            return ResponseOutput(
                message=(
                    f"Resolved via DAG plan. Used: {', '.join(used)}. "
                    f"Reference: {message[:80]}{'...' if len(message) > 80 else ''}"
                )
            )

        failures = [c.tool_name for c in calls if not c.success]
        bad_data = [c.tool_name for c in calls if c.success and not c.is_usable]
        details = []
        if failures:
            details.append(f"{len(failures)} tool(s) failed: {', '.join(failures)}")
        if bad_data:
            details.append(f"{len(bad_data)} tool(s) returned bad data: {', '.join(bad_data)}")

        return ResponseOutput(
            message=(
                f"Unable to fully resolve after replanning. {'; '.join(details)}. "
                "Escalating to human agent."
            )
        )
