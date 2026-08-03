"""Final experimental validation report: Policy Memory (Contribution 2) vs the three existing
baselines (memoryless / static_react / memory_augmented), across failure rates 0.0 / 0.3 / 0.7.

Ad-hoc validation deliverable — this is a report generator, not a new system feature. It reuses
scripts/analyze_policy_memory.py's metric functions and scripts/analyze_results.py's
chi-square significance test (both imported unmodified) rather than recomputing anything this
repo already has a tested implementation of.

Produces:
- Markdown tables (core comparison, Policy Memory detail, significance tests) printed to stdout
  and written to experiments/results/policy_memory_validation/report.md
- Publication-style PNG figures under experiments/results/policy_memory_validation/

Usage:
    python -m scripts.policy_memory_validation
"""

from __future__ import annotations

import io
import sys
from contextlib import redirect_stdout
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from scripts.analyze_policy_memory import compute_core_metrics, compute_policy_metrics, load_records
from scripts.analyze_results import perform_significance_test

REPO_ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = REPO_ROOT / "experiments" / "results"
OUT_DIR = RESULTS_DIR / "policy_memory_validation"
FAILURE_RATES = ["0.0", "0.3", "0.7"]
BASELINES = ["memoryless", "static_react", "memory_augmented", "policy_memory"]

# Okabe & Ito (2008) colorblind-safe categorical palette — fixed assignment per baseline,
# never reordered/recycled across figures (dataviz skill: "assign categorical hues in fixed
# order, never cycled").
COLORS = {
    "memoryless": "#E69F00",  # orange
    "static_react": "#56B4E9",  # sky blue
    "memory_augmented": "#009E73",  # bluish green
    "policy_memory": "#CC79A7",  # reddish purple
}
LABELS = {
    "memoryless": "Memoryless",
    "static_react": "Static ReAct",
    "memory_augmented": "Memory Augmented",
    "policy_memory": "Policy Memory",
}


def load_all() -> dict[str, dict[str, list[dict]]]:
    data: dict[str, dict[str, list[dict]]] = {}
    for baseline in BASELINES:
        data[baseline] = {}
        for rate in FAILURE_RATES:
            data[baseline][rate] = load_records(RESULTS_DIR / f"{baseline}_{rate}.jsonl")
    return data


def build_metrics(data: dict) -> dict:
    metrics: dict = {}
    for baseline in BASELINES:
        metrics[baseline] = {}
        for rate in FAILURE_RATES:
            records = data[baseline][rate]
            core = compute_core_metrics(records)
            policy = compute_policy_metrics(records) if baseline == "policy_memory" else None
            metrics[baseline][rate] = {"core": core, "policy": policy}
    return metrics


def _fmt_pct(value: float | None) -> str:
    return "n/a" if value is None else f"{value * 100:.1f}%"


def _fmt_num(value: float | None, digits: int = 2) -> str:
    return "n/a" if value is None else f"{value:.{digits}f}"


def print_main_table(metrics: dict) -> None:
    print("## Table 1 — Core comparison across all four baselines\n")
    print(
        "| Failure Rate | Baseline | Resolution Rate | Avg Tool Calls | Avg Replans | "
        "Memory Hit Rate | Retrieval Distance | Avg Latency (ms) |"
    )
    print("|---|---|---|---|---|---|---|---|")
    for rate in FAILURE_RATES:
        for baseline in BASELINES:
            c = metrics[baseline][rate]["core"]
            if c["total"] == 0:
                print(f"| {rate} | {LABELS[baseline]} | n/a (no results file) | | | | | |")
                continue
            print(
                f"| {rate} | {LABELS[baseline]} | {c['resolved']}/{c['total']} "
                f"({_fmt_pct(c['resolution_rate'])}) | {_fmt_num(c['avg_tool_calls'])} | "
                f"{_fmt_num(c['avg_replans'])} | {_fmt_pct(c['memory_hit_rate'])} | "
                f"{_fmt_num(c['avg_retrieval_distance'], 4)} | {_fmt_num(c['avg_latency_ms'], 0)} |"
            )
    print()


def print_policy_table(metrics: dict) -> None:
    print("## Table 2 — Policy Memory detail (retrieval / reuse / generalization)\n")
    print(
        "| Failure Rate | Policy Retrieval Rate | Policy Reuse Rate | "
        "Resolution Rate (policy hit) | Resolution Rate (no hit) | Distinct Policies Used |"
    )
    print("|---|---|---|---|---|---|")
    for rate in FAILURE_RATES:
        p = metrics["policy_memory"][rate]["policy"]
        if p is None or metrics["policy_memory"][rate]["core"]["total"] == 0:
            continue
        print(
            f"| {rate} | {_fmt_pct(p['policy_retrieval_rate'])} | {_fmt_pct(p['policy_reuse_rate'])} | "
            f"{_fmt_pct(p['resolution_rate_with_policy_hit'])} | "
            f"{_fmt_pct(p['resolution_rate_without_policy_hit'])} | {p['distinct_policies_used']} |"
        )
    print()


