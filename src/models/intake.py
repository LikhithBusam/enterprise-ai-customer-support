from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class IntakeInput(BaseModel):
    ticket_id: str
    customer_id: str
    customer_message: str
    # Optional override — e.g. replaying a pre-labeled research ticket that already carries a
    # dataset intent_label. A real inbound ticket won't have this; intent is classified instead.
    intent_label: str = ""


class IntakeOutput(BaseModel):
    intent: str
    context: dict[str, Any] = Field(default_factory=dict)
    expected_tools: list[str] = Field(default_factory=list)
    # ENTERPRISE_ARCHITECTURE.md Phase 5's prompt-injection filter. `sanitized_message` is what
    # every downstream agent/memory-write should use in place of the raw customer message —
    # src/graph/pipeline.py's intake node feeds it back into PipelineState["customer_message"].
    sanitized_message: str = ""
    prompt_injection_detected: bool = False
