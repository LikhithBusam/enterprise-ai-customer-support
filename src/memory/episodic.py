from src.memory.base import BaseMemoryEntry


class EpisodicMemory(BaseMemoryEntry):
    ticket_id: str
    intent: str
    plan_dag: dict
    outcome: str
