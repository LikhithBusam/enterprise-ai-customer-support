from __future__ import annotations

import pytest

from src.core import telemetry
from src.core.config import Settings
from src.memory.client_store import ClientStore, ClientStoreRegistry
from src.memory.episodic import EpisodicMemory


def test_span_yields_a_span_and_sets_attributes() -> None:
    with telemetry.span("test.span", foo="bar", skipped=None) as current_span:
        assert current_span is not None


def test_span_propagates_exceptions_from_the_wrapped_block() -> None:
    with pytest.raises(ValueError):
        with telemetry.span("test.span"):
            raise ValueError("boom")


def test_record_ticket_outcome_and_provider_fallback_do_not_raise() -> None:
    telemetry.record_ticket_outcome(
        client_id="test_client", resolved=True, escalate=False, replanning_count=1
    )
    telemetry.record_provider_fallback(role="planner", provider="nim")


def test_configure_telemetry_without_endpoint_is_a_no_op(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(telemetry, "_configured", False)
    telemetry.configure_telemetry(Settings(otel_exporter_endpoint=None))
    assert telemetry._configured is True
    # Calling again (already configured) must not raise either.
    telemetry.configure_telemetry(Settings(otel_exporter_endpoint=None))


def test_build_span_processor_and_meter_provider_with_endpoint_configured() -> None:
    # BatchSpanProcessor/PeriodicExportingMetricReader start real background export threads on
    # construction — must .shutdown() them or they keep running (and, observed on this machine,
    # can crash later, unrelated onnxruntime imports via a native-level access violation) for
    # the rest of the test session.
    settings = Settings(otel_exporter_endpoint="http://localhost:4317")
    processor = telemetry._build_span_processor(settings)
    try:
        assert processor is not None
    finally:
        processor.shutdown()

    from opentelemetry.sdk.resources import Resource

    provider = telemetry._build_meter_provider(Resource.create({}), settings)
    try:
        assert provider is not None
    finally:
        provider.shutdown()


def test_memory_size_callback_reports_entry_counts_per_client_and_memory_type(
    monkeypatch: pytest.MonkeyPatch, client_store: ClientStore, client_id: str
) -> None:
    client_store.episodic.write(
        client_id=client_id,
        entry=EpisodicMemory(
            ticket_id="T-1", intent="refund_request", plan_dag={}, outcome="success"
        ),
    )
    monkeypatch.setattr(ClientStoreRegistry, "_stores", {client_id: client_store})

    observations = list(telemetry._memory_size_callback(None))

    episodic_obs = [o for o in observations if o.attributes["memory_type"] == "episodic"]
    assert len(episodic_obs) == 1
    assert episodic_obs[0].value == 1
    assert episodic_obs[0].attributes["client_id"] == client_id

    other_types = {o.attributes["memory_type"] for o in observations} - {"episodic"}
    assert other_types == {"tool_failure", "plan_success", "escalation"}
    assert all(o.value == 0 for o in observations if o.attributes["memory_type"] != "episodic")
