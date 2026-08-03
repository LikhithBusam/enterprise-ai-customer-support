"""v2_full vs. Policy Memory ablation study — the controlled comparison flagged as missing in
the paper's Limitations section. `v2_full` and `policy_memory` are the same implementation
(`experiments/memory_augmented_v2.py`) with identical Critic/reliability-scoring configuration
(`ENABLE_CONDITIONED_CRITIC=1`, `ENABLE_TEMPLATE_ABSTRACTION=1`, `ENABLE_RELIABILITY_SCORING=1`
for both — see `scripts/run_experiment.py::run_baseline`); the *only* difference is
`ENABLE_POLICY_MEMORY` (0 for `v2_full`, 1 for `policy_memory`), which swaps the Planner's
retrieved context from `PlanSuccessMemory`-only to the fused Policy+Failure+Episodic context.

This isolates the retrieval-source variable that the paper's original `policy_memory` vs.
`memory_augmented` comparison could not: `memory_augmented` (Contribution 1, frozen) lacks the
conditioned Critic and reliability scoring both `v2_full` and `policy_memory` share, so that
comparison confounded retrieval source with critic architecture. This one does not.

Ad-hoc analysis/report generator — reuses scripts/analyze_policy_memory.py's metric functions and
scripts/analyze_results.py's chi-square test (both imported, not duplicated), and adds a Wilson
score confidence interval for resolution rate (no new dependency; standard closed-form formula).

Usage:
    python -m scripts.v2_full_ablation
"""

from __future__ import annotations

import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from scripts.analyze_policy_memory import compute_core_metrics, compute_policy_metrics, load_records
from scripts.analyze_results import perform_significance_test

REPO_ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = REPO_ROOT / "experiments" / "results"
OUT_DIR = RESULTS_DIR / "v2_full_ablation"
FAILURE_RATES = ["0.0", "0.3", "0.7"]
ARMS = ["v2_full", "policy_memory"]

COLORS = {"v2_full": "#0072B2", "policy_memory": "#CC79A7"}  # Okabe-Ito, fixed per arm
LABELS = {"v2_full": "v2_full (no Policy Memory)", "policy_memory": "Policy Memory"}


def wilson_ci(successes: int, total: int, z: float = 1.96) -> tuple[float, float]:
    """95% Wilson score interval for a binomial proportion. Preferred over the naive normal
    approximation for proportions near 0 or 1 and for moderate sample sizes (n=200 here).
    """
    if total == 0:
        return (0.0, 0.0)
    p_hat = successes / total
    denom = 1 + z**2 / total
    center = (p_hat + z**2 / (2 * total)) / denom
    margin = (z * math.sqrt((p_hat * (1 - p_hat) / total) + (z**2 / (4 * total**2)))) / denom
    return (max(0.0, center - margin), min(1.0, center + margin))


def load_all() -> dict[str, dict[str, list[dict]]]:
    data: dict[str, dict[str, list[dict]]] = {}
    for arm in ARMS:
        data[arm] = {}
        for rate in FAILURE_RATES:
            data[arm][rate] = load_records(RESULTS_DIR / f"{arm}_{rate}.jsonl")
    return data


def build_metrics(data: dict) -> dict:
    metrics: dict = {}
    for arm in ARMS:
        metrics[arm] = {}
        for rate in FAILURE_RATES:
            records = data[arm][rate]
            core = compute_core_metrics(records)
            policy = compute_policy_metrics(records) if arm == "policy_memory" else None
            ci = wilson_ci(core["resolved"], core["total"]) if core["total"] else (0.0, 0.0)
            metrics[arm][rate] = {"core": core, "policy": policy, "ci": ci}
    return metrics


def _fmt_pct(v: float | None) -> str:
    return "n/a" if v is None else f"{v * 100:.1f}%"


def _fmt_num(v: float | None, d: int = 2) -> str:
    return "n/a" if v is None else f"{v:.{d}f}"


