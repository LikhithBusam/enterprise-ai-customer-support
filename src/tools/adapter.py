"""Production tool layer (ENTERPRISE_ARCHITECTURE.md Phase 4): `ToolAdapter`, deliberately
decoupled from src/tools/registry.py's `ToolRegistry.dispatch()` signature — that method bakes
`failure_rate`/`rng` into every call for the research harness's synthetic-failure injection,
which has no analog for a real backend. `ToolRegistry` itself stays untouched and research-only;
src/graph/pipeline.py wires against this module, not that class, for production.
"""

from __future__ import annotations

import random
import re
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

import httpx
import stripe

from src.core.config import get_settings
from src.tools.registry import ToolResult


class ToolAdapter(ABC):
    """Matches src.agents.executor.DispatchFn's shape (Callable[[str, dict], ToolResult]) as a
    class so concrete adapters are swappable via dependency injection (see
    src/graph/pipeline.py's build_pipeline `dispatch` param) without executor.py — or anything
    upstream of it — knowing which adapter is wired in.
    """

    @abstractmethod
    def dispatch(self, tool_name: str, params: dict[str, Any]) -> ToolResult:
        """Real backends must never set ToolResult.failure_type — it's oracle/eval-only metadata
        for the research harness (AGENTS.md "What NOT to do"), and there's nothing to score
        against a real backend anyway. Leaving it unset (the model's default None) is correct.
        """
        raise NotImplementedError


def _load_simulated_handlers() -> dict[str, Any]:
    from src.tools.crm import get_customer
    from src.tools.kb_search import search_kb
    from src.tools.order import lookup_order
    from src.tools.refund import issue_refund

    return {
        "crm": get_customer,
        "order_lookup": lookup_order,
        "refund": issue_refund,
        "kb_search": search_kb,
    }


_SIMULATED_HANDLERS = _load_simulated_handlers()


class SimulatedToolAdapter(ToolAdapter):
    """Default dev/staging adapter: wraps the same simulated handlers the research track uses
    (src/tools/{crm,order,refund,kb_search}.py), calling them directly rather than through
    `ToolRegistry` (research-only — not extended here, per ENTERPRISE_ARCHITECTURE.md).
    `failure_rate` defaults to 0.0 (matches src/graph/pipeline.py's prior interim default) but
    stays configurable for staging environments that want to exercise the pipeline's replanning
    path without a real backend.
    """

    def __init__(self, failure_rate: float = 0.0, seed: int | None = None) -> None:
        self.failure_rate = failure_rate
        self._rng = random.Random(seed)

    def dispatch(self, tool_name: str, params: dict[str, Any]) -> ToolResult:
        handler = _SIMULATED_HANDLERS.get(tool_name)
        if handler is None:
            return ToolResult(
                success=False, tool_name=tool_name, error=f"Unknown tool: {tool_name}"
            )
        return handler(**(params or {}), failure_rate=self.failure_rate, rng=self._rng)


class ToolBackend(ABC):
    """One real tool's backend client — e.g. a CRM API client. Implementing `call()` for one tool
    is independent of the others and doesn't require touching `ToolAdapter`, `RealToolAdapter`, or
    anything upstream (Executor, Planner, Critic).
    """

    tool_name: str

    @abstractmethod
    def call(self, params: dict[str, Any]) -> ToolResult:
        raise NotImplementedError


def _customer_to_payload(customer: Any) -> dict[str, Any]:
    """Stripe Customers have no native concept of loyalty tier / lifetime value / open support
    tickets, so those fields are read from Customer metadata when the integrating store sets them
    (e.g. `stripe.Customer.modify(id, metadata={"tier": "gold", ...})`) and left `None` otherwise.
    """
    metadata = customer.get("metadata") or {}
    raw_ltv = metadata.get("lifetime_value")
    return {
        "customer_id": customer["id"],
        "email": customer.get("email"),
        "name": customer.get("name"),
        "tier": metadata.get("tier"),
        "lifetime_value": float(raw_ltv) if raw_ltv not in (None, "") else None,
        "open_tickets": metadata.get("open_tickets"),
        "last_contact": metadata.get("last_contact"),
    }


