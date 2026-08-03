from __future__ import annotations

import random
from typing import Any

from src.tools.registry import ToolResult, roll_failure, timeout_result

TOOL_NAME = "refund"


def _success_payload(order_id: str, amount: float, reason: str) -> dict[str, Any]:
    return {
        "refund_id": f"RFND-{order_id[-4:]}-9281",
        "order_id": order_id,
        "status": "approved",
        "amount": round(amount, 2),
        "currency": "USD",
        "reason": reason,
        "estimated_days": 5,
        "message": "Refund approved and queued for processing",
    }


def _ambiguous_payload(order_id: str, amount: float, reason: str) -> dict[str, Any]:
    return {
        "refund_id": None,
        "order_id": order_id,
        "status": "pending_review",
        "amount": amount,
        "currency": "USD",
        "reason": reason,
        "estimated_days": None,
        "message": "Refund eligibility unclear; additional verification required",
    }


def _wrong_payload(order_id: str, amount: float, reason: str) -> dict[str, Any]:
    wrong_order_id = "ORD-9999" if order_id != "ORD-9999" else "ORD-8888"
    return {
        "refund_id": f"RFND-{wrong_order_id[-4:]}-9281",
        "order_id": wrong_order_id,
        "status": "approved",
        "amount": round(amount * 0.5, 2),
        "currency": "USD",
        "reason": reason,
        "estimated_days": 5,
        "message": "Partial refund approved",
    }


def issue_refund(
    order_id: str,
    amount: float,
    reason: str = "customer request",
    *,
    failure_rate: float = 0.0,
    rng: random.Random | None = None,
) -> ToolResult:
    failure = roll_failure(failure_rate, rng)
    if failure == "timeout":
        return timeout_result(TOOL_NAME)

    if failure == "ambiguous_data":
        return ToolResult(
            success=True,
            tool_name=TOOL_NAME,
            data=_ambiguous_payload(order_id, amount, reason),
            failure_type="ambiguous_data",
        )

    if failure == "wrong_result":
        return ToolResult(
            success=True,
            tool_name=TOOL_NAME,
            data=_wrong_payload(order_id, amount, reason),
            failure_type="wrong_result",
        )

    return ToolResult(
        success=True,
        tool_name=TOOL_NAME,
        data=_success_payload(order_id, amount, reason),
        failure_type=None,
    )
