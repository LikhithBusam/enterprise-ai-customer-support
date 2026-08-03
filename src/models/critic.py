from __future__ import annotations

from pydantic import BaseModel, Field

from src.core.dag import ExecutionDAG
from src.models.executor import ToolCallRecord


class CriticInput(BaseModel):
    dag: ExecutionDAG
    # This iteration's tool call results only — mirrors experiments/memory_augmented_v2.py,
    # where the Critic evaluates iteration_results, not the full cross-iteration history.
    results: list[ToolCallRecord] = Field(default_factory=list)
    ticket_message: str = ""
    client_id: str = "default_client"


class CriticOutput(BaseModel):
    resolved: bool
    failed_tools: list[str] = Field(default_factory=list)
    memory_hit: bool = False
    predicted_category: str = ""
    confidence: float = 1.0
    recovery_strategy: str = ""
    # Deliberately NOT included: an "actual_category" field. That's oracle/eval-only metadata
    # experiments/ logs for scoring prediction accuracy after the fact — it has no place in a
    # production Critic's output.