class CrmBackend(ToolBackend):
    """Backed by Stripe's Customers API (ENTERPRISE_ARCHITECTURE.md Phase 4 decision — Stripe
    chosen since it's already the system of record for the Order/Refund backends below, and every
    paying customer already has a Stripe Customer object).
    """

    tool_name = "crm"

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or get_settings().stripe_api_key

    def call(self, params: dict[str, Any]) -> ToolResult:
        if not self._api_key:
            return ToolResult(
                success=False, tool_name=self.tool_name, error="STRIPE_API_KEY is not configured"
            )
        customer_id = params.get("customer_id")
        email = params.get("email")
        if not customer_id and not email:
            return ToolResult(
                success=False,
                tool_name=self.tool_name,
                error="crm requires customer_id or email",
            )
        try:
            if customer_id:
                customer = stripe.Customer.retrieve(customer_id, api_key=self._api_key)
            else:
                page = stripe.Customer.list(email=email, limit=1, api_key=self._api_key)
                customer = page.data[0] if page.data else None
        except stripe.error.StripeError as exc:
            return ToolResult(success=False, tool_name=self.tool_name, error=str(exc))

        if customer is None:
            return ToolResult(
                success=True,
                tool_name=self.tool_name,
                data={
                    "customer_id": customer_id,
                    "email": email,
                    "status": "not_found",
                    "message": "No matching Stripe customer",
                },
            )
        return ToolResult(
            success=True, tool_name=self.tool_name, data=_customer_to_payload(customer)
        )


def _payment_intent_to_payload(intent: Any) -> dict[str, Any]:
    """Stripe PaymentIntents track payment state, not order fulfillment — there is no delivery
    tracking or line-item concept on the object. `status` is passed through as Stripe's own value
    (e.g. "succeeded"/"processing"/"requires_payment_method") rather than force-mapped onto the
    simulated tool's shipping-status vocabulary, and `delivered_at`/`items` stay empty until a
    real order-management system is wired in alongside this backend.
    """
    shipping = intent.get("shipping") or {}
    address = shipping.get("address") or {}
    address_parts = [
        address.get("line1"),
        address.get("line2"),
        address.get("city"),
        address.get("state"),
        address.get("postal_code"),
    ]
    shipping_address = ", ".join(part for part in address_parts if part) or None
    return {
        "order_id": intent["id"],
        "customer_id": intent.get("customer"),
        "status": intent.get("status"),
        "placed_at": datetime.fromtimestamp(intent["created"], tz=timezone.utc).isoformat(),
        "delivered_at": None,
        "total_amount": round(intent.get("amount", 0) / 100, 2),
        "currency": (intent.get("currency") or "usd").upper(),
        "items": [],
        "shipping_address": shipping_address,
    }


class OrderBackend(ToolBackend):
    """Backed by Stripe's PaymentIntents API. `order_id` is treated as a Stripe PaymentIntent id
    (e.g. "pi_..."); see `_payment_intent_to_payload` for the fields Stripe can't provide.
    """

    tool_name = "order_lookup"

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or get_settings().stripe_api_key

    def call(self, params: dict[str, Any]) -> ToolResult:
        if not self._api_key:
            return ToolResult(
                success=False, tool_name=self.tool_name, error="STRIPE_API_KEY is not configured"
            )
        order_id = params.get("order_id")
        if not order_id:
            return ToolResult(
                success=False, tool_name=self.tool_name, error="order_lookup requires order_id"
            )
        try:
            intent = stripe.PaymentIntent.retrieve(order_id, api_key=self._api_key)
        except stripe.error.StripeError as exc:
            return ToolResult(success=False, tool_name=self.tool_name, error=str(exc))
        return ToolResult(
            success=True, tool_name=self.tool_name, data=_payment_intent_to_payload(intent)
        )


_REFUND_STATUS_MAP = {
    "succeeded": "approved",
    "pending": "pending_review",
    "failed": "failed",
    "canceled": "failed",
}


def _refund_to_payload(refund: Any, reason: str) -> dict[str, Any]:
    status = refund.get("status")
    return {
        "refund_id": refund["id"],
        "order_id": refund.get("payment_intent"),
        "status": _REFUND_STATUS_MAP.get(status, status),
        "amount": round(refund.get("amount", 0) / 100, 2),
        "currency": (refund.get("currency") or "usd").upper(),
        "reason": reason,
        "estimated_days": None,
        "message": f"Stripe refund status: {status}",
    }


