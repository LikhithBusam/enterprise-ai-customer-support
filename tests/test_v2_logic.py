from __future__ import annotations

import os
import pytest
from src.memory.client_store import ClientStore
from src.memory.tool_failure import ToolFailureMemory
from experiments.memory_augmented_v2 import (
    _classify_failure,
    _abstract_dag_template,
    _compute_tool_reliability,
    CLIENT_ID,
)


def test_classify_failure() -> None:
    # Timeout cases
    t1 = {"success": False, "error": "Request timed out after 30s", "tool_name": "order_lookup"}
    assert _classify_failure(t1) == "timeout"

    t2 = {"success": False, "error": "connection error: host unreachable", "tool_name": "crm"}
    assert _classify_failure(t2) == "timeout"

    # Ambiguous data cases
    a1 = {
        "success": True,
        "tool_name": "order_lookup",
        "data": {"status": "UNKNOWN", "note": "Multiple matching records"},
    }
    assert _classify_failure(a1) == "ambiguous_data"

    # Wrong result cases
    w1 = {
        "success": True,
        "tool_name": "crm",
        "data": {"customer_id": "not_found", "status": "not_found"},
    }
    assert _classify_failure(w1) == "wrong_result"

    w2 = {
        "success": True,
        "tool_name": "order_lookup",
        "data": {"status": "not_found", "message": "No order found"},
    }
    assert _classify_failure(w2) == "wrong_result"


def test_abstract_dag_template() -> None:
    message = "I need a refund of $149.99 for order ORD-1002. My email is customer.care@example.com and customer ID is CUST-0123."
    abstracted = _abstract_dag_template(message)
    assert "ORD-1002" not in abstracted
    assert "CUST-0123" not in abstracted
    assert "customer.care@example.com" not in abstracted
    assert "$149.99" not in abstracted
    assert "{order_id}" in abstracted
    assert "{customer_id}" in abstracted
    assert "{email}" in abstracted
    assert "{amount}" in abstracted


def test_compute_tool_reliability(client_store: ClientStore) -> None:
    # Reliability of a tool with no failures should be 1.0
    assert _compute_tool_reliability(client_store, "refund") == 1.0

    # Write a failure for crm
    client_store.tool_failure.write(
        client_id=CLIENT_ID,
        entry=ToolFailureMemory(
            tool_name="crm",
            failure_type="timeout",
            context="connection lost",
            fix_applied="retry",
        ),
    )

    # Reliability should be less than 1.0
    r1 = _compute_tool_reliability(client_store, "crm")
    assert r1 < 1.0

    # Write another failure for crm
    client_store.tool_failure.write(
        client_id=CLIENT_ID,
        entry=ToolFailureMemory(
            tool_name="crm",
            failure_type="timeout",
            context="connection lost again",
            fix_applied="retry",
        ),
    )

    r2 = _compute_tool_reliability(client_store, "crm")
    assert r2 < r1
