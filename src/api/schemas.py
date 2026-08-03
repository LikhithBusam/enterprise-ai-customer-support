"""Versioned request/response contracts for the /v1 ticket-submission endpoint
(ENTERPRISE_ARCHITECTURE.md Phase 2). A `v2` module can be added later without touching this one
once the response shape needs a breaking change.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class TicketRequest(BaseModel):
    ticket_id: str
    customer_id: str
    customer_message: str
    # Mirrors src.models.intake.IntakeInput.intent_label: empty string means "classify it",
    # not "no intent" — kept as str (not str | None) so it passes straight through to
    # run_ticket()'s ticket dict without a None/"" translation step.
    intent_label: str = ""


class TicketResponse(BaseModel):
    ticket_id: str
    resolved: bool
    escalate: bool
    response_message: str
    replanning_count: int
    memory_hit: bool
    iteration: int
    tool_calls_made: list[dict[str, Any]] = Field(default_factory=list)
    # True if this response was served from the idempotency cache instead of reprocessing the
    # ticket — lets a retrying client tell "same result, replayed" from "same result, recomputed".
    replayed: bool = False
