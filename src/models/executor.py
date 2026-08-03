from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from src.core.dag import ExecutionDAG


class ToolCallRecord(BaseModel):
    tool_name: str
    params: dict[str, Any] = Field(default_factory=dict)
    success: bool
    error: str | None = None
    data: dict[str, Any] | None = None
    iteration: int
    # Deliberately NOT stored: ToolResult.failure_type. That field is oracle/eval-only metadata
    # (see AGENTS.md "What NOT to do") — carrying it into the production tool-call record would
    # make it available to is_usable/Critic code below, which must only ever reason from
    # success/data/error.

    @property
    def is_usable(self) -> bool:
        """True if this call produced data the pipeline can act on — used for dependency
        gating (Executor) and the resolved/replan decision (Critic), entirely from
        success/data/error/params. Never reads failure_type.

        This is deliberately more thorough than experiments/memory_augmented_v2.py's
        `_tool_has_bad_data`, which partially relies on reading `failure_type` to catch cases
        (e.g. crm's ambiguous_data payload, or any tool's wrong_result payload) that have no
        `status` marker. Every synthetic failure payload in src/tools/*.py turns out to differ
        from its success payload in an inspectable way — an echoed identifier that doesn't
        match the request, a null/"unknown" field, or an added "message" key — so this checks
        those signals directly instead of leaning on the oracle field. See
        ENTERPRISE_ARCHITECTURE.md for the source of this rule.
        """
        if not self.success:
            return False
        data = self.data or {}

        if self.tool_name == "crm":
            customer_id = data.get("customer_id")
            if not customer_id or customer_id == "not_found":
                return False
            if data.get("status") in ("not_found", "UNKNOWN"):
                return False
            if data.get("tier") == "unknown" or data.get("lifetime_value") is None:
                return False
            requested = self.params.get("customer_id")
            if requested and customer_id != requested:
                return False
            return True

        if self.tool_name == "order_lookup":
            order_id = data.get("order_id")
            if not order_id:
                return False
            if data.get("status") in ("not_found", "UNKNOWN"):
                return False
            requested = self.params.get("order_id")
            if requested and order_id != requested:
                return False
            return True

        if self.tool_name == "refund":
            if data.get("status") != "approved" or not data.get("refund_id"):
                return False
            requested = self.params.get("order_id")
            if requested and data.get("order_id") != requested:
                return False
            return True

        if self.tool_name == "kb_search":
            if data.get("result_count") is None:
                return False
            if "message" in data:
                return False
            return True

        return True


class ExecutorInput(BaseModel):
    dag: ExecutionDAG
    context: dict[str, Any] = Field(default_factory=dict)
    # Tool names that already have a usable result from a prior iteration of this same ticket —
    # used for cross-iteration dependency gating (e.g. refund depends on order_lookup).
    already_succeeded: list[str] = Field(default_factory=list)
    iteration: int = 1


class ExecutorOutput(BaseModel):
    tool_calls_made: list[ToolCallRecord] = Field(default_factory=list)
    updated_context: dict[str, Any] = Field(default_factory=dict)
