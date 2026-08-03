#!/usr/bin/env python3
"""
Generate a qualitative error analysis report comparing v1 (naive memory) and v2 (our fully updated system)
at failure rate 0.3, formatting as a Markdown artifact report for the paper appendix.
"""

from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = REPO_ROOT / "experiments" / "results"
TICKETS_FILE = REPO_ROOT / "data" / "synthetic_tickets_v2.jsonl"
OUTPUT_REPORT = REPO_ROOT / "experiments" / "results" / "error_analysis_report.md"


def load_jsonl(filepath: Path) -> dict[str, dict]:
    data = {}
    if not filepath.exists():
        return data
    with open(filepath) as f:
        for line in f:
            if line.strip():
                try:
                    record = json.loads(line)
                    data[record["ticket_id"]] = record
                except json.JSONDecodeError:
                    pass
    return data


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


def format_tool_calls(calls: list[dict]) -> str:
    formatted = []
    for i, c in enumerate(calls, 1):
        success_str = "SUCCESS" if c.get("success", False) else "FAILED"
        ft = c.get("failure_type")
        ft_str = f" ({ft})" if ft else ""
        formatted.append(
            f"  {i}. {c.get('tool_name')} {json.dumps(c.get('params'))} -> {success_str}{ft_str}"
        )
    return "\n".join(formatted)


def main() -> None:
    tickets = load_tickets()
    v1_results = load_jsonl(RESULTS_DIR / "memory_augmented_0.3.jsonl")
    v2_results = load_jsonl(RESULTS_DIR / "v2_full_0.3.jsonl")

    if not v1_results or not v2_results:
        print("Error: Results files for memory_augmented_0.3 or v2_full_0.3 not found.")
        print("Please wait for the experiment runs to complete before running error_analysis.py.")
        sys.exit(1)

    print(f"Comparing {len(v1_results)} v1 tickets and {len(v2_results)} v2 tickets...")

    v2_wins = []
    v2_loses = []
    both_fail = []

    for t_id, t_info in tickets.items():
        r1 = v1_results.get(t_id)
        r2 = v2_results.get(t_id)

        if not r1 or not r2:
            continue

        res1 = r1.get("resolved", False)
        res2 = r2.get("resolved", False)

        if res2 and not res1:
            v2_wins.append((t_info, r1, r2))
        elif res1 and not res2:
            v2_loses.append((t_info, r1, r2))
        elif not res1 and not res2:
            both_fail.append((t_info, r1, r2))

    # Build Markdown Report
    report = []
    report.append("# Qualitative Error Analysis & Generalization Report")
    report.append(f"\nThis report was dynamically generated to contrast the performance of the **Naive Memory Baseline (v1)** and **Template-Abstracted Failure-Conditioned Memory (v2)** at a tool failure rate of 0.3.\n")
    report.append(f"## High-level Statistics")
    report.append(f"- **V2 Wins (Generalization/Conditioning Success)**: {len(v2_wins)} tickets")
    report.append(f"- **V2 Loses (Ablation/Abstraction Over-generalization)**: {len(v2_loses)} tickets")
    report.append(f"- **Both Fail (Tool Failure Ceiling / Ambiguity Lock-out)**: {len(both_fail)} tickets\n")

    report.append("---")
    report.append("## Category 1: V2 Wins (Generalization Success)")
    report.append("These are cases where naive memory failed due to memorizing incorrect or specific plans, or where the conditioned critic successfully recovered from a tool failure.")

    for i, (t_info, r1, r2) in enumerate(v2_wins[:3], 1):
        report.append(f"\n### Win Case {i}: {t_info['ticket_id']} ({t_info.get('edge_type', 'standard')})")
        report.append(f"**Customer Message**: *\"{t_info['customer_message']}\"*")
        report.append(f"\n**Naive Memory (v1) Trace** (Resolved: {r1['resolved']}, Steps: {r1['steps_taken']}):")
        report.append("```\n" + format_tool_calls(r1.get("tool_calls_made", [])) + "\n```")
        report.append(f"\n**V2 Memory Trace** (Resolved: {r2['resolved']}, Steps: {r2['steps_taken']}):")
        report.append(f"- Predicted Category: `{r2.get('predicted_category')}` (Confidence: {r2.get('critic_confidence', 0.0):.2f})")
        report.append(f"- Recovery Strategy: `{r2.get('recovery_strategy')}`")
        report.append(f"- Retrieval Semantic Distance: `{r2.get('retrieval_distance', 'N/A')}`")
        report.append("```\n" + format_tool_calls(r2.get("tool_calls_made", [])) + "\n```")

    report.append("\n---")
    report.append("## Category 2: V2 Loses (Abstraction Failure)")
    report.append("These are cases where template abstraction stripped out details that were actually required for context alignment, or where a wrong failure prediction occurred.")

    for i, (t_info, r1, r2) in enumerate(v2_loses[:3], 1):
        report.append(f"\n### Lose Case {i}: {t_info['ticket_id']} ({t_info.get('edge_type', 'standard')})")
        report.append(f"**Customer Message**: *\"{t_info['customer_message']}\"*")
        report.append(f"\n**Naive Memory (v1) Trace** (Resolved: {r1['resolved']}, Steps: {r1['steps_taken']}):")
        report.append("```\n" + format_tool_calls(r1.get("tool_calls_made", [])) + "\n```")
        report.append(f"\n**V2 Memory Trace** (Resolved: {r2['resolved']}, Steps: {r2['steps_taken']}):")
        report.append(f"- Predicted Category: `{r2.get('predicted_category')}`")
        report.append(f"- Retrieval Semantic Distance: `{r2.get('retrieval_distance', 'N/A')}`")
        report.append("```\n" + format_tool_calls(r2.get("tool_calls_made", [])) + "\n```")

    report.append("\n---")
    report.append("## Category 3: Both Fail (Execution Ceiling)")
    report.append("These are hard tickets (often edge cases like contradictory info or missing entities) that neither system could resolve, indicating a theoretical performance ceiling for the current toolset.")

    for i, (t_info, r1, r2) in enumerate(both_fail[:3], 1):
        report.append(f"\n### Failure Case {i}: {t_info['ticket_id']} ({t_info.get('edge_type', 'standard')})")
        report.append(f"**Customer Message**: *\"{t_info['customer_message']}\"*")
        report.append(f"\n**Execution History (Same for both or similarly failing)**:")
        report.append("```\n" + format_tool_calls(r2.get("tool_calls_made", [])) + "\n```")

    # Save to file
    with open(OUTPUT_REPORT, "w") as f:
        f.write("\n".join(report))

    print(f"Error analysis report generated at: {OUTPUT_REPORT}")


if __name__ == "__main__":
    import sys
    main()
