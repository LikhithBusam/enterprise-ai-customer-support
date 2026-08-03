from __future__ import annotations

import random
from collections.abc import Callable
from typing import Any, Literal

from pydantic import BaseModel

FailureType = Literal["timeout", "ambiguous_data", "wrong_result"]
FAILURE_TYPES: tuple[FailureType, ...] = ("timeout", "ambiguous_data", "wrong_result")


class ToolTimeoutError(Exception):
    pass


class ToolResult(BaseModel):
    success: bool
    tool_name: str
    data: dict[str, Any] | None = None
    error: str | None = None
    failure_type: FailureType | None = None


ToolHandler = Callable[..., ToolResult]


def _rng(rng: random.Random | None) -> random.Random:
    return rng if rng is not None else random.Random()


def roll_failure(
    failure_rate: float,
    rng: random.Random | None = None,
) -> FailureType | None:
    generator = _rng(rng)
    if failure_rate <= 0 or generator.random() >= failure_rate:
        return None
    return generator.choice(FAILURE_TYPES)


def timeout_result(tool_name: str) -> ToolResult:
    return ToolResult(
        success=False,
        tool_name=tool_name,
        error="Upstream service timed out after 30 seconds",
        failure_type="timeout",
    )


_HANDLERS: dict[str, ToolHandler] = {}


def register_tool(name: str, handler: ToolHandler) -> None:
    _HANDLERS[name] = handler


class ToolRegistry:
    def __init__(self, failure_rate: float = 0.0, seed: int | None = None) -> None:
        self.failure_rate = failure_rate
        self._rng = random.Random(seed)

    def list_tools(self) -> list[str]:
        _ensure_handlers_loaded()
        return sorted(_HANDLERS)

    def dispatch(self, tool_name: str, params: dict[str, Any] | None = None) -> ToolResult:
        _ensure_handlers_loaded()
        handler = _HANDLERS.get(tool_name)
        if handler is None:
            return ToolResult(
                success=False,
                tool_name=tool_name,
                error=f"Unknown tool: {tool_name}",
            )
        return handler(
            **(params or {}),
            failure_rate=self.failure_rate,
            rng=self._rng,
        )


_handlers_loaded = False


def _ensure_handlers_loaded() -> None:
    global _handlers_loaded
    if not _handlers_loaded:
        _handlers_loaded = True
        _load_handlers()


def _load_handlers() -> None:
    from src.tools.crm import get_customer
    from src.tools.kb_search import search_kb
    from src.tools.order import lookup_order
    from src.tools.refund import issue_refund

    register_tool("order_lookup", lookup_order)
    register_tool("refund", issue_refund)
    register_tool("crm", get_customer)
    register_tool("kb_search", search_kb)

