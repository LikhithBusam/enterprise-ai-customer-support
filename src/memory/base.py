from abc import ABC, abstractmethod
from datetime import datetime
from typing import Generic, TypeVar, Any

from pydantic import BaseModel, Field

class BaseMemoryEntry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)


T = TypeVar("T", bound=BaseMemoryEntry)


class MemoryManager(ABC, Generic[T]):
    @abstractmethod
    def write(self, client_id: str, entry: T) -> str:
        ...

    @abstractmethod
    def retrieve(
        self,
        client_id: str,
        query_text: str,
        query_filter: dict | None = None,
        top_k: int = 5,
        return_distances: bool = False,
    ) -> Any:
        ...

    @abstractmethod
    def prune(self, client_id: str, before: datetime) -> int:
        ...