def print_significance_table(metrics: dict) -> None:
    print("## Table 3 — Statistical significance (chi-square test of independence, resolved vs. failed)\n")
    print("| Failure Rate | Comparison | p-value | Significant (p < 0.05)? |")
    print("|---|---|---|---|")
    comparisons = [
        ("policy_memory", "memory_augmented", "Policy Memory vs Memory Augmented"),
        ("policy_memory", "static_react", "Policy Memory vs Static ReAct"),
        ("policy_memory", "memoryless", "Policy Memory vs Memoryless"),
    ]
    for rate in FAILURE_RATES:
        for arm_a, arm_b, label in comparisons:
            d1 = metrics[arm_a][rate]["core"]
            d2 = metrics[arm_b][rate]["core"]
            if d1["total"] == 0 or d2["total"] == 0:
                continue
            p = perform_significance_test(d1, d2)
            p_str = f"{p:.5f}" if p is not None else "n/a"
            sig = "yes" if (p is not None and p < 0.05) else "no"
            print(f"| {rate} | {label} | {p_str} | {sig} |")
    print()


def _grouped_bar(metrics: dict, key_path: tuple[str, ...], ylabel: str, title: str, filename: str) -> None:
    fig, ax = plt.subplots(figsize=(7.5, 4.5), dpi=150)
    x = np.arange(len(FAILURE_RATES))
    width = 0.19
    n = len(BASELINES)
    for i, baseline in enumerate(BASELINES):
        vals = []
        for rate in FAILURE_RATES:
            d = metrics[baseline][rate]
            for part in key_path:
                d = d[part] if d is not None else None
            vals.append(d if d is not None else 0.0)
        offset = (i - (n - 1) / 2) * width
        ax.bar(x + offset, vals, width, label=LABELS[baseline], color=COLORS[baseline])
    ax.set_xticks(x)
    ax.set_xticklabels([f"FR = {r}" for r in FAILURE_RATES])
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.legend(frameon=False, loc="best", fontsize=8)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    fig.tight_layout()
    fig.savefig(OUT_DIR / filename)
    plt.close(fig)


def plot_resolution_rate(metrics: dict) -> None:
    fig, ax = plt.subplots(figsize=(7.5, 4.5), dpi=150)
    x = np.arange(len(FAILURE_RATES))
    width = 0.19
    n = len(BASELINES)
    for i, baseline in enumerate(BASELINES):
        vals = [metrics[baseline][r]["core"]["resolution_rate"] * 100 for r in FAILURE_RATES]
        offset = (i - (n - 1) / 2) * width
        ax.bar(x + offset, vals, width, label=LABELS[baseline], color=COLORS[baseline])
    ax.set_xticks(x)
    ax.set_xticklabels([f"FR = {r}" for r in FAILURE_RATES])
    ax.set_ylabel("Resolution Rate (%)")
    ax.set_ylim(0, 108)
    ax.set_title("Resolution Rate by Baseline and Failure Rate")
    ax.legend(frameon=False, loc="upper right", fontsize=8)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    fig.tight_layout()
    fig.savefig(OUT_DIR / "resolution_rate.png")
    plt.close(fig)


def plot_replans_and_tool_calls(metrics: dict) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5), dpi=150)
    x = np.arange(len(FAILURE_RATES))
    width = 0.19
    n = len(BASELINES)
    for i, baseline in enumerate(BASELINES):
        replans = [metrics[baseline][r]["core"]["avg_replans"] for r in FAILURE_RATES]
        calls = [metrics[baseline][r]["core"]["avg_tool_calls"] for r in FAILURE_RATES]
        offset = (i - (n - 1) / 2) * width
        axes[0].bar(x + offset, replans, width, label=LABELS[baseline], color=COLORS[baseline])
        axes[1].bar(x + offset, calls, width, label=LABELS[baseline], color=COLORS[baseline])
    for ax, ylabel, title in (
        (axes[0], "Avg Replanning Count", "Replanning Overhead"),
        (axes[1], "Avg Tool Calls", "Tool-Call Volume"),
    ):
        ax.set_xticks(x)
        ax.set_xticklabels([f"FR = {r}" for r in FAILURE_RATES])
        ax.set_ylabel(ylabel)
        ax.set_title(title)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.grid(axis="y", linestyle="--", alpha=0.3)
    axes[0].legend(frameon=False, loc="upper left", fontsize=8)
    fig.tight_layout()
    fig.savefig(OUT_DIR / "replans_and_tool_calls.png")
    plt.close(fig)


