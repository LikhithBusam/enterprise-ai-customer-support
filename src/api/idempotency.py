"""Idempotent ticket submission (ENTERPRISE_ARCHITECTURE.md Phase 2): a crash mid-DAG or a
client retry after a dropped response must not re-dispatch tools (e.g. double-issue a refund) or
double-count replanning. Keyed on (client_id, ticket_id) — ticket_id is already the natural
dedup key, no separate Idempotency-Key header needed.

Known limitation, same shape as ClientRateLimiter/the LLM gateway's rate limiter: in-process,
in-memory only. It survives client retries within this process's lifetime but not a process
restart — closing that gap needs a durable store (e.g. persisting to the existing Chroma-backed
EpisodicMemory, or a small SQL table) and is deferred, not solved here.
"""

from __future__ import annotations

import threading
from typing import Any


class IdempotencyCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._store: dict[tuple[str, str], dict[str, Any]] = {}

    def get(self, client_id: str, ticket_id: str) -> dict[str, Any] | None:
        with self._lock:
            return self._store.get((client_id, ticket_id))

    def put(self, client_id: str, ticket_id: str, response: dict[str, Any]) -> None:
        with self._lock:
            self._store[(client_id, ticket_id)] = response
