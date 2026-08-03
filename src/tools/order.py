from __future__ import annotations

import random
from typing import Any

from src.tools.registry import ToolResult, roll_failure, timeout_result

TOOL_NAME = "order_lookup"

_SKUS = [
    ("WIDGET-01", "Smart Widget Pro", 149.99),
    ("CABLE-09", "USB-C Cable 6ft", 14.99),
    ("MOUSE-M1", "Wireless Mouse M1", 39.99),
    ("STAND-02", "Laptop Stand Adjustable", 59.99),
    ("KB-10", "Mechanical Keyboard K10", 129.99),
    ("HDMI-21", "HDMI 2.1 Cable 10ft", 24.99),
    ("WEBCAM-4K", "Webcam 4K Ultra", 199.99),
    ("SPKR-MINI", "Bluetooth Speaker Mini", 49.99),
    ("PHONE-GRIP", "Phone Grip Stand", 12.99),
    ("DESK-ORG", "Desk Organizer Large", 34.99),
    ("MONITOR-LB", "Monitor Light Bar", 89.99),
    ("PWR-BANK", "Power Bank 20000mAh", 59.99),
    ("EARBUDS-NC", "Noise Cancelling Earbuds", 79.99),
    ("MPAD-EXT", "Mouse Pad Extended", 19.99),
    ("SLEEVE-15", "Laptop Sleeve 15-inch", 29.99),
]
_STATUSES = ["delivered", "shipped", "processing", "pending"]
_STREETS = [
    "123 Main St", "456 Oak Ave", "789 Pine Rd", "321 Elm Dr", "654 Maple Ct",
    "987 Cedar Ln", "111 Birch Blvd", "222 Walnut Way", "333 Cherry St",
    "444 Spruce Ave", "555 Ash Dr", "666 Willow Ln", "777 Poplar Ct",
    "888 Hickory Blvd", "999 Sycamore Way",
]
_CITIES = [
    "Austin, TX", "Denver, CO", "Portland, OR", "Seattle, WA",
    "Chicago, IL", "Boston, MA", "Atlanta, GA", "Phoenix, AZ",
    "Minneapolis, MN", "Raleigh, NC", "Nashville, TN", "Dallas, TX",
    "San Diego, CA", "Tampa, FL", "Richmond, VA",
]


def _build_orders() -> dict[str, dict[str, Any]]:
    orders: dict[str, dict[str, Any]] = {}
    # Must stay >= the dataset's max order ID (ORD-1049)
    for i in range(1, 61):
        oid = f"ORD-{1000 + i}"
        customer_num = (i * 7) % 200 + 1
        sku_idx = (i - 1) % len(_SKUS)
        sku, name, price = _SKUS[sku_idx]
        qty = (i % 3) + 1
        amount = round(price * qty, 2)
        status = _STATUSES[(i - 1) % len(_STATUSES)]
        placed_day = 1 + ((i - 1) * 5) % 28
        placed_month = 5 + ((i - 1) // 10)
        placed_at = f"2024-{placed_month:02d}-{placed_day:02d}T{8 + (i % 10):02d}:{(i * 7) % 60:02d}:00Z"
        delivered_at: str | None = None
        if status == "delivered":
            del_day = placed_day + 3 + (i % 5)
            delivered_at = f"2024-{placed_month:02d}-{del_day:02d}T{(i * 3) % 12 + 8:02d}:{(i * 11) % 60:02d}:00Z"

        street = _STREETS[(i - 1) % len(_STREETS)]
        city = _CITIES[(i - 1) % len(_CITIES)]
        zipcode = f"{10000 + (i * 123) % 90000:05d}"

        orders[oid] = {
            "order_id": oid,
            "customer_id": f"CUST-{customer_num:04d}",
            "status": status,
            "placed_at": placed_at,
            "delivered_at": delivered_at,
            "total_amount": amount,
            "currency": "USD",
            "items": [
                {"sku": sku, "name": name, "quantity": qty, "price": price},
            ],
            "shipping_address": f"{street}, {city} {zipcode}",
        }
    return orders


_ORDERS = _build_orders()


def _success_payload(order_id: str) -> dict[str, Any]:
    order = _ORDERS.get(order_id)
    if order is None:
        return {
            "order_id": order_id,
            "status": "not_found",
            "message": f"No order found for id {order_id}",
        }
    return dict(order)


def _ambiguous_payload(order_id: str) -> dict[str, Any]:
    return {
        "order_id": order_id,
        "status": "UNKNOWN",
        "status_detail": "PENDING_REVIEW",
        "placed_at": None,
        "delivered_at": None,
        "total_amount": "N/A",
        "items": [],
        "note": "Multiple matching records found; manual review required",
    }


def _wrong_payload(order_id: str) -> dict[str, Any]:
    other_id = next(key for key in _ORDERS if key != order_id)
    return dict(_ORDERS[other_id])


def lookup_order(
    order_id: str,
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
            data=_ambiguous_payload(order_id),
            failure_type="ambiguous_data",
        )

    if failure == "wrong_result":
        return ToolResult(
            success=True,
            tool_name=TOOL_NAME,
            data=_wrong_payload(order_id),
            failure_type="wrong_result",
        )

    return ToolResult(
        success=True,
        tool_name=TOOL_NAME,
        data=_success_payload(order_id),
        failure_type=None,
    )