def plot_memory_hit_and_distance(metrics: dict) -> None:
    """Only memory_augmented and policy_memory retrieve from memory — the other two baselines
    have no memory_hit/retrieval_distance concept at all."""
    memory_baselines = ["memory_augmented", "policy_memory"]
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5), dpi=150)
    x = np.arange(len(FAILURE_RATES))
    width = 0.32
    for i, baseline in enumerate(memory_baselines):
        hits = [
            (metrics[baseline][r]["core"]["memory_hit_rate"] or 0.0) * 100 for r in FAILURE_RATES
        ]
        dists = [metrics[baseline][r]["core"]["avg_retrieval_distance"] or 0.0 for r in FAILURE_RATES]
        offset = (i - 0.5) * width
        axes[0].bar(x + offset, hits, width, label=LABELS[baseline], color=COLORS[baseline])
        axes[1].bar(x + offset, dists, width, label=LABELS[baseline], color=COLORS[baseline])
    axes[0].set_ylabel("Memory Hit Rate (%)")
    axes[0].set_title("Memory Hit Rate")
    axes[1].set_ylabel("Avg Retrieval Distance (lower = closer match)")
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
    """latency_ms was only added to scripts/run_experiment.py's recording this session — the
    existing memoryless/static_react/memory_augmented result files predate it and have no
    latency data. Only policy_memory (freshly run) has it; plotted alone, with that gap noted in
    the report text rather than silently papered over."""
    rates_with_data = [r for r in FAILURE_RATES if metrics["policy_memory"][r]["core"]["avg_latency_ms"] is not None]
    if not rates_with_data:
        return
    fig, ax = plt.subplots(figsize=(6, 4.5), dpi=150)
    x = np.arange(len(rates_with_data))
    vals = [metrics["policy_memory"][r]["core"]["avg_latency_ms"] for r in rates_with_data]
    ax.bar(x, vals, 0.5, color=COLORS["policy_memory"])
    ax.set_xticks(x)
    ax.set_xticklabels([f"FR = {r}" for r in rates_with_data])
    ax.set_ylabel("Avg Latency per Ticket (ms)")
    ax.set_title("Policy Memory: Latency by Failure Rate\n(no comparable data for other baselines — see report notes)")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    fig.tight_layout()
    fig.savefig(OUT_DIR / "latency.png")
    plt.close(fig)


def plot_policy_retrieval_reuse(metrics: dict) -> None:
    fig, ax = plt.subplots(figsize=(6.5, 4.5), dpi=150)
    x = np.arange(len(FAILURE_RATES))
    width = 0.32
    retrieval = [
        (metrics["policy_memory"][r]["policy"]["policy_retrieval_rate"] or 0.0) * 100
        for r in FAILURE_RATES
    ]
    reuse = [
        (metrics["policy_memory"][r]["policy"]["policy_reuse_rate"] or 0.0) * 100 for r in FAILURE_RATES
    ]
    ax.bar(x - width / 2, retrieval, width, label="Policy Retrieval Rate", color=COLORS["policy_memory"])
    ax.bar(x + width / 2, reuse, width, label="Policy Reuse Rate", color="#0072B2")
    ax.set_xticks(x)
    ax.set_xticklabels([f"FR = {r}" for r in FAILURE_RATES])
    ax.set_ylabel("Rate (%)")
    ax.set_title("Policy Memory: Retrieval vs. Genuine Reuse")
    ax.legend(frameon=False, loc="best", fontsize=8)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    fig.tight_layout()
    fig.savefig(OUT_DIR / "policy_retrieval_reuse.png")
    plt.close(fig)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    data = load_all()
    metrics = build_metrics(data)

    buf = io.StringIO()
    with redirect_stdout(buf):
        print_main_table(metrics)
        print_policy_table(metrics)
        print_significance_table(metrics)
    report_text = buf.getvalue()
    print(report_text)

    (OUT_DIR / "report.md").write_text(report_text, encoding="utf-8")

    plot_resolution_rate(metrics)
    plot_replans_and_tool_calls(metrics)
    plot_memory_hit_and_distance(metrics)
    plot_latency(metrics)
    plot_policy_retrieval_reuse(metrics)

    print(f"Report written to {OUT_DIR / 'report.md'}")
    print(f"Figures written to {OUT_DIR}/*.png")


if __name__ == "__main__":
    sys.exit(main())
