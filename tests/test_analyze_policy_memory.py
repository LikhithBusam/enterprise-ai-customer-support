from __future__ import annotations

import pytest

from scripts.analyze_policy_memory import compute_core_metrics, compute_policy_metrics


class TestComputeCoreMetrics:
    def test_empty_records(self) -> None:
        m = compute_core_metrics([])
        assert m["total"] == 0
        assert m["resolution_rate"] == 0.0
        assert m["memory_hit_rate"] is None
        assert m["avg_retrieval_distance"] is None
        assert m["avg_latency_ms"] is None

    def test_basic_resolution_and_replans(self) -> None:
        records = [
            {"resolved": True, "replanning_count": 1, "tool_calls_made": [{}, {}]},
            {"resolved": False, "replanning_count": 2, "tool_calls_made": [{}]},
        ]
        m = compute_core_metrics(records)
        assert m["total"] == 2
        assert m["resolved"] == 1
        assert m["resolution_rate"] == 0.5
        assert m["avg_replans"] == 1.5
        assert m["avg_tool_calls"] == 1.5

    def test_memory_hit_rate_only_over_records_that_report_it(self) -> None:
        records = [
            {"resolved": True, "memory_hit": True},
            {"resolved": True, "memory_hit": False},
            {"resolved": True},  # baseline that never records memory_hit at all
        ]
        m = compute_core_metrics(records)
        assert m["memory_hit_rate"] == 0.5

    def test_retrieval_distance_ignores_none(self) -> None:
        records = [
            {"resolved": True, "retrieval_distance": 0.2},
            {"resolved": True, "retrieval_distance": None},
            {"resolved": True},
        ]
        m = compute_core_metrics(records)
        assert m["avg_retrieval_distance"] == 0.2

    def test_latency_average(self) -> None:
        records = [{"resolved": True, "latency_ms": 100.0}, {"resolved": True, "latency_ms": 200.0}]
        m = compute_core_metrics(records)
        assert m["avg_latency_ms"] == 150.0


class TestComputePolicyMetrics:
    def test_empty_records(self) -> None:
        m = compute_policy_metrics([])
        assert m["policy_retrieval_rate"] is None
        assert m["policy_reuse_rate"] is None
        assert m["distinct_policies_used"] == 0

    def test_retrieval_rate_and_reuse_rate(self) -> None:
        records = [
            {"resolved": True, "policy_hit": True, "policy_usage_count_at_use": 1, "policy_id_used": "p1"},
            {"resolved": True, "policy_hit": True, "policy_usage_count_at_use": 3, "policy_id_used": "p1"},
            {"resolved": False, "policy_hit": False},
        ]
        m = compute_policy_metrics(records)
        assert m["policy_retrieval_rate"] == pytest.approx(2 / 3)
        # Only 1 of the 2 hits had usage_count_at_use >= 2 (genuine reuse).
        assert m["policy_reuse_rate"] == 0.5
        assert m["distinct_policies_used"] == 1

    def test_resolution_rate_conditioned_on_hit_vs_miss(self) -> None:
        records = [
            {"resolved": True, "policy_hit": True},
            {"resolved": True, "policy_hit": True},
            {"resolved": False, "policy_hit": False},
            {"resolved": True, "policy_hit": False},
        ]
        m = compute_policy_metrics(records)
        assert m["resolution_rate_with_policy_hit"] == 1.0
        assert m["resolution_rate_without_policy_hit"] == 0.5

    def test_no_hits_leaves_hit_conditioned_metrics_none(self) -> None:
        records = [{"resolved": True, "policy_hit": False}]
        m = compute_policy_metrics(records)
        assert m["policy_reuse_rate"] is None
        assert m["resolution_rate_with_policy_hit"] is None
