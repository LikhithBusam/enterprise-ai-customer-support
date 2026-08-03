"""Policy Memory evaluation (Policy_Memory_Implementation_Plan.md, Contribution 2).

Extends scripts/compute_summary.py's per-baseline JSONL summary with the metrics
Policy_Memory_Implementation_Plan.md's Evaluation section asks for that the existing script
doesn't compute: Policy Retrieval Rate, Policy Reuse Rate, and resolution rate conditioned on a
policy hit vs no hit (the generalization/transfer signal — if a stored policy genuinely
generalizes, resolution rate should be higher when one was retrieved and used than when the
Planner had to plan from scratch).

Compares Memoryless / Static ReAct / Memory Augmented / Policy Memory per Failure Rate, reusing
the same JSONL-loading + markdown-table style as compute_summary.py/analyze_results.py rather than
introducing a new convention.

Metric computation is split into pure functions (compute_core_metrics/compute_policy_metrics)
taking plain `list[dict]` so tests/test_analyze_policy_memory.py can exercise them without
touching the filesystem.
"""

from __future__ import annotations

import json
from pathlib import Path

RESULTS_DIR = Path("experiments/results")
FAILURE_RATES = ["0.0", "0.3", "0.7"]
COMPARISON_BASELINES = ["memoryless", "static_react", "memory_augmented", "policy_memory"]


def load_records(path: Path) -> list[dict]:
    if not path.exists():
        return []
    records: list[dict] = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def compute_core_metrics(records: list[dict]) -> dict:
    """Resolution Rate / Replanning Count / Tool Calls / Memory Hit Rate / Retrieval Distance /
    Latency. Fields a given baseline doesn't record (e.g. memoryless has no memory_hit) simply
    fall out of their average as `None` rather than raising — this is meant to run over any of
    the four compared baselines' JSONL shapes, not just policy_memory's.
    """
    total = len(records)
    if total == 0:
        return {
            "total": 0,
            "resolved": 0,
            "resolution_rate": 0.0,
            "avg_replans": 0.0,
            "avg_tool_calls": 0.0,
            "memory_hit_rate": None,
            "avg_retrieval_distance": None,
            "avg_latency_ms": None,
        }

    resolved = sum(1 for r in records if r.get("resolved", False))
    replans = [r.get("replanning_count", 0) for r in records]
    tool_calls = [len(r.get("tool_calls_made", [])) for r in records]

    hits = [r["memory_hit"] for r in records if "memory_hit" in r]
    memory_hit_rate = (sum(hits) / len(hits)) if hits else None

    distances = [
        r["retrieval_distance"] for r in records if r.get("retrieval_distance") is not None
    ]
    avg_distance = (sum(distances) / len(distances)) if distances else None

    latencies = [r["latency_ms"] for r in records if r.get("latency_ms") is not None]
    avg_latency = (sum(latencies) / len(latencies)) if latencies else None

    return {
        "total": total,
        "resolved": resolved,
        "resolution_rate": resolved / total,
        "avg_replans": sum(replans) / total,
        "avg_tool_calls": sum(tool_calls) / total,
        "memory_hit_rate": memory_hit_rate,
        "avg_retrieval_distance": avg_distance,
        "avg_latency_ms": avg_latency,
    }


