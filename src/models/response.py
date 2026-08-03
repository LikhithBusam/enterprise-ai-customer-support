from __future__ import annotations

from pydantic import BaseModel, Field

from src.models.executor import ToolCallRecord


class ResponseInput(BaseModel):
    ticket_message: str
    tool_calls_made: list[ToolCallRecord] = Field(default_factory=list)
    resolved: bool


class ResponseOutput(BaseModel):
    message: str
