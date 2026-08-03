from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from src.core.config import Settings
from src.jobs import retention


@pytest.fixture(autouse=True)
def _patch_prune(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, datetime]]:
    calls: list[tuple[str, datetime]] = []

    def _fake_prune(client_id: str, before: datetime) -> dict[str, int]:
        calls.append((client_id, before))
        return {"episodic": 0, "tool_failure": 0, "plan_success": 0, "escalation": 0}

    monkeypatch.setattr(retention.memory_manager, "prune", _fake_prune)
    return calls


def test_run_retention_targets_every_client_from_settings_api_keys(
    _patch_prune: list[tuple[str, datetime]],
) -> None:
    settings = Settings(
        api_keys={"key1": "client_a", "key2": "client_b", "key3": "client_a"},
        memory_retention_days=30,
    )
    results = retention.run_retention(settings=settings)

    called_clients = {client_id for client_id, _ in _patch_prune}
    assert called_clients == {"client_a", "client_b"}
    assert set(results) == {"client_a", "client_b"}


def test_run_retention_uses_retention_days_from_settings(
    _patch_prune: list[tuple[str, datetime]],
) -> None:
    settings = Settings(api_keys={"key1": "client_a"}, memory_retention_days=7)
    before_call = datetime.now(timezone.utc) - timedelta(days=7)

    retention.run_retention(settings=settings)

    assert len(_patch_prune) == 1
    _, before = _patch_prune[0]
    assert abs((before - before_call).total_seconds()) < 5


def test_run_retention_accepts_explicit_client_ids(
    _patch_prune: list[tuple[str, datetime]],
) -> None:
    settings = Settings(api_keys={"key1": "client_a"})
    retention.run_retention(client_ids=["client_x", "client_y"], settings=settings)

    called_clients = {client_id for client_id, _ in _patch_prune}
    assert called_clients == {"client_x", "client_y"}
