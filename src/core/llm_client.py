"""LLM Provider Gateway — production (src/) track only.

Consolidates the per-provider client construction, proactive rate limiting, and
now a circuit breaker + ordered fallback chain that were previously duplicated
near-verbatim across experiments/memory_augmented.py, experiments/memory_augmented_v2.py,
and experiments/baselines/*.py.

Scope boundary: this module is NOT wired into experiments/. memory_augmented.py is frozen
(cited paper numbers) and memory_augmented_v2.py is mid-flight research feeding paper
numbers — neither is touched here. See ENTERPRISE_ARCHITECTURE.md section 3.
"""

from __future__ import annotations

import functools
import logging
import threading
import time
from dataclasses import dataclass

from openai import OpenAI

from src.core.config import Settings, get_settings
from src.core.telemetry import record_provider_fallback, span

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProviderModel:
    provider: str
    model: str


def default_role_providers(settings: Settings) -> dict[str, list[ProviderModel]]:
    """Default role -> ordered fallback list of ProviderModel.

    "planner" and "critic" mirror the provider/model choice already validated in
    experiments/ (PLANNER_MODEL / CRITIC_MODEL env vars), with local Ollama as Fallback
    Tier 1 — an already-accepted quality tradeoff (it's used for Intake/Response today)
    rather than a new vendor.

    "intake" / "response" point at the qwen2.5:3b-instruct-via-Ollama role AGENTS.md
    documents as the target design. Note: as of this gateway's creation, experiments/
    implements Intake/Response as deterministic regex extraction / string formatting,
    not LLM calls — these entries exist so a production Intake/Response agent (Phase 1)
    can opt into an LLM without a gateway change, not because that call path exists yet.
    """
    return {
        "planner": [
            ProviderModel("nim", settings.planner_model),
            ProviderModel("ollama", settings.ollama_model),
        ],
        "critic": [
            ProviderModel("nim", settings.critic_model),
            ProviderModel("ollama", settings.ollama_model),
        ],
        "intake": [ProviderModel("ollama", settings.ollama_model)],
        "response": [ProviderModel("ollama", settings.ollama_model)],
    }


class _SlidingWindowRateLimiter:
    """Proactive limiter: at most max_calls per rolling window_seconds.

    One instance per *provider* (not per role/caller), shared via LLMProviderGateway,
    since the underlying rate ceiling is per-provider-account, not per-role.

    Known limitation (documented in ENTERPRISE_ARCHITECTURE.md section 3, not fixed here):
    this state is in-process only. Running more than one worker process against the same
    provider account will collectively exceed the provider's ceiling even though each
    process individually respects it — v1 deployment must run as a single worker process.
    """

    def __init__(self, max_calls: int, window_seconds: float = 60.0) -> None:
        self.max_calls = max_calls
        self.window_seconds = window_seconds
        self._lock = threading.Lock()
        self._timestamps: list[float] = []

    def acquire(self) -> None:
        with self._lock:
            now = time.monotonic()
            cutoff = now - self.window_seconds
            self._timestamps[:] = [t for t in self._timestamps if t > cutoff]

            if len(self._timestamps) < self.max_calls:
                self._timestamps.append(now)
                return

            oldest = self._timestamps.pop(0)
            sleep_for = oldest + self.window_seconds - now + 0.05
            logger.warning(
                "Rate limit reached (%d calls in last %.0fs). Throttling %.1fs before next call.",
                self.max_calls,
                self.window_seconds,
                sleep_for,
            )
            time.sleep(sleep_for)
            self._timestamps.append(time.monotonic())


class _CircuitBreaker:
    """Per-provider circuit breaker.

    After `failure_threshold` consecutive failures the provider is marked unhealthy and
    skipped by the gateway until `cooldown_seconds` has elapsed since the last failure, at
    which point one trial call is allowed through (half-open). This replaces relying on
    reactive retry/backoff alone, which previously caused 20+ minute stalls against NIM's
    rate ceiling (see AGENTS.md).
    """

    def __init__(self, failure_threshold: int = 3, cooldown_seconds: float = 60.0) -> None:
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self._lock = threading.Lock()
        self._consecutive_failures = 0
        self._opened_at: float | None = None

    def is_open(self) -> bool:
        with self._lock:
            if self._opened_at is None:
                return False
            if time.monotonic() - self._opened_at >= self.cooldown_seconds:
                return False
            return True

    def record_success(self) -> None:
        with self._lock:
            self._consecutive_failures = 0
            self._opened_at = None

    def record_failure(self) -> None:
        with self._lock:
            self._consecutive_failures += 1
            if self._consecutive_failures >= self.failure_threshold:
                self._opened_at = time.monotonic()


