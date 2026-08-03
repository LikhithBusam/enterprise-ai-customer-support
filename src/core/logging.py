"""Structured JSON logging factory for the production (src/) track.

experiments/ keeps its own bare `logging.getLogger(__name__)` calls untouched — this module
is additive and only used by production-track code (src/agents, src/api once they exist).
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone

_RESERVED_RECORD_KEYS = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "message",
    "taskName",
}


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)

        # Any extra=... fields passed to the logging call (e.g. ticket_id, agent, tool_name)
        # ride along as top-level JSON keys for structured querying.
        for key, value in record.__dict__.items():
            if key in _RESERVED_RECORD_KEYS:
                continue
            payload.setdefault(key, value)

        return json.dumps(payload, default=str)


_configured = False


def configure_logging(level: int = logging.INFO) -> None:
    """Configure the root logger for structured JSON output to stdout.

    Idempotent — safe to call multiple times (once from an API entrypoint, once from a
    test fixture) without duplicating handlers.
    """
    global _configured
    if _configured:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
    _configured = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
