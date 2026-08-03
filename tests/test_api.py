from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.agents import memory_manager
from src.api.idempotency import IdempotencyCache
from src.api.main import create_app
from src.api.rate_limit import ClientRateLimiter
from src.core.config import Settings
from src.graph.pipeline import build_pipeline
from src.memory.client_store import ClientStore
from src.tools.registry import ToolResult

API_KEY = "test-key-1"
CLIENT_ID = "test_client"


class _FakeGateway:
    def call(self, role: str, messages: list[dict]) -> str:
        if role == "planner":
            return '[["crm"], ["order_lookup"], ["refund"]]'
        raise AssertionError(f"unexpected role: {role}")


class _CountingDispatch:
    def __init__(self) -> None:
        self.calls = 0

    def __call__(self, tool_name: str, params: dict) -> ToolResult:
        self.calls += 1
        if tool_name == "crm":
            return ToolResult(
                success=True,
                tool_name=tool_name,
                data={
                    "customer_id": params.get("customer_id"),
                    "status": "active",
                    "tier": "gold",
                    "lifetime_value": 100.0,
                },
            )
        if tool_name == "order_lookup":
            return ToolResult(
                success=True,
                tool_name=tool_name,
                data={
                    "order_id": params.get("order_id"),
                    "status": "delivered",
                    "total_amount": 42.0,
                },
            )
        if tool_name == "refund":
            return ToolResult(
                success=True,
                tool_name=tool_name,
                data={
                    "refund_id": "RFND-1",
                    "order_id": params.get("order_id"),
                    "status": "approved",
                },
            )
        raise AssertionError(tool_name)


@pytest.fixture(autouse=True)
def _isolate_memory(monkeypatch: pytest.MonkeyPatch, client_store: ClientStore) -> None:
    monkeypatch.setattr(memory_manager.ClientStoreRegistry, "get", lambda cid: client_store)


def _make_client(
    dispatch: _CountingDispatch,
    rate_limit_per_minute: int = 60,
    api_keys: dict[str, str] | None = None,
) -> TestClient:
    pipeline = build_pipeline(gateway=_FakeGateway(), dispatch=dispatch)
    settings = Settings(
        api_keys=api_keys or {API_KEY: CLIENT_ID}, api_rate_limit_per_minute=rate_limit_per_minute
    )
    app = create_app(
        pipeline=pipeline,
        settings=settings,
        rate_limiter=ClientRateLimiter(max_calls=rate_limit_per_minute),
        idempotency_cache=IdempotencyCache(),
    )
    return TestClient(app)


def _ticket_payload(ticket_id: str = "T-200") -> dict:
    return {
        "ticket_id": ticket_id,
        "customer_id": "CUST-0001",
        "customer_message": "I need a refund for order ORD-1001, it arrived damaged.",
    }


def test_health_endpoint_requires_no_auth() -> None:
    client = _make_client(_CountingDispatch())
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_missing_api_key_returns_401() -> None:
    client = _make_client(_CountingDispatch())
    resp = client.post("/v1/tickets", json=_ticket_payload())
    assert resp.status_code == 401


def test_invalid_api_key_returns_401() -> None:
    client = _make_client(_CountingDispatch())
    resp = client.post("/v1/tickets", json=_ticket_payload(), headers={"X-API-Key": "wrong-key"})
    assert resp.status_code == 401


def test_valid_api_key_resolves_ticket() -> None:
    client = _make_client(_CountingDispatch())
    resp = client.post("/v1/tickets", json=_ticket_payload(), headers={"X-API-Key": API_KEY})
    assert resp.status_code == 200
    body = resp.json()
    assert body["resolved"] is True
    assert body["escalate"] is False
    assert body["replayed"] is False
    assert {c["tool_name"] for c in body["tool_calls_made"]} == {"crm", "order_lookup", "refund"}


def test_idempotent_resubmission_does_not_reprocess() -> None:
    dispatch = _CountingDispatch()
    client = _make_client(dispatch)
    headers = {"X-API-Key": API_KEY}
    payload = _ticket_payload("T-201")

    first = client.post("/v1/tickets", json=payload, headers=headers)
    assert first.status_code == 200
    assert first.json()["replayed"] is False
    calls_after_first = dispatch.calls
    assert calls_after_first > 0

    second = client.post("/v1/tickets", json=payload, headers=headers)
    assert second.status_code == 200
    assert second.json()["replayed"] is True
    assert second.json()["resolved"] == first.json()["resolved"]
    assert dispatch.calls == calls_after_first  # no new tool dispatches on replay


def test_rate_limit_exceeded_returns_429() -> None:
    client = _make_client(_CountingDispatch(), rate_limit_per_minute=1)
    headers = {"X-API-Key": API_KEY}

    first = client.post("/v1/tickets", json=_ticket_payload("T-202"), headers=headers)
    assert first.status_code == 200

    second = client.post("/v1/tickets", json=_ticket_payload("T-203"), headers=headers)
    assert second.status_code == 429
