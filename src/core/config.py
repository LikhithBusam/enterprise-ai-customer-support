from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    """Typed, centralized configuration for the production (src/) track.

    Reads the same .env keys experiments/ already depends on (see .env.example) so the
    research and production tracks never fork configuration.
    """

    llm_provider: str = "nim"

    nvidia_api_key: str | None = None
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    planner_model: str = "meta/llama-3.1-8b-instruct"
    critic_model: str = "meta/llama-3.1-8b-instruct"
    nim_rpm: int = 35

    gemini_api_key: str | None = None
    gemini_rpm: int = 1500

    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = "qwen2.5:3b-instruct"
    ollama_rpm: int = 120

    llm_call_timeout: float = 30.0

    # Separate from experiments/'s BASELINE_USE_LLM so the research and production tracks can be
    # toggled independently (e.g. fast structural tests of the production graph without an
    # unrelated research run flipping this too).
    use_llm: bool = True

    chroma_persist_dir: Path = Path("data/chroma")
    default_top_k: int = 5

    # API / Gateway layer (ENTERPRISE_ARCHITECTURE.md Phase 2). API_KEYS format:
    # "key1:client_a,key2:client_b" — a static env-var-driven map is sufficient for a single
    # deployed instance; swap for a real credential store before multi-tenant production rollout.
    api_keys: dict[str, str] = {}
    api_rate_limit_per_minute: int = 60

    # Observability (ENTERPRISE_ARCHITECTURE.md Phase 3). None = spans/metrics stay no-op (the
    # OTel API default when no SDK provider is configured) — no collector required for local dev.
    # Set to a real collector endpoint (e.g. "http://localhost:4317") to export for real.
    otel_exporter_endpoint: str | None = None

    # Real tool backends (ENTERPRISE_ARCHITECTURE.md Phase 4). None = the corresponding
    # RealToolAdapter backend fails closed with a clear config error instead of calling out with
    # no credentials — see src/tools/adapter.py.
    stripe_api_key: str | None = None
    zendesk_subdomain: str | None = None
    zendesk_email: str | None = None
    zendesk_api_token: str | None = None

    # Retention policy (ENTERPRISE_ARCHITECTURE.md Phase 5). Consumed by src/jobs/retention.py,
    # an external-scheduler-invoked job (cron / k8s CronJob), not a background thread inside the
    # API process — same single-worker-process posture as the LLM/inbound rate limiters.
    memory_retention_days: int = 90

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            llm_provider=os.environ.get("LLM_PROVIDER", "nim"),
            nvidia_api_key=os.environ.get("NVIDIA_API_KEY"),
            nvidia_base_url=os.environ.get(
                "NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"
            ),
            planner_model=os.environ.get("PLANNER_MODEL", "meta/llama-3.1-8b-instruct"),
            critic_model=os.environ.get("CRITIC_MODEL", "meta/llama-3.1-8b-instruct"),
            nim_rpm=int(os.environ.get("NIM_RPM", "35")),
            gemini_api_key=os.environ.get("GEMINI_API_KEY"),
            gemini_rpm=int(os.environ.get("GEMINI_RPM", "1500")),
            ollama_base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
            ollama_model=os.environ.get("OLLAMA_MODEL", "qwen2.5:3b-instruct"),
            ollama_rpm=int(os.environ.get("OLLAMA_RPM", "120")),
            llm_call_timeout=float(os.environ.get("LLM_CALL_TIMEOUT", "30")),
            use_llm=os.environ.get("PRODUCTION_USE_LLM", "1") == "1",
            chroma_persist_dir=Path(os.environ.get("CHROMA_PERSIST_DIR", "data/chroma")),
            default_top_k=int(os.environ.get("DEFAULT_TOP_K", "5")),
            api_keys=_parse_api_keys(os.environ.get("API_KEYS", "")),
            api_rate_limit_per_minute=int(os.environ.get("API_RATE_LIMIT_PER_MINUTE", "60")),
            otel_exporter_endpoint=os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT") or None,
            stripe_api_key=os.environ.get("STRIPE_API_KEY") or None,
            zendesk_subdomain=os.environ.get("ZENDESK_SUBDOMAIN") or None,
            zendesk_email=os.environ.get("ZENDESK_EMAIL") or None,
            zendesk_api_token=os.environ.get("ZENDESK_API_TOKEN") or None,
            memory_retention_days=int(os.environ.get("MEMORY_RETENTION_DAYS", "90")),
        )


def _parse_api_keys(raw: str) -> dict[str, str]:
    """Parses "key1:client_a,key2:client_b" into {"key1": "client_a", "key2": "client_b"}."""
    pairs: dict[str, str] = {}
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if not chunk or ":" not in chunk:
            continue
        key, _, client_id = chunk.partition(":")
        key, client_id = key.strip(), client_id.strip()
        if key and client_id:
            pairs[key] = client_id
    return pairs


_settings = Settings.from_env()

# Back-compat module-level constants for existing call sites (e.g. src/memory/client_store.py
# does `from src.core import config; config.CHROMA_PERSIST_DIR`).
CHROMA_PERSIST_DIR = _settings.chroma_persist_dir
DEFAULT_TOP_K = _settings.default_top_k


def get_settings() -> Settings:
    return _settings
