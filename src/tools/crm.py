from __future__ import annotations

import random
from typing import Any

from src.tools.registry import ToolResult, roll_failure, timeout_result

TOOL_NAME = "crm"

_FIRST_NAMES = [
    "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason",
    "Isabella", "James", "Mia", "Benjamin", "Charlotte", "Lucas", "Amelia",
    "Henry", "Harper", "Alexander", "Evelyn", "Daniel",
]
_LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
]
_TIERS = ["bronze", "silver", "gold", "platinum"]


def _build_customers() -> dict[str, dict[str, Any]]:
    customers: dict[str, dict[str, Any]] = {}
    for i in range(1, 201):
        cid = f"CUST-{i:04d}"
        first = _FIRST_NAMES[(i - 1) % len(_FIRST_NAMES)]
        last = _LAST_NAMES[((i - 1) // len(_FIRST_NAMES)) % len(_LAST_NAMES)]
        email = f"{first.lower()}.{last.lower()}{i}@example.com"
        tier = _TIERS[(i - 1) % len(_TIERS)]
        ltv = round(50.0 + (i * 17.3) % 4950.0, 2)
        open_tickets = (i * 7) % 4
        day = 15 + (i % 14)
        customers[cid] = {
            "customer_id": cid,
            "email": email,
            "name": f"{first} {last}",
            "tier": tier,
            "lifetime_value": ltv,
            "open_tickets": open_tickets,
            "last_contact": f"2024-0{6 - (i % 3)}-{day:02d}T10:{(i * 3) % 60:02d}:00Z",
        }
    return customers


_CUSTOMERS = _build_customers()
_EMAIL_INDEX = {profile["email"]: profile for profile in _CUSTOMERS.values()}


def _resolve_customer(customer_id: str | None = None, email: str | None = None) -> dict[str, Any] | None:
    if customer_id:
        return _CUSTOMERS.get(customer_id)
    if email:
        return _EMAIL_INDEX.get(email)
    return None


def _success_payload(customer_id: str | None, email: str | None) -> dict[str, Any]:
    customer = _resolve_customer(customer_id, email)
    if customer is None:
        return {
            "customer_id": customer_id,
            "email": email,
            "status": "not_found",
            "message": "No matching customer profile",
        }
    return dict(customer)


def _ambiguous_payload(customer_id: str | None, email: str | None) -> dict[str, Any]:
    return {
        "customer_id": customer_id,
        "email": email,
        "name": "J. Doe",
        "tier": "unknown",
        "lifetime_value": None,
        "open_tickets": "unclear",
        "last_contact": None,
        "message": "Multiple profiles matched the provided identifiers",
    }


def _wrong_payload(customer_id: str | None, email: str | None) -> dict[str, Any]:
    resolved = _resolve_customer(customer_id, email)
    other = None
    for profile in _CUSTOMERS.values():
        if resolved is None or profile["customer_id"] != resolved["customer_id"]:
            other = profile
            break
    if other is None:
        other = next(iter(_CUSTOMERS.values()))
    return dict(other)


def get_customer(
    customer_id: str | None = None,
    email: str | None = None,
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
            data=_ambiguous_payload(customer_id, email),
            failure_type="ambiguous_data",
        )

    if failure == "wrong_result":
        return ToolResult(
            success=True,
            tool_name=TOOL_NAME,
            data=_wrong_payload(customer_id, email),
            failure_type="wrong_result",
        )

    return ToolResult(
        success=True,
        tool_name=TOOL_NAME,
        data=_success_payload(customer_id, email),
        failure_type=None,
    )