def print_report(metrics: dict) -> str:
    lines: list[str] = []
    w = lines.append

    w("## Table A1 — v2_full vs. Policy Memory: Resolution Rate with 95% Wilson CI\n")
    w("| Failure Rate | Arm | Resolution Rate | 95% CI |")
    w("|---|---|---|---|")
    for rate in FAILURE_RATES:
        for arm in ARMS:
            c = metrics[arm][rate]["core"]
            lo, hi = metrics[arm][rate]["ci"]
            w(
                f"| {rate} | {LABELS[arm]} | {c['resolved']}/{c['total']} "
                f"({_fmt_pct(c['resolution_rate'])}) | [{lo*100:.1f}%, {hi*100:.1f}%] |"
            )
    w("")

    w("## Table A2 — Full metric comparison\n")
    w(
        "| Failure Rate | Arm | Avg Tool Calls | Avg Replans | Memory Hit Rate | "
        "Retrieval Distance | Avg Latency (ms) |"
    )
    w("|---|---|---|---|---|---|---|")
    for rate in FAILURE_RATES:
        for arm in ARMS:
            c = metrics[arm][rate]["core"]
            w(
                f"| {rate} | {LABELS[arm]} | {_fmt_num(c['avg_tool_calls'])} | "
                f"{_fmt_num(c['avg_replans'])} | {_fmt_pct(c['memory_hit_rate'])} | "
                f"{_fmt_num(c['avg_retrieval_distance'], 4)} | {_fmt_num(c['avg_latency_ms'], 0)} |"
            )
    w("")

    w("## Table A3 — Policy utilization (Policy Memory arm only; undefined for v2_full)\n")
    w(
        "| Failure Rate | Policy Retrieval Rate | Policy Reuse Rate | "
        "Resolution Rate (hit) | Resolution Rate (no hit) | Distinct Policies Used |"
    )
    w("|---|---|---|---|---|---|")
    for rate in FAILURE_RATES:
        p = metrics["policy_memory"][rate]["policy"]
        w(
            f"| {rate} | {_fmt_pct(p['policy_retrieval_rate'])} | {_fmt_pct(p['policy_reuse_rate'])} | "
            f"{_fmt_pct(p['resolution_rate_with_policy_hit'])} | "
            f"{_fmt_pct(p['resolution_rate_without_policy_hit'])} | {p['distinct_policies_used']} |"
        )
    w("")

    w("## Table A4 — Statistical significance (chi-square test, resolved vs. failed, v2_full vs. Policy Memory)\n")
    w("| Failure Rate | p-value | Significant (p<0.05)? | Direction |")
    w("|---|---|---|---|")
    for rate in FAILURE_RATES:
        d1 = metrics["v2_full"][rate]["core"]
        d2 = metrics["policy_memory"][rate]["core"]
        p = perform_significance_test(d1, d2)
        p_str = f"{p:.5f}" if p is not None else "n/a"
        sig = "yes" if (p is not None and p < 0.05) else "no"
        if p is not None and p < 0.05:
            direction = "Policy Memory higher" if d2["resolution_rate"] > d1["resolution_rate"] else "Policy Memory lower"
        else:
            direction = "—"
        w(f"| {rate} | {p_str} | {sig} | {direction} |")
    w("")

    text = "\n".join(lines)
    print(text)
    return text


def _unresolved_stats(records: list[dict]) -> dict:
    unresolved = [r for r in records if not r.get("resolved")]
    resolved = [r for r in records if r.get("resolved")]
    n_u = len(unresolved)
    n_r = len(resolved)
    pred_correct = [
        r.get("predicted_category") == r.get("actual_category")
        for r in records
        if r.get("predicted_category") and r.get("actual_category")
    ]
    return {
        "n_unresolved": n_u,
        "n_resolved": n_r,
        "avg_replans_unresolved": (sum(r.get("replanning_count", 0) for r in unresolved) / n_u) if n_u else None,
        "avg_tool_calls_unresolved": (sum(len(r.get("tool_calls_made", [])) for r in unresolved) / n_u) if n_u else None,
        "avg_replans_resolved": (sum(r.get("replanning_count", 0) for r in resolved) / n_r) if n_r else None,
        "critic_diagnosis_accuracy": (sum(pred_correct) / len(pred_correct)) if pred_correct else None,
        "n_diagnosis_samples": len(pred_correct),
    }


