"""FastAPI service wrapping the Phase 1 LangGraph pipeline (ENTERPRISE_ARCHITECTURE.md Phase 2).

Single worker process (hard constraint — see src/api/rate_limit.py and
src/core/llm_client.py's _SlidingWindowRateLimiter, both in-process state). Run with:

    uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8000

`create_app()` takes the pipeline/limiter/cache as optional args so tests can inject fakes
(mirrors src.graph.pipeline.build_pipeline's gateway/dispatch injection) instead of hitting real
LLM providers or a shared module-level cache.
"""

from __future__ import annotations

from typing import Any

from fastapi import Depends, FastAPI, HTTPException, status

from src.api.auth import resolve_client_id
from src.api.idempotency import IdempotencyCache
from src.api.rate_limit import ClientRateLimiter
from src.api.schemas import TicketRequest, TicketResponse
from src.core.config import Settings, get_settings
from src.core.logging import configure_logging, get_logger
from src.core.telemetry import configure_telemetry
from src.graph.pipeline import build_pipeline, run_ticket

logger = get_logger(__name__)


def create_app(
    pipeline: Any = None,
    settings: Settings | None = None,
    rate_limiter: ClientRateLimiter | None = None,
    idempotency_cache: IdempotencyCache | None = None,
) -> FastAPI:
    configure_logging()
    settings = settings or get_settings()
    configure_telemetry(settings)
    compiled_pipeline = pipeline or build_pipeline()
    rate_limiter = rate_limiter or ClientRateLimiter(max_calls=settings.api_rate_limit_per_minute)
    idempotency_cache = idempotency_cache or IdempotencyCache()

    app = FastAPI(title="Customer Support API", version="1.0.0")
    # get_settings() is a module-level singleton (src.core.config._settings) — override it per
    # app instance so a test/alternate deployment's `settings` (e.g. a different api_keys map)
    # actually reaches resolve_client_id's Depends(get_settings) chain in src/api/auth.py.
    app.dependency_overrides[get_settings] = lambda: settings

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/v1/tickets", response_model=TicketResponse)
    def submit_ticket(
        request: TicketRequest,
        client_id: str = Depends(resolve_client_id),
    ) -> TicketResponse:
        cached = idempotency_cache.get(client_id, request.ticket_id)
        if cached is not None:
            logger.info(
                "Idempotent replay, skipping reprocessing.",
                extra={"ticket_id": request.ticket_id, "client_id": client_id},
            )
            return TicketResponse(**cached, replayed=True)

        if not rate_limiter.allow(client_id):
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Rate limit exceeded")

        try:
            final_state = run_ticket(
                request.model_dump(), client_id=client_id, pipeline=compiled_pipeline
            )
        except Exception:
            logger.exception(
                "Pipeline run failed.",
                extra={"ticket_id": request.ticket_id, "client_id": client_id},
            )
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Ticket processing failed") from None

        response = TicketResponse(
            ticket_id=request.ticket_id,
            resolved=final_state.get("resolved", False),
            escalate=final_state.get("escalate", False),
            response_message=final_state.get("response_message", ""),
            replanning_count=final_state.get("replanning_count", 0),
            memory_hit=final_state.get("memory_hit", False),
            iteration=final_state.get("iteration", 0),
            tool_calls_made=final_state.get("tool_calls_made", []),
        )
        idempotency_cache.put(
            client_id, request.ticket_id, response.model_dump(exclude={"replayed"})
        )
        return response

    return app


app = create_app()
