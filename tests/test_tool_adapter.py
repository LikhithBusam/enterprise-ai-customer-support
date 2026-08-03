from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import httpx
import pytest
import stripe

from src.tools.adapter import (
    CrmBackend,
    KbSearchBackend,
    OrderBackend,
    RealToolAdapter,
    RefundBackend,
    SimulatedToolAdapter,
)


class TestSimulatedToolAdapter:
    def test_crm_dispatch_returns_a_usable_result(self) -> None:
        adapter = SimulatedToolAdapter()
        result = adapter.dispatch("crm", {"customer_id": "CUST-0001"})
        assert result.success is True
        assert result.tool_name == "crm"
        assert result.data["customer_id"] == "CUST-0001"
        assert result.failure_type is None  # failure_rate=0.0 default

    def test_order_lookup_dispatch(self) -> None:
        adapter = SimulatedToolAdapter()
        result = adapter.dispatch("order_lookup", {"order_id": "ORD-1001"})
        assert result.success is True
        assert result.data["order_id"] == "ORD-1001"

    def test_refund_dispatch(self) -> None:
        adapter = SimulatedToolAdapter()
        result = adapter.dispatch(
            "refund", {"order_id": "ORD-1001", "amount": 42.0, "reason": "damaged"}
        )
        assert result.success is True
        assert result.data["status"] == "approved"

    def test_kb_search_dispatch(self) -> None:
        adapter = SimulatedToolAdapter()
        result = adapter.dispatch("kb_search", {"query": "refund policy", "top_k": 2})
        assert result.success is True
        assert result.data["result_count"] >= 0

    def test_unknown_tool_returns_failed_result_not_an_exception(self) -> None:
        adapter = SimulatedToolAdapter()
        result = adapter.dispatch("not_a_real_tool", {})
        assert result.success is False
        assert "Unknown tool" in result.error

    def test_nonzero_failure_rate_can_still_synthesize_a_failure(self) -> None:
        adapter = SimulatedToolAdapter(failure_rate=1.0, seed=1)
        result = adapter.dispatch("order_lookup", {"order_id": "ORD-1001"})
        # At failure_rate=1.0 every call synthesizes a failure of some kind.
        assert not result.success or result.failure_type is not None