def print_root_cause_fr07(data: dict) -> str:
    """Root-cause comparison at FR=0.7, v2_full vs policy_memory: planner behaviour (tool
    calls/replans among unresolved), retrieval behaviour (memory hit rate / retrieval distance),
    tool reliability (critic diagnosis accuracy as a proxy — both arms share the same critic), and
    policy utilisation (policy_memory only). Every number here is measured directly from the
    per-ticket JSONL records — no simulation or estimation.
    """
    lines: list[str] = []
    w = lines.append
    w("## Root-Cause Comparison at FR = 0.7 (measured evidence only)\n")

    stats = {arm: _unresolved_stats(data[arm]["0.7"]) for arm in ARMS}
    core = {arm: compute_core_metrics(data[arm]["0.7"]) for arm in ARMS}

    w("### Planner behaviour (work done on tickets that ultimately failed)\n")
    w("| Arm | Unresolved tickets | Avg replans (unresolved) | Avg tool calls (unresolved) |")
    w("|---|---|---|---|")
    for arm in ARMS:
        s = stats[arm]
        w(f"| {LABELS[arm]} | {s['n_unresolved']} | {_fmt_num(s['avg_replans_unresolved'])} | {_fmt_num(s['avg_tool_calls_unresolved'])} |")
    w("")

    w("### Retrieval behaviour\n")
    w("| Arm | Memory Hit Rate | Avg Retrieval Distance |")
    w("|---|---|---|")
    for arm in ARMS:
        c = core[arm]
        w(f"| {LABELS[arm]} | {_fmt_pct(c['memory_hit_rate'])} | {_fmt_num(c['avg_retrieval_distance'], 4)} |")
    w("")

    w("### Tool-failure diagnosis accuracy (shared Critic — a proxy for \"tool reliability\" "
       "handling, since both arms use the identical failure-category-conditioned Critic)\n")
    w("| Arm | Critic Diagnosis Accuracy | Samples |")
    w("|---|---|---|")
    for arm in ARMS:
        s = stats[arm]
        w(f"| {LABELS[arm]} | {_fmt_pct(s['critic_diagnosis_accuracy'])} | {s['n_diagnosis_samples']} |")
    w("")

    pm = compute_policy_metrics(data["policy_memory"]["0.7"])
    w("### Policy utilisation (Policy Memory arm only)\n")
    w(
        f"- Policy Retrieval Rate: {_fmt_pct(pm['policy_retrieval_rate'])}\n"
        f"- Policy Reuse Rate: {_fmt_pct(pm['policy_reuse_rate'])}\n"
        f"- Resolution rate on policy hit: {_fmt_pct(pm['resolution_rate_with_policy_hit'])}\n"
        f"- Resolution rate on no hit: {_fmt_pct(pm['resolution_rate_without_policy_hit'])}\n"
        f"- Distinct policies used: {pm['distinct_policies_used']}\n"
    )

    text = "\n".join(lines)
    print(text)
    return text


def plot_resolution_rate_with_ci(metrics: dict) -> None:
    fig, ax = plt.subplots(figsize=(7, 4.5), dpi=150)
    x = np.arange(len(FAILURE_RATES))
    width = 0.32
    for i, arm in enumerate(ARMS):
        vals = [metrics[arm][r]["core"]["resolution_rate"] * 100 for r in FAILURE_RATES]
        los = [metrics[arm][r]["ci"][0] * 100 for r in FAILURE_RATES]
        his = [metrics[arm][r]["ci"][1] * 100 for r in FAILURE_RATES]
        err_low = [v - lo for v, lo in zip(vals, los)]
        err_high = [hi - v for v, hi in zip(vals, his)]
        offset = (i - 0.5) * width
        ax.bar(x + offset, vals, width, label=LABELS[arm], color=COLORS[arm],
               yerr=[err_low, err_high], capsize=4)
    ax.set_xticks(x)
    ax.set_xticklabels([f"FR = {r}" for r in FAILURE_RATES])
    ax.set_ylabel("Resolution Rate (%)")
    ax.set_ylim(0, 110)
    ax.set_title("v2_full vs. Policy Memory: Resolution Rate (95% Wilson CI)")
    ax.legend(frameon=False, loc="upper right", fontsize=8)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    fig.tight_layout()
    fig.savefig(OUT_DIR / "resolution_rate_ci.png")
    plt.close(fig)


