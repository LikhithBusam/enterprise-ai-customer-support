from src.memory.base import BaseMemoryEntry


class ToolFailureMemory(BaseMemoryEntry):
    tool_name: str
    failure_type: str
    context: str
    fix_applied: str
    recovery_strategy: str = ""
    confidence: float = 0.0
