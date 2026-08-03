"""Per-client inbound rate limiting — traffic shaping at the API layer, distinct from
src/core/llm_client.py's per-*provider* `_SlidingWindowRateLimiter` (that one throttles outbound
LLM calls by sleeping; this one throttles inbound requests by rejecting with 429).

Known limitation, same shape as the LLM gateway's: in-process, in-memory state. A production
service running more than one worker process needs a shared limiter (e.g. Redis token bucket) —
see ENTERPRISE_ARCHITECTURE.md §3/Phase 7. The v1 API service is a single worker process.
"""

from __future__ import annotations

import threading
import time


class ClientRateLimiter:
    def __init__(self, max_calls: int, window_seconds: float = 60.0) -> None:
        self.max_calls = max_calls
        self.window_seconds = window_seconds
        self._lock = threading.Lock()
        self._timestamps: dict[str, list[float]] = {}

    def allow(self, client_id: str) -> bool:
        """Non-blocking: returns False instead of sleeping, so the caller can return 429."""
        with self._lock:
            now = time.monotonic()
            cutoff = now - self.window_seconds
            timestamps = self._timestamps.setdefault(client_id, [])
            timestamps[:] = [t for t in timestamps if t > cutoff]

            if len(timestamps) >= self.max_calls:
                return False

            timestamps.append(now)
            return True
