"""OpenTelemetry tracing + metrics for the production (src/) track (ENTERPRISE_ARCHITECTURE.md
Phase 3). Additive and production-only, same scope boundary as src/core/logging.py and
src/core/llm_client.py — experiments/ is untouched.

Uninstrumented-by-default is the point, not a gap: every function below is safe to call whether
or not `configure_telemetry()` has ever run. The OTel API returns no-op tracers/meters until an
SDK provider is registered, so local dev, tests, and `experiments/` runs pay zero tracing/metrics
cost and need no collector. `configure_telemetry()` itself stays a no-op — it doesn't register
any SDK provider — unless OTEL_EXPORTER_OTLP_ENDPOINT is set, so calling it unconditionally from
src/api/main.py's create_app() (including once per test that builds an app) never starts a
background exporter thread or prints span/metric noise into test output.
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Iterable, Iterator
from contextlib import contextmanager

from opentelemetry import metrics, trace
from opentelemetry.metrics import CallbackOptions, Observation
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from src.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

_SERVICE_NAME = "customer-support"
_TRACER_NAME = "customer_support"

_configure_lock = threading.Lock()
_configured = False


def configure_telemetry(settings: Settings | None = None) -> None:
    """Registers a real TracerProvider/MeterProvider — but only if an OTLP endpoint is
    configured. Idempotent, like configure_logging(). Safe (and intended) to call
    unconditionally from a process entrypoint (src/api/main.py's create_app()): with no endpoint
    set, this is a no-op and every span()/metric call in the codebase stays a real no-op too.
    """
    global _configured
    if _configured:
        return
    with _configure_lock:
        if _configured:
            return
        settings = settings or get_settings()
        if not settings.otel_exporter_endpoint:
            _configured = True
            logger.info("OTEL_EXPORTER_OTLP_ENDPOINT not set — tracing/metrics stay no-op.")
            return

        resource = Resource.create({"service.name": _SERVICE_NAME})

        tracer_provider = TracerProvider(resource=resource)
        tracer_provider.add_span_processor(_build_span_processor(settings))
        trace.set_tracer_provider(tracer_provider)

        metrics.set_meter_provider(_build_meter_provider(resource, settings))

        _configured = True
        logger.info("Telemetry configured (exporter=%s).", settings.otel_exporter_endpoint)


def _otlp_import_error(kind: str) -> ImportError:
    return ImportError(
        f"OTEL_EXPORTER_OTLP_ENDPOINT is set but opentelemetry-exporter-otlp-proto-grpc isn't "
        f"installed (needed for the OTLP {kind} exporter). Install it or unset "
        f"OTEL_EXPORTER_OTLP_ENDPOINT."
    )


def _build_span_processor(settings: Settings) -> BatchSpanProcessor:
    try:
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    except ImportError as exc:
        raise _otlp_import_error("span") from exc
    return BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otel_exporter_endpoint))


def _build_meter_provider(resource: Resource, settings: Settings):
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader

    try:
        from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
    except ImportError as exc:
        raise _otlp_import_error("metric") from exc

    exporter = OTLPMetricExporter(endpoint=settings.otel_exporter_endpoint)
    reader = PeriodicExportingMetricReader(exporter, export_interval_millis=60_000)
    return MeterProvider(resource=resource, metric_readers=[reader])


def get_tracer() -> trace.Tracer:
    return trace.get_tracer(_TRACER_NAME)


@contextmanager
def span(name: str, **attributes: object) -> Iterator[trace.Span]:
    """Thin wrapper over start_as_current_span: sets non-None kwargs as span attributes.

    Safe to use unconditionally at agent/tool/LLM call sites (ENTERPRISE_ARCHITECTURE.md Phase 3
    "OTel spans per agent/tool/LLM call") — becomes a real no-op span before configure_telemetry()
    runs, a real exported span after.
    """
    with get_tracer().start_as_current_span(name) as current_span:
        for key, value in attributes.items():
            if value is not None:
                current_span.set_attribute(key, value)
        yield current_span


class _Metrics:
    def __init__(self) -> None:
        meter = metrics.get_meter(_TRACER_NAME)
        self.tickets_total = meter.create_counter(
            "tickets_total", description="Tickets processed, by client"
        )
        self.tickets_resolved = meter.create_counter(
            "tickets_resolved_total", description="Tickets resolved without escalation"
        )
        self.tickets_escalated = meter.create_counter(
            "tickets_escalated_total", description="Tickets escalated to a human"
        )
        self.replanning_count = meter.create_histogram(
            "ticket_replanning_count", description="Replanning iterations per ticket"
        )
        self.provider_fallback = meter.create_counter(
            "llm_provider_fallback_total",
            description="LLM provider fallback events (a provider failed, gateway tried the next)",
        )
        meter.create_observable_gauge(
            "memory_size",
            callbacks=[_memory_size_callback],
            description="Per-client, per-memory-type entry count",
        )


_metrics: _Metrics | None = None
_metrics_lock = threading.Lock()


def _get_metrics() -> _Metrics:
    global _metrics
    if _metrics is None:
        with _metrics_lock:
            if _metrics is None:
                _metrics = _Metrics()
    return _metrics


def _memory_size_callback(_options: CallbackOptions) -> Iterable[Observation]:
    from src.memory.client_store import ClientStoreRegistry

    for client_id, store in ClientStoreRegistry.snapshot().items():
        for memory_type, chroma_store in (
            ("episodic", store.episodic),
            ("tool_failure", store.tool_failure),
            ("plan_success", store.plan_success),
            ("escalation", store.escalation),
        ):
            try:
                count = chroma_store.count()
            except Exception:
                continue
            yield Observation(count, {"client_id": client_id, "memory_type": memory_type})


def record_ticket_outcome(
    client_id: str, resolved: bool, escalate: bool, replanning_count: int
) -> None:
    m = _get_metrics()
    attrs = {"client_id": client_id}
    m.tickets_total.add(1, attrs)
    if resolved:
        m.tickets_resolved.add(1, attrs)
    if escalate:
        m.tickets_escalated.add(1, attrs)
    m.replanning_count.record(replanning_count, attrs)


def record_provider_fallback(role: str, provider: str) -> None:
    """Recorded when `provider` fails for `role` and the gateway falls through to the next
    configured provider — i.e. the fallback *trigger*, not every call to a fallback provider."""
    _get_metrics().provider_fallback.add(1, {"role": role, "provider": provider})