def compute_policy_metrics(records: list[dict]) -> dict:
    """Contribution-2-specific metrics. Only meaningful for policy_memory's own records — other
    baselines' records simply won't have `policy_hit` set, so this returns all-None/0 for them
    rather than misleadingly reporting a 0% retrieval rate.

    Policy Reuse Rate: of the tickets that hit a policy, what fraction hit one that had *already*
    been reinforced by >=2 prior tickets (policy_usage_count_at_use >= 2) at retrieval time — a
    hit at usage_count 1 means "the policy exists and was used once before," which is weaker
    evidence of real reuse than usage_count >= 2.

    Distinct Policies Used is a lower-bound proxy for "Memory Growth" computed purely from the
    per-ticket JSONL (no live DB access needed for this post-hoc script) — it undercounts any
    policy that was created but never subsequently retrieved within this tier. For the exact
    collection size, call `memory.policy_store.count_policies(client_id)` right after the run.
    """
    total = len(records)
    if total == 0:
        return {
            "policy_retrieval_rate": None,
            "policy_reuse_rate": None,
            "resolution_rate_with_policy_hit": None,
            "resolution_rate_without_policy_hit": None,
            "distinct_policies_used": 0,
        }

    hits = [r for r in records if r.get("policy_hit")]
    misses = [r for r in records if not r.get("policy_hit")]
    reused = [r for r in hits if (r.get("policy_usage_count_at_use") or 0) >= 2]

    def _resolution_rate(subset: list[dict]) -> float | None:
        if not subset:
            return None
        return sum(1 for r in subset if r.get("resolved", False)) / len(subset)

    distinct_policies = {r["policy_id_used"] for r in records if r.get("policy_id_used")}

    return {
        "policy_retrieval_rate": len(hits) / total,
        "policy_reuse_rate": (len(reused) / len(hits)) if hits else None,
        "resolution_rate_with_policy_hit": _resolution_rate(hits),
        "resolution_rate_without_policy_hit": _resolution_rate(misses),
        "distinct_policies_used": len(distinct_policies),
    }


def _fmt_pct(value: float | None) -> str:
    return f"{value * 100:.1f}%" if value is not None else "n/a"


def _fmt_num(value: float | None, digits: int = 2) -> str:
    return f"{value:.{digits}f}" if value is not None else "n/a"


def print_core_comparison() -> None:
    print("## Core comparison: Memoryless vs Static ReAct vs Memory Augmented vs Policy Memory\n")
    print(
        "| Failure Rate | Baseline | Resolution Rate | Avg Replans | Avg Tool Calls | "
        "Memory Hit Rate | Avg Retrieval Distance | Avg Latency (ms) |"
    )
    print("|---|---|---|---|---|---|---|---|")
    for rate in FAILURE_RATES:
        for baseline in COMPARISON_BASELINES:
            records = load_records(RESULTS_DIR / f"{baseline}_{rate}.jsonl")
            if not records:
                continue
            m = compute_core_metrics(records)
            print(
                f"| {rate} | {baseline} | {m['resolved']}/{m['total']} "
                f"({_fmt_pct(m['resolution_rate'])}) | {_fmt_num(m['avg_replans'])} | "
                f"{_fmt_num(m['avg_tool_calls'])} | {_fmt_pct(m['memory_hit_rate'])} | "
                f"{_fmt_num(m['avg_retrieval_distance'], 4)} | {_fmt_num(m['avg_latency_ms'])} |"
            )
    print()


def print_policy_memory_detail() -> None:
    print("## Policy Memory detail (generalization / reuse metrics)\n")
    print(
        "| Failure Rate | Policy Retrieval Rate | Policy Reuse Rate | "
        "Resolution Rate (policy hit) | Resolution Rate (no hit) | Distinct Policies Used |"
    )
    print("|---|---|---|---|---|---|")
    for rate in FAILURE_RATES:
        records = load_records(RESULTS_DIR / f"policy_memory_{rate}.jsonl")
        if not records:
            continue
        m = compute_policy_metrics(records)
        print(
            f"| {rate} | {_fmt_pct(m['policy_retrieval_rate'])} | "
            f"{_fmt_pct(m['policy_reuse_rate'])} | "
            f"{_fmt_pct(m['resolution_rate_with_policy_hit'])} | "
            f"{_fmt_pct(m['resolution_rate_without_policy_hit'])} | "
            f"{m['distinct_policies_used']} |"
        )
    print()


def main() -> None:
    print_core_comparison()
    print_policy_memory_detail()


if __name__ == "__main__":
    main()
