from src.memory.base import BaseMemoryEntry


class PlanSuccessMemory(BaseMemoryEntry):
    intent_cluster: str
    dag_template: dict
    success_rate: float
    parameterized_message: str = ""