class RefundBackend(ToolBackend):
    """Backed by Stripe's Refunds API. `order_id` is the Stripe PaymentIntent id to refund
    against. `reason` is free text lifted from the ticket and stored in the refund's metadata,
    since Stripe's own `reason` enum (duplicate/fraudulent/requested_by_customer) can't carry an
    arbitrary support-ticket reason — every support-initiated refund is filed as
    "requested_by_customer" with the real reason preserved in metadata.
    """

    tool_name = "refund"

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or get_settings().stripe_api_key

    def call(self, params: dict[str, Any]) -> ToolResult:
        if not self._api_key:
            return ToolResult(
                success=False, tool_name=self.tool_name, error="STRIPE_API_KEY is not configured"
            )
        order_id = params.get("order_id")
        amount = params.get("amount")
        reason = params.get("reason", "customer request")
        if not order_id or amount is None:
            return ToolResult(
                success=False,
                tool_name=self.tool_name,
                error="refund requires order_id and amount",
            )
        try:
            refund = stripe.Refund.create(
                payment_intent=order_id,
                amount=round(amount * 100),
                reason="requested_by_customer",
                metadata={"support_reason": reason},
                api_key=self._api_key,
            )
        except stripe.error.StripeError as exc:
            return ToolResult(success=False, tool_name=self.tool_name, error=str(exc))
        return ToolResult(
            success=True, tool_name=self.tool_name, data=_refund_to_payload(refund, reason)
        )


def _article_to_payload(article: dict[str, Any]) -> dict[str, Any]:
    body = article.get("body") or ""
    snippet = re.sub("<[^>]+>", "", body).strip()[:200]
    return {
        "article_id": str(article.get("id")),
        "title": article.get("title"),
        "snippet": snippet,
        "tags": article.get("label_names") or [],
    }


class KbSearchBackend(ToolBackend):
    """Backed by Zendesk Guide's Help Center search API
    (`GET /api/v2/help_center/articles/search.json?query=...`), authenticated with Zendesk's
    email/token Basic Auth scheme (`{email}/token` as the username, the API token as the
    password).
    """

    tool_name = "kb_search"

    def __init__(
        self,
        subdomain: str | None = None,
        email: str | None = None,
        api_token: str | None = None,
    ) -> None:
        settings = get_settings()
        self._subdomain = subdomain or settings.zendesk_subdomain
        self._email = email or settings.zendesk_email
        self._api_token = api_token or settings.zendesk_api_token

    def call(self, params: dict[str, Any]) -> ToolResult:
        if not (self._subdomain and self._email and self._api_token):
            return ToolResult(
                success=False,
                tool_name=self.tool_name,
                error="ZENDESK_SUBDOMAIN/ZENDESK_EMAIL/ZENDESK_API_TOKEN are not fully configured",
            )
        query = params.get("query")
        top_k = params.get("top_k", 3)
        if not query:
            return ToolResult(
                success=False, tool_name=self.tool_name, error="kb_search requires query"
            )
        url = f"https://{self._subdomain}.zendesk.com/api/v2/help_center/articles/search.json"
        try:
            response = httpx.get(
                url,
                params={"query": query},
                auth=(f"{self._email}/token", self._api_token),
                timeout=10.0,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            return ToolResult(success=False, tool_name=self.tool_name, error=str(exc))

        payload = response.json()
        results = [_article_to_payload(article) for article in payload.get("results", [])[:top_k]]
        return ToolResult(
            success=True,
            tool_name=self.tool_name,
            data={"query": query, "results": results, "result_count": len(results)},
        )


class RealToolAdapter(ToolAdapter):
    """Composes one `ToolBackend` per tool behind the single `ToolAdapter.dispatch(tool_name,
    params)` interface executor.py expects: CRM/order lookup/refunds against Stripe, KB search
    against Zendesk Guide (ENTERPRISE_ARCHITECTURE.md Phase 4). Swapping any one integration for a
    different vendor means implementing that backend's `call()`, not changing this class,
    `ToolAdapter`, or anything upstream of it.
    """

    def __init__(self, backends: dict[str, ToolBackend] | None = None) -> None:
        self._backends = backends or {
            "crm": CrmBackend(),
            "order_lookup": OrderBackend(),
            "refund": RefundBackend(),
            "kb_search": KbSearchBackend(),
        }

    def dispatch(self, tool_name: str, params: dict[str, Any]) -> ToolResult:
        backend = self._backends.get(tool_name)
        if backend is None:
            return ToolResult(
                success=False, tool_name=tool_name, error=f"Unknown tool: {tool_name}"
            )
        return backend.call(params)
