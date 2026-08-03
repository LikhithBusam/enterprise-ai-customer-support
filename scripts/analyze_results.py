#!/usr/bin/env python3
"""
Analyze experiment results and generate LaTeX/Markdown comparison tables and statistical significance tests.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from collections import defaultdict
import numpy as np

try:
    from scipy.stats import chi2_contingency
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

REPO_ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = REPO_ROOT / "experiments" / "results"
TICKETS_FILE = REPO_ROOT / "data" / "synthetic_tickets_v2.jsonl"

BASELINES = [
    "memoryless",
    "static_react",
    "memory_augmented",
    "v2_critic_only",
    "v2_template_only",
    "v2_full",
    "langgraph_react",
]
FAILURE_RATES = ["0.0", "0.3", "0.7"]


def load_tickets() -> dict[str, dict]:
    tickets = {}
    if not TICKETS_FILE.exists():
        return tickets
    with open(TICKETS_FILE) as f:
        for line in f:
            if line.strip():
                t = json.loads(line)
                tickets[t["ticket_id"]] = t
    return tickets


def analyze_baseline_file(filepath: Path, tickets: dict[str, dict]) -> dict | None:
    if not filepath.exists():
        return None

    records = []
    with open(filepath) as f:
        for line in f:
            if line.strip():
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    pass

    if not records:
        return None

    # Deduplicate by ticket_id: keep the LAST entry (most recent run)
    seen = {}
    for r in records:
        seen[r["ticket_id"]] = r
    unique_records = list(seen.values())

    total = len(unique_records)
    resolved = sum(1 for r in unique_records if r.get("resolved", False))
    resolution_rate = resolved / total if total > 0 else 0.0

    steps = [r.get("steps_taken", 0) for r in unique_records]
    avg_steps = sum(steps) / total if total > 0 else 0.0

    replans = [r.get("replanning_count", 0) for r in unique_records]
    avg_replans = sum(replans) / total if total > 0 else 0.0

    tool_calls = [len(r.get("tool_calls_made", [])) for r in unique_records]
    avg_tool_calls = sum(tool_calls) / total if total > 0 else 0.0

    # Memory hits tracking
    memory_hits = [r.get("memory_hit", False) for r in unique_records if "memory_hit" in r]
    avg_mem_hits = sum(memory_hits) / len(memory_hits) if memory_hits else 0.0

    # V2 fields tracking
    pred_correct = []
    distances = []
    confidences = []
    
    for r in unique_records:
        pred_cat = r.get("predicted_category")
        act_cat = r.get("actual_category")
        if pred_cat and act_cat:
            pred_correct.append(pred_cat == act_cat)
        
        dist = r.get("retrieval_distance")
        if dist is not None:
            distances.append(dist)
            
        conf = r.get("critic_confidence")
        if conf is not None:
            confidences.append(conf)

    pred_accuracy = sum(pred_correct) / len(pred_correct) if pred_correct else 0.0
    avg_dist = sum(distances) / len(distances) if distances else 0.0
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

    # Stratified analysis by edge type
    edge_types = defaultdict(lambda: {"total": 0, "resolved": 0})
    for r in unique_records:
        t_id = r["ticket_id"]
        t_info = tickets.get(t_id, {})
        etype = t_info.get("edge_type", "standard")
        edge_types[etype]["total"] += 1
        if r.get("resolved", False):
            edge_types[etype]["resolved"] += 1

    edge_rates = {}
    for etype, stats in edge_types.items():
        edge_rates[etype] = stats["resolved"] / stats["total"] if stats["total"] > 0 else 0.0

    return {
        "total": total,
        "resolved": resolved,
        "resolution_rate": resolution_rate,
        "avg_steps": avg_steps,
        "avg_replans": avg_replans,
        "avg_tool_calls": avg_tool_calls,
        "avg_mem_hits": avg_mem_hits,
        "pred_accuracy": pred_accuracy,
        "avg_dist": avg_dist,
        "avg_conf": avg_conf,
        "edge_rates": edge_rates,
        "raw_resolved_list": [1 if r.get("resolved", False) else 0 for r in unique_records]
    }


def perform_significance_test(arm1_data: dict, arm2_data: dict) -> float | None:
    if not HAS_SCIPY:
        return None
    
    # Construct contingency table
    #             Success    Failure
    # Arm 1        S1         F1
    # Arm 2        S2         F2
    s1 = arm1_data["resolved"]
    f1 = arm1_data["total"] - s1
    s2 = arm2_data["resolved"]
    f2 = arm2_data["total"] - s2

    obs = np.array([[s1, f1], [s2, f2]])
    try:
        chi2, p_val, dof, expected = chi2_contingency(obs)
        return p_val
    except Exception:
        return None


def main() -> None:
    tickets = load_tickets()
    print(f"Loaded {len(tickets)} synthetic tickets for metadata tracking.")

    # Load all results
    results = {}
    for baseline in BASELINES:
        results[baseline] = {}
        for rate in FAILURE_RATES:
            filepath = RESULTS_DIR / f"{baseline}_{rate}.jsonl"
            data = analyze_baseline_file(filepath, tickets)
            if data:
                results[baseline][rate] = data

    print("\n========================================================")
    print("EXPERIMENT RESULTS: TASK COMPLETION RATE")
    print("========================================================")
    
    # Print markdown table for resolution rates
    print("| Baseline | FR = 0.0 | FR = 0.3 | FR = 0.7 |")
    print("|---|---|---|---|")
    for baseline in BASELINES:
        rates_str = []
        for rate in FAILURE_RATES:
            data = results[baseline].get(rate)
            if data:
                rates_str.append(f"{data['resolution_rate'] * 100:.1f}% ({data['resolved']}/{data['total']})")
            else:
                rates_str.append("N/A")
        print(f"| `{baseline}` | {rates_str[0]} | {rates_str[1]} | {rates_str[2]} |")

    print("\n========================================================")
    print("EXPERIMENT RESULTS: RUNTIME EFFICIENCY (FR = 0.3)")
    print("========================================================")
    print("| Baseline | Avg Steps | Avg Replanning | Avg Tool Calls | Memory Hit Rate |")
    print("|---|---|---|---|---|")
    for baseline in BASELINES:
        data = results[baseline].get("0.3")
        if data:
            mem_hit_str = f"{data['avg_mem_hits'] * 100:.1f}%" if data['avg_mem_hits'] > 0 else "N/A"
            print(f"| `{baseline}` | {data['avg_steps']:.2f} | {data['avg_replans']:.2f} | {data['avg_tool_calls']:.2f} | {mem_hit_str} |")
        else:
            print(f"| `{baseline}` | N/A | N/A | N/A | N/A |")

    print("\n========================================================")
    print("EDGE-CASE STRATIFICATION ANALYSIS (FR = 0.3)")
    print("========================================================")
    print("| Baseline | Standard | Ambiguous | Contradictory | Missing Entity | Multi Intent |")
    print("|---|---|---|---|---|---|")
    for baseline in BASELINES:
        data = results[baseline].get("0.3")
        if data:
            er = data["edge_rates"]
            std = f"{er.get('standard', 0.0)*100:.1f}%"
            amb = f"{er.get('ambiguous', 0.0)*100:.1f}%"
            cnt = f"{er.get('contradictory', 0.0)*100:.1f}%"
            mse = f"{er.get('missing_entity', 0.0)*100:.1f}%"
            mul = f"{er.get('multi_intent', 0.0)*100:.1f}%"
            print(f"| `{baseline}` | {std} | {amb} | {cnt} | {mse} | {mul} |")
        else:
            print(f"| `{baseline}` | N/A | N/A | N/A | N/A | N/A |")

    # Diagnostic Metrics
    print("\n========================================================")
    print("DIAGNOSTIC METRICS")
    print("========================================================")
    for baseline in ["memory_augmented", "v2_critic_only", "v2_template_only", "v2_full"]:
        for rate in FAILURE_RATES:
            data = results[baseline].get(rate)
            if data and (data["pred_accuracy"] > 0 or data["avg_dist"] > 0):
                print(f"=== {baseline} (FR = {rate}) ===")
                if data["pred_accuracy"] > 0:
                    print(f"  Critic Prediction Accuracy: {data['pred_accuracy']*100:.1f}%")
                    print(f"  Average Critic Confidence:  {data['avg_conf']:.2f}")
                if data["avg_dist"] > 0:
                    print(f"  Average Retrieval Distance:  {data['avg_dist']:.4f}")

    # Significance testing
    if HAS_SCIPY:
        print("\n========================================================")
        print("STATISTICAL SIGNIFICANCE TESTS (FR = 0.3)")
        print("========================================================")
        pairs_to_test = [
            ("v2_full", "memory_augmented", "V2 Full vs Naive Memory"),
            ("v2_full", "static_react", "V2 Full vs Static ReAct"),
            ("v2_full", "langgraph_react", "V2 Full vs LangGraph ReAct"),
            ("v2_critic_only", "memory_augmented", "Critic Ablation vs Naive Memory"),
            ("v2_template_only", "memory_augmented", "Template Ablation vs Naive Memory"),
        ]
        for arm1, arm2, label in pairs_to_test:
            d1 = results[arm1].get("0.3")
            d2 = results[arm2].get("0.3")
            if d1 and d2:
                p = perform_significance_test(d1, d2)
                p_str = f"p = {p:.5f}" if p is not None else "N/A"
                sig_str = "SIGNIFICANT (p < 0.05)" if p is not None and p < 0.05 else "NOT SIGNIFICANT"
                print(f"{label:35s}: {p_str} -> {sig_str}")

    # Export LaTeX tables
    export_latex(results)


def export_latex(results: dict) -> None:
    latex_dir = REPO_ROOT / "experiments" / "latex"
    latex_dir.mkdir(parents=True, exist_ok=True)
    
    # Table 1: Main Resolution Rates
    t1_path = latex_dir / "table_resolution_rates.tex"
    with open(t1_path, "w") as f:
        f.write("% LaTeX table generated by analyze_results.py\n")
        f.write("\\begin{table}[h]\n\\centering\n")
        f.write("\\begin{tabular}{lccc}\n\\hline\n")
        f.write("Baseline & FR = 0.0 & FR = 0.3 & FR = 0.7 \\\\\n\\hline\n")
        for baseline in BASELINES:
            clean_name = baseline.replace("_", "\\_")
            rates = []
            for rate in FAILURE_RATES:
                data = results[baseline].get(rate)
                rates.append(f"{data['resolution_rate'] * 100:.1f}\\%" if data else "N/A")
            f.write(f"{clean_name} & {rates[0]} & {rates[1]} & {rates[2]} \\\\\n")
        f.write("\\hline\n\\end{tabular}\n")
        f.write("\\caption{Task resolution rates across baselines under varying tool failure rates.}\n")
        f.write("\\label{tab:resolution_rates}\n\\end{table}\n")

    print(f"\nLaTeX table exported to: {t1_path}")


if __name__ == "__main__":
    main()
