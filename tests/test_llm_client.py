from __future__ import annotations

import time
from unittest.mock import MagicMock, patch

import pytest

from src.core.config import Settings
from src.core.llm_client import (
    LLMProviderGateway,
    ProviderModel,
    _CircuitBreaker,
    _SlidingWindowRateLimiter,
)


def _settings() -> Settings:
    return Settings(
        nvidia_api_key="test-nim-key",
        gemini_api_key="test-gemini-key",
        nim_rpm=1000,
        gemini_rpm=1000,
        ollama_rpm=1000,
    )


def _make_response(content: str) -> MagicMock:
    resp = MagicMock()
    resp.choices = [MagicMock(message=MagicMock(content=content))]
    return resp


def test_call_uses_primary_provider_when_healthy() -> None:
    gateway = LLMProviderGateway(
        settings=_settings(),
        role_providers={"planner": [ProviderModel("nim", "test-model")]},
    )
    client = MagicMock()
    client.chat.completions.create.return_value = _make_response("hello")

    with patch.object(LLMProviderGateway, "_build_client", return_value=client):
        result = gateway.call("planner", [{"role": "user", "content": "hi"}])

    assert result == "hello"
    client.chat.completions.create.assert_called_once()


def test_call_falls_back_to_second_provider_on_failure() -> None:
    gateway = LLMProviderGateway(
        settings=_settings(),
        role_providers={
            "planner": [
                ProviderModel("nim", "primary-model"),
                ProviderModel("ollama", "fallback-model"),
            ]
        },
    )

    failing_client = MagicMock()
    failing_client.chat.completions.create.side_effect = RuntimeError("boom")
    healthy_client = MagicMock()
    healthy_client.chat.completions.create.return_value = _make_response("fallback response")

    def build_client(self, provider: str):
        return failing_client if provider == "nim" else healthy_client

    with patch.object(LLMProviderGateway, "_build_client", build_client):
        result = gateway.call("planner", [{"role": "user", "content": "hi"}])

    assert result == "fallback response"


def test_call_raises_when_all_providers_exhausted() -> None:
    gateway = LLMProviderGateway(
        settings=_settings(),
        role_providers={"planner": [ProviderModel("nim", "primary-model")]},
    )
    failing_client = MagicMock()
    failing_client.chat.completions.create.side_effect = RuntimeError("boom")

    with patch.object(LLMProviderGateway, "_build_client", return_value=failing_client):
        with pytest.raises(RuntimeError, match="All providers exhausted"):
            gateway.call("planner", [{"role": "user", "content": "hi"}])


def test_call_unknown_role_raises() -> None:
    gateway = LLMProviderGateway(settings=_settings(), role_providers={})
    with pytest.raises(ValueError, match="No provider configured"):
        gateway.call("unknown-role", [])


def test_circuit_breaker_skips_provider_once_open() -> None:
    gateway = LLMProviderGateway(
        settings=_settings(),
        role_providers={"planner": [ProviderModel("nim", "primary-model")]},
    )
    # Force the circuit open before any real call.
    breaker = gateway._get_circuit_breaker("nim")
    for _ in range(10):
        breaker.record_failure()

    never_called_client = MagicMock()
    with patch.object(LLMProviderGateway, "_build_client", return_value=never_called_client):
        with pytest.raises(RuntimeError, match="All providers exhausted"):
            gateway.call("planner", [{"role": "user", "content": "hi"}])

    never_called_client.chat.completions.create.assert_not_called()


def test_circuit_breaker_opens_after_threshold_and_resets_on_success() -> None:
    breaker = _CircuitBreaker(failure_threshold=2, cooldown_seconds=1000.0)
    assert breaker.is_open() is False

    breaker.record_failure()
    assert breaker.is_open() is False  # below threshold

    breaker.record_failure()
    assert breaker.is_open() is True  # threshold hit, long cooldown keeps it open

    breaker.record_success()
    assert breaker.is_open() is False  # success resets the breaker


def test_circuit_breaker_half_opens_after_cooldown() -> None:
    breaker = _CircuitBreaker(failure_threshold=1, cooldown_seconds=0.05)
    breaker.record_failure()
    assert breaker.is_open() is True

    time.sleep(0.1)
    assert breaker.is_open() is False


def test_rate_limiter_allows_up_to_max_calls_without_blocking() -> None:
    limiter = _SlidingWindowRateLimiter(max_calls=3, window_seconds=60.0)
    start = time.monotonic()
    for _ in range(3):
        limiter.acquire()
    elapsed = time.monotonic() - start
    assert elapsed < 1.0
