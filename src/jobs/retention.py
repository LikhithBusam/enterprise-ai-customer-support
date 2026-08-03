"""Retention job (ENTERPRISE_ARCHITECTURE.md Phase 5): scheduled call of the existing
src.agents.memory_manager.prune() per client, per Settings.memory_retention_days.

Deliberately *not* a background thread inside the API process — src/api/rate_limit.py and
src/core/llm_client.py's rate limiters are already documented as in-process, single-worker-process
state, and this job has no reason to add another one. Run it as an external scheduled job (cron,
a k8s CronJob, Windows Task Scheduler):

    uv run python -m src.jobs.retention
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from src.agents import memory_manager
from src.core.config import Settings, get_settings
from src.core.logging import configure_logging

logger = logging.getLogger(__name__)


def run_retention(
    client_ids: list[str] | None = None, settings: Settings | None = None
) -> dict[str, dict[str, int]]:
    """Prunes every memory store older than `settings.memory_retention_days` for each client.

    `client_ids` defaults to the clients configured in `settings.api_keys` (the deployment's known
    tenants) rather than `ClientStoreRegistry.snapshot()` — snapshot only reflects clients touched
    since this process started, which is the wrong source of truth for a job meant to run cold,
    on its own schedule, independent of API traffic.
    """
    settings = settings or get_settings()
    before = datetime.now(timezone.utc) - timedelta(days=settings.memory_retention_days)
    targets = client_ids if client_ids is not None else sorted(set(settings.api_keys.values()))

    results: dict[str, dict[str, int]] = {}
    for client_id in targets:
        pruned = memory_manager.prune(client_id, before)
        results[client_id] = pruned
        logger.info(
            "Retention prune complete.",
            extra={"client_id": client_id, "before": before.isoformat(), "pruned": pruned},
        )
    return results


def main() -> None:
    configure_logging()
    results = run_retention()
    logger.info("Retention job finished for %d client(s).", len(results))


if __name__ == "__main__":
    main()
