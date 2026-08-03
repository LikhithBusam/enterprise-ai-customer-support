from src.memory.base import BaseMemoryEntry


class EscalationMemory(BaseMemoryEntry):
    ticket_id: str
    human_correction: str
    original_response: str
