from __future__ import annotations

from datetime import datetime
from typing import Generic, Any
from uuid import uuid4

import chromadb

from src.core import config
from src.memory.base import MemoryManager, T
from src.memory.episodic import EpisodicMemory
from src.memory.escalation_memory import EscalationMemory
from src.memory.plan_success import PlanSuccessMemory
from src.memory.tool_failure import ToolFailureMemory


class ChromaStore(MemoryManager[T]):
    def __init__(
        self, chroma_client: chromadb.Client, client_id: str, entry_type: type[T], suffix: str
    ) -> None:
        self._client_id = client_id
        self._collection = chroma_client.get_or_create_collection(
            name=f"{client_id}_{suffix}",
        )
        self._entry_type = entry_type

    def write(self, client_id: str, entry: T) -> str:
        entry_id = f"{client_id}_{uuid4().hex}"
        self._collection.add(
            ids=[entry_id],
            documents=[entry.model_dump_json()],
            metadatas=[
                {
                    "client_id": client_id,
                    "timestamp": entry.timestamp.isoformat(),
                    "timestamp_epoch": entry.timestamp.timestamp(),
                }
            ],
        )
        return entry_id

    def _build_where(self, client_id: str, query_filter: dict) -> dict:
        conditions: list[dict] = [{"client_id": client_id}]
        for key, value in query_filter.items():
            conditions.append({key: value})
        if len(conditions) == 1:
            return conditions[0]
        return {"$and": conditions}

    def retrieve(
        self,
        client_id: str,
        query_text: str,
        query_filter: dict | None = None,
        top_k: int = 5,
        return_distances: bool = False,
    ) -> Any:
        where = self._build_where(client_id, query_filter or {})

        results = self._collection.query(
            query_texts=[query_text],
            n_results=top_k,
            where=where,
        )

        entries: list[T] = []
        for doc in results.get("documents", [[]])[0] or []:
            entries.append(self._entry_type.model_validate_json(doc))

        if return_distances:
            distances = results.get("distances", [[]])[0] or []
            return entries, distances
        return entries

    def count(self) -> int:
        """Entry count for this client+memory-type collection — used by
        src/core/telemetry.py's per-client memory-size gauge (ENTERPRISE_ARCHITECTURE.md Phase 3).
        No client_id filter needed: the collection is already scoped to one client (see __init__'s
        `f"{client_id}_{suffix}"` naming).
        """
        return self._collection.count()

    def prune(self, client_id: str, before: datetime) -> int:
        where: dict = {
            "$and": [
                {"client_id": client_id},
                {"timestamp_epoch": {"$lt": before.timestamp()}},
            ],
        }
        results = self._collection.get(where=where)
        ids: list[str] = results.get("ids") or []
        if ids:
            self._collection.delete(ids=ids)
        return len(ids)


class ClientStore:
    def __init__(self, chroma_client: chromadb.Client, client_id: str) -> None:
        self.episodic = ChromaStore(chroma_client, client_id, EpisodicMemory, "episodic")
        self.tool_failure = ChromaStore(chroma_client, client_id, ToolFailureMemory, "tool_failure")
        self.plan_success = ChromaStore(chroma_client, client_id, PlanSuccessMemory, "plan_success")
        self.escalation = ChromaStore(chroma_client, client_id, EscalationMemory, "escalation")


class ClientStoreRegistry:
    _client: chromadb.Client | None = None
    _stores: dict[str, ClientStore] = {}

    @classmethod
    def get_client(cls) -> chromadb.Client:
        if cls._client is None:
            cls._client = chromadb.PersistentClient(path=str(config.CHROMA_PERSIST_DIR))
        return cls._client

    @classmethod
    def get(cls, client_id: str) -> ClientStore:
        if client_id not in cls._stores:
            cls._stores[client_id] = ClientStore(cls.get_client(), client_id)
        return cls._stores[client_id]

    @classmethod
    def snapshot(cls) -> dict[str, ClientStore]:
        """All ClientStores instantiated so far in this process — used by
        src/core/telemetry.py's memory-size gauge callback. Necessarily incomplete: a client with
        no in-process activity since the last restart won't appear (there is no separate registry
        of "all known client_ids", only "clients touched this process").
        """
        return dict(cls._stores)