class LLMProviderGateway:
    """Central LLM client for the production track: role -> ordered provider fallback list,
    with per-provider rate limiting and circuit breaking.
    """

    def __init__(
        self,
        settings: Settings | None = None,
        role_providers: dict[str, list[ProviderModel]] | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.role_providers = (
            role_providers if role_providers is not None else default_role_providers(self.settings)
        )
        self._clients: dict[str, OpenAI] = {}
        self._rate_limiters: dict[str, _SlidingWindowRateLimiter] = {}
        self._circuit_breakers: dict[str, _CircuitBreaker] = {}
        self._lock = threading.Lock()

    def call(self, role: str, messages: list[dict]) -> str:
        """Call the LLM for `role`, trying each configured provider in order until one
        succeeds. Raises RuntimeError if every provider's circuit is open or every call
        fails.
        """
        providers = self.role_providers.get(role)
        if not providers:
            raise ValueError(f"No provider configured for role: {role!r}")

        last_exc: Exception | None = None
        for provider_model in providers:
            breaker = self._get_circuit_breaker(provider_model.provider)
            if breaker.is_open():
                logger.warning(
                    "Skipping provider %s for role %s: circuit open.",
                    provider_model.provider,
                    role,
                )
                continue

            try:
                content = self._call_provider(provider_model, messages, role)
                breaker.record_success()
                return content
            except Exception as exc:  # noqa: BLE001 - any provider failure must fall through
                breaker.record_failure()
                last_exc = exc
                logger.warning(
                    "Provider %s failed for role %s (%s) — trying next fallback.",
                    provider_model.provider,
                    role,
                    exc,
                )
                record_provider_fallback(role=role, provider=provider_model.provider)

        raise RuntimeError(f"All providers exhausted for role {role!r}") from last_exc

    def _call_provider(self, provider_model: ProviderModel, messages: list[dict], role: str) -> str:
        client = self._get_client(provider_model.provider)
        limiter = self._get_rate_limiter(provider_model.provider)
        limiter.acquire()
        with span(
            "llm.call", role=role, provider=provider_model.provider, model=provider_model.model
        ):
            resp = client.chat.completions.create(
                model=provider_model.model,
                messages=messages,
                temperature=0.0,
            )
        return resp.choices[0].message.content or ""

    def _get_client(self, provider: str) -> OpenAI:
        with self._lock:
            if provider not in self._clients:
                self._clients[provider] = self._build_client(provider)
            return self._clients[provider]

    def _build_client(self, provider: str) -> OpenAI:
        s = self.settings
        if provider == "nim":
            return OpenAI(
                base_url=s.nvidia_base_url,
                api_key=s.nvidia_api_key or "",
                timeout=s.llm_call_timeout,
            )
        if provider == "gemini":
            return OpenAI(
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                api_key=s.gemini_api_key or "",
                timeout=s.llm_call_timeout,
            )
        if provider == "ollama":
            return OpenAI(base_url=s.ollama_base_url, api_key="ollama", timeout=s.llm_call_timeout)
        raise ValueError(f"Unknown LLM provider: {provider!r}")

    def _get_rate_limiter(self, provider: str) -> _SlidingWindowRateLimiter:
        with self._lock:
            if provider not in self._rate_limiters:
                rpm = {
                    "nim": self.settings.nim_rpm,
                    "gemini": self.settings.gemini_rpm,
                    "ollama": self.settings.ollama_rpm,
                }.get(provider, 60)
                self._rate_limiters[provider] = _SlidingWindowRateLimiter(max_calls=rpm)
            return self._rate_limiters[provider]

    def _get_circuit_breaker(self, provider: str) -> _CircuitBreaker:
        with self._lock:
            if provider not in self._circuit_breakers:
                self._circuit_breakers[provider] = _CircuitBreaker()
            return self._circuit_breakers[provider]


@functools.lru_cache(maxsize=1)
def get_gateway() -> LLMProviderGateway:
    return LLMProviderGateway()