def plot_replans_tool_calls(metrics: dict) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5), dpi=150)
    x = np.arange(len(FAILURE_RATES))
    width = 0.32
    for i, arm in enumerate(ARMS):
        replans = [metrics[arm][r]["core"]["avg_replans"] for r in FAILURE_RATES]
        calls = [metrics[arm][r]["core"]["avg_tool_calls"] for r in FAILURE_RATES]
        offset = (i - 0.5) * width
        axes[0].bar(x + offset, replans, width, label=LABELS[arm], color=COLORS[arm])
        axes[1].bar(x + offset, calls, width, label=LABELS[arm], color=COLORS[arm])
    axes[0].set_ylabel("Avg Replanning Count")
    axes[0].set_title("Replanning Overhead")
    axes[1].set_ylabel("Avg Tool Calls")
    axes[1].set_title("Tool-Call Volume")
    for ax in axes:
        ax.set_xticks(x)
        ax.set_xticklabels([f"FR = {r}" for r in FAILURE_RATES])
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.grid(axis="y", linestyle="--", alpha=0.3)
    axes[0].legend(frameon=False, loc="upper left", fontsize=8)
    fig.tight_layout()
    fig.savefig(OUT_DIR / "replans_and_tool_calls.png")
    plt.close(fig)


def plot_memory_hit_and_distance(metrics: dict) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5), dpi=150)
    x = np.arange(len(FAILURE_RATES))
    width = 0.32
    for i, arm in enumerate(ARMS):
        hits = [(metrics[arm][r]["core"]["memory_hit_rate"] or 0.0) * 100 for r in FAILURE_RATES]
        dists = [metrics[arm][r]["core"]["avg_retrieval_distance"] or 0.0 for r in FAILURE_RATES]
        offset = (i - 0.5) * width
        axes[0].bar(x + offset, hits, width, label=LABELS[arm], color=COLORS[arm])
        axes[1].bar(x + offset, dists, width, label=LABELS[arm], color=COLORS[arm])
    axes[0].set_ylabel("Memory Hit Rate (%)")
    axes[0].set_title("Memory Hit Rate")
    axes[1].set_ylabel("Avg Retrieval Distance (lower = closer)")
    axes[1].set_title("Retrieval Distance")
    for ax in axes:
        ax.set_xticks(x)
        ax.set_xticklabels([f"FR = {r}" for r in FAILURE_RATES])
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.grid(axis="y", linestyle="--", alpha=0.3)
    axes[0].legend(frameon=False, loc="best", fontsize=8)
    fig.tight_layout()
    fig.savefig(OUT_DIR / "memory_hit_and_distance.png")
    plt.close(fig)


def plot_latency(metrics: dict) -> None:
    fig, ax = plt.subplots(figsize=(7, 4.5), dpi=150)
    x = np.arange(len(FAILURE_RATES))
    width = 0.32
    for i, arm in enumerate(ARMS):
        vals = [metrics[arm][r]["core"]["avg_latency_ms"] or 0.0 for r in FAILURE_RATES]
        offset = (i - 0.5) * width
        ax.bar(x + offset, vals, width, label=LABELS[arm], color=COLORS[arm])
    ax.set_xticks(x)
    ax.set_xticklabels([f"FR = {r}" for r in FAILURE_RATES])
    ax.set_ylabel("Avg Latency per Ticket (ms)")
    ax.set_title("v2_full vs. Policy Memory: Latency")
    ax.legend(frameon=False, loc="best", fontsize=8)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    fig.tight_layout()
    fig.savefig(OUT_DIR / "latency.png")
    plt.close(fig)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    data = load_all()
    metrics = build_metrics(data)

    report_text = print_report(metrics)
    root_cause_text = print_root_cause_fr07(data)
    (OUT_DIR / "report.md").write_text(report_text + "\n" + root_cause_text, encoding="utf-8")

    plot_resolution_rate_with_ci(metrics)
    plot_replans_tool_calls(metrics)
    plot_memory_hit_and_distance(metrics)
    plot_latency(metrics)

    print(f"\nReport written to {OUT_DIR / 'report.md'}")
    print(f"Figures written to {OUT_DIR}/*.png")


if __name__ == "__main__":
    main()
