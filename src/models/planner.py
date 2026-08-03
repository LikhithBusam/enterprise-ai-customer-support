from __future__ import annotations

from pydantic import BaseModel

from src.core.dag import ExecutionDAG


class PlannerInput(BaseModel):
    pending_tools: list[str]
    ticket_message: str
    intent: str = "unknown"
    client_id: str = "default_client"


class PlannerOutput(BaseModel):
    dag: ExecutionDAG
    memory_hit: bool = False
    retrieval_distance: float | None = None