class TestCrmBackend:
    def test_missing_api_key_fails_closed(self) -> None:
        backend = CrmBackend(api_key=None)
        result = backend.call({"customer_id": "cus_123"})
        assert result.success is False
        assert "STRIPE_API_KEY" in result.error

    def test_missing_identifiers_fails_closed(self) -> None:
        backend = CrmBackend(api_key="sk_test_x")
        result = backend.call({})
        assert result.success is False
        assert "customer_id or email" in result.error

    def test_retrieve_by_customer_id_maps_stripe_fields(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        fake_customer = {
            "id": "cus_123",
            "email": "a@example.com",
            "name": "Ada Lovelace",
            "metadata": {
                "tier": "gold",
                "lifetime_value": "1234.5",
                "open_tickets": "1",
                "last_contact": "2024-01-01",
            },
        }
        monkeypatch.setattr(
            stripe.Customer, "retrieve", lambda customer_id, api_key=None: fake_customer
        )
        backend = CrmBackend(api_key="sk_test_x")
        result = backend.call({"customer_id": "cus_123"})
        assert result.success is True
        assert result.data["customer_id"] == "cus_123"
        assert result.data["tier"] == "gold"
        assert result.data["lifetime_value"] == 1234.5

    def test_not_found_customer_returns_success_with_not_found_status(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            stripe.Customer,
            "list",
            lambda email=None, limit=1, api_key=None: SimpleNamespace(data=[]),
        )
        backend = CrmBackend(api_key="sk_test_x")
        result = backend.call({"email": "nobody@example.com"})
        assert result.success is True
        assert result.data["status"] == "not_found"

    def test_stripe_error_returns_failed_result_not_an_exception(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def _raise(customer_id: str, api_key: str | None = None) -> Any:
            raise stripe.error.StripeError("boom")

        monkeypatch.setattr(stripe.Customer, "retrieve", _raise)
        backend = CrmBackend(api_key="sk_test_x")
        result = backend.call({"customer_id": "cus_123"})
        assert result.success is False
        assert "boom" in result.error


class TestOrderBackend:
    def test_missing_api_key_fails_closed(self) -> None:
        backend = OrderBackend(api_key=None)
        result = backend.call({"order_id": "pi_123"})
        assert result.success is False
        assert "STRIPE_API_KEY" in result.error

    def test_missing_order_id_fails_closed(self) -> None:
        backend = OrderBackend(api_key="sk_test_x")
        result = backend.call({})
        assert result.success is False
        assert "order_id" in result.error

    def test_retrieve_maps_payment_intent_fields(self, monkeypatch: pytest.MonkeyPatch) -> None:
        fake_intent = {
            "id": "pi_123",
            "customer": "cus_123",
            "status": "succeeded",
            "created": 1_700_000_000,
            "amount": 4999,
            "currency": "usd",
            "shipping": {
                "address": {"line1": "123 Main St", "city": "Austin", "postal_code": "78701"}
            },
        }
        monkeypatch.setattr(
            stripe.PaymentIntent, "retrieve", lambda order_id, api_key=None: fake_intent
        )
        backend = OrderBackend(api_key="sk_test_x")
        result = backend.call({"order_id": "pi_123"})
        assert result.success is True
        assert result.data["order_id"] == "pi_123"
        assert result.data["status"] == "succeeded"
        assert result.data["total_amount"] == 49.99
        assert "Austin" in result.data["shipping_address"]

    def test_stripe_error_returns_failed_result_not_an_exception(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def _raise(order_id: str, api_key: str | None = None) -> Any:
            raise stripe.error.StripeError("not found")

        monkeypatch.setattr(stripe.PaymentIntent, "retrieve", _raise)
        backend = OrderBackend(api_key="sk_test_x")
        result = backend.call({"order_id": "pi_missing"})
        assert result.success is False
        assert "not found" in result.error


class TestRefundBackend:
    def test_missing_api_key_fails_closed(self) -> None:
        backend = RefundBackend(api_key=None)
        result = backend.call({"order_id": "pi_123", "amount": 10.0})
        assert result.success is False
        assert "STRIPE_API_KEY" in result.error

    def test_missing_required_params_fails_closed(self) -> None:
        backend = RefundBackend(api_key="sk_test_x")
        result = backend.call({"order_id": "pi_123"})
        assert result.success is False
        assert "amount" in result.error

    def test_create_maps_refund_fields(self, monkeypatch: pytest.MonkeyPatch) -> None:
        fake_refund = {
            "id": "re_123",
            "payment_intent": "pi_123",
            "status": "succeeded",
            "amount": 4200,
            "currency": "usd",
        }
        monkeypatch.setattr(stripe.Refund, "create", lambda **kwargs: fake_refund)
        backend = RefundBackend(api_key="sk_test_x")
        result = backend.call({"order_id": "pi_123", "amount": 42.0, "reason": "damaged"})
        assert result.success is True
        assert result.data["refund_id"] == "re_123"
        assert result.data["status"] == "approved"
        assert result.data["amount"] == 42.0
        assert result.data["reason"] == "damaged"

    def test_stripe_error_returns_failed_result_not_an_exception(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def _raise(**kwargs: Any) -> Any:
            raise stripe.error.StripeError("card declined")

        monkeypatch.setattr(stripe.Refund, "create", _raise)
        backend = RefundBackend(api_key="sk_test_x")
        result = backend.call({"order_id": "pi_123", "amount": 10.0})
        assert result.success is False
        assert "card declined" in result.error


class TestKbSearchBackend:
    def test_missing_credentials_fails_closed(self) -> None:
        backend = KbSearchBackend(subdomain=None, email=None, api_token=None)
        result = backend.call({"query": "refund"})
        assert result.success is False
        assert "ZENDESK" in result.error

    def test_missing_query_fails_closed(self) -> None:
        backend = KbSearchBackend(subdomain="acme", email="a@x.com", api_token="tok")
        result = backend.call({})
        assert result.success is False
        assert "query" in result.error

    def test_search_maps_zendesk_articles(self, monkeypatch: pytest.MonkeyPatch) -> None:
        fake_payload = {
            "results": [
                {
                    "id": 101,
                    "title": "Refunds",
                    "body": "<p>Refund within 30 days</p>",
                    "label_names": ["refund"],
                },
            ]
        }

        class _FakeResponse:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict[str, Any]:
                return fake_payload

        monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse())
        backend = KbSearchBackend(subdomain="acme", email="a@x.com", api_token="tok")
        result = backend.call({"query": "refund", "top_k": 2})
        assert result.success is True
        assert result.data["results"][0]["article_id"] == "101"
        assert "Refund within 30 days" in result.data["results"][0]["snippet"]
        assert result.data["results"][0]["tags"] == ["refund"]

    def test_http_error_returns_failed_result_not_an_exception(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def _raise(*args: Any, **kwargs: Any) -> Any:
            raise httpx.ConnectError("boom")

        monkeypatch.setattr(httpx, "get", _raise)
        backend = KbSearchBackend(subdomain="acme", email="a@x.com", api_token="tok")
        result = backend.call({"query": "refund"})
        assert result.success is False


class TestRealToolAdapter:
    def test_default_backends_fail_closed_without_credentials(self) -> None:
        adapter = RealToolAdapter()
        for tool_name in ("crm", "order_lookup", "refund", "kb_search"):
            result = adapter.dispatch(tool_name, {})
            assert result.success is False

    def test_unknown_tool_returns_failed_result_not_an_exception(self) -> None:
        adapter = RealToolAdapter()
        result = adapter.dispatch("not_a_real_tool", {})
        assert result.success is False
        assert "Unknown tool" in result.error

    def test_custom_backends_can_be_injected(self) -> None:
        from src.tools.registry import ToolResult

        class _FakeCrmBackend(CrmBackend):
            def call(self, params: dict) -> ToolResult:
                return ToolResult(success=True, tool_name="crm", data={"customer_id": "X"})

        adapter = RealToolAdapter(
            backends={
                "crm": _FakeCrmBackend(),
                "order_lookup": OrderBackend(),
                "refund": RefundBackend(),
                "kb_search": KbSearchBackend(),
            }
        )
        result = adapter.dispatch("crm", {})
        assert result.success is True
        assert result.data["customer_id"] == "X"
