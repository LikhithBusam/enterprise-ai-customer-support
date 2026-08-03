#!/usr/bin/env python3
"""Run baselines across synthetic tickets with configurable failure rates.

Usage:
    python -m scripts.run_experiment
    python -m scripts.run_experiment --limit 20
    python -m scripts.run_experiment --baseline memoryless --failure-rate 0.3
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = REPO_ROOT / "data" / "synthetic_tickets.jsonl"
RESULTS_DIR = REPO_ROOT / "experiments" / "results"

BASELINES = [
    "memoryless",
    "static_react",
    "memory_augmented",
    "v2_critic_only",
    "v2_template_only",
    "v2_full",
    "langgraph_react",
    # Contribution 2 (Policy_Memory_Implementation_Plan.md): v2_full's Critic/reliability
    # behavior, but Planner retrieval swapped from PlanSuccessMemory-only to the fused
    # Policy+Failure+Episodic context — see experiments/memory_augmented_v2.py's
    # ENABLE_POLICY_MEMORY flag and experiments/context_fusion.py.
    "policy_memory",
]
FAILURE_RATES = [0.0, 0.3, 0.7]
PROGRESS_INTERVAL = 10

os.environ["BASELINE_USE_LLM"] = "1"


def load_tickets(dataset_path: Path, limit: int | None = None) -> list[dict]:
    tickets: list[dict] = []
    with open(dataset_path) as f:
        for line in f:
            line = line.strip()
            if line:
                tickets.append(json.loads(line))
    return tickets[:limit]


def count_replanning(baseline: str, tool_calls_made: list[dict], steps_taken: int) -> int:
    if baseline == "memoryless":
        return max(0, steps_taken - 1)
    return sum(1 for c in tool_calls_made if c.get("retried"))


def _reset_memory_augmented_store(client_id: str = "experiment_client") -> None:
    """Delete and recreate all Chroma collections for the given client_id.

    Called once per failure-rate tier so memory does not leak across tiers
    while still accumulating correctly within a single sequential tier run.
    """
    import chromadb
    from src.core import config as src_config
    from src.memory.client_store import ClientStoreRegistry

    # Collection suffixes must match those in ClientStore.__init__, plus "policy" for
    # Contribution 2's PolicyMemory (memory/policy_store.py) — cleared here too so it doesn't
    # leak across failure-rate tiers, same as every other memory type.
    suffixes = ["episodic", "tool_failure", "plan_success", "escalation", "policy"]

    chroma = chromadb.PersistentClient(path=str(src_config.CHROMA_PERSIST_DIR))
    for suffix in suffixes:
        name = f"{client_id}_{suffix}"
        try:
            chroma.delete_collection(name)
            print(f"  [memory_augmented] Cleared Chroma collection: {name}")
        except Exception:
            pass  # collection didn't exist yet — fine

    # Evict the cached ClientStore so it re-initialises against the fresh collections.
    ClientStoreRegistry._stores.pop(client_id, None)
    # Also reset the shared chroma client so PersistentClient picks up the changes.
    ClientStoreRegistry._client = None


def run_baseline(baseline: str, tickets: list[dict], failure_rate: float) -> None:
    from src.tools.registry import ToolRegistry

    if baseline == "memoryless":
        from experiments.baselines.memoryless import run as run_fn
    elif baseline == "static_react":
        from experiments.baselines.static_react import run as run_fn
    elif baseline == "memory_augmented":
        from experiments.memory_augmented import run as run_fn
        # Reset per-tier: memory must not leak from one failure-rate tier to the next.
        _reset_memory_augmented_store()
    elif baseline in ("v2_critic_only", "v2_template_only", "v2_full"):
        # Configure flags via environment variables
        os.environ["ENABLE_CONDITIONED_CRITIC"] = "1" if "critic_only" in baseline or "full" in baseline else "0"
        os.environ["ENABLE_TEMPLATE_ABSTRACTION"] = "1" if "template_only" in baseline or "full" in baseline else "0"
        os.environ["ENABLE_RELIABILITY_SCORING"] = "1" if "full" in baseline else "0"
        # Explicitly off: a prior "policy_memory" run in this same process must not leak its flag
        # into these baselines (env vars persist across run_baseline() calls within one process).
        os.environ["ENABLE_POLICY_MEMORY"] = "0"

        from experiments.memory_augmented_v2 import run as run_fn
        # Reset per-tier: memory must not leak from one failure-rate tier to the next.
        _reset_memory_augmented_store()
    elif baseline == "policy_memory":
        # Contribution 2: same Critic/reliability configuration as v2_full — the only variable
        # under test is swapping Planner retrieval from PlanSuccessMemory-only to the fused
        # Policy+Failure+Episodic context (experiments/context_fusion.py).
        os.environ["ENABLE_CONDITIONED_CRITIC"] = "1"
        os.environ["ENABLE_TEMPLATE_ABSTRACTION"] = "1"
        os.environ["ENABLE_RELIABILITY_SCORING"] = "1"
        os.environ["ENABLE_POLICY_MEMORY"] = "1"

        from experiments.memory_augmented_v2 import run as run_fn
        # Reset per-tier: memory (including PolicyMemory) must not leak from one failure-rate
        # tier to the next.
        _reset_memory_augmented_store()
    elif baseline == "langgraph_react":
        from experiments.baselines.langgraph_react import run as run_fn
    else:
        raise ValueError(f"Unknown baseline: {baseline}")

    out_path = RESULTS_DIR / f"{baseline}_{failure_rate}.jsonl"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    total = len(tickets)
    start_time = time.monotonic()

    for idx, ticket in enumerate(tickets, start=1):
        try:
            registry = ToolRegistry(failure_rate=failure_rate, seed=42)
            call_start = time.perf_counter()
            result = run_fn(ticket, registry)
            latency_ms = (time.perf_counter() - call_start) * 1000.0
            if baseline == "memory_augmented":
                replanning_count = result.replanning_count
                memory_hit = result.memory_hit
                record: dict = {
                    "ticket_id": result.ticket_id,
                    "resolved": result.resolved,
                    "steps_taken": result.steps_taken,
                    "tool_calls_made": result.tool_calls_made,
                    "replanning_count": replanning_count,
                    "memory_hit": memory_hit,
                    "predicted_category": getattr(result, "predicted_category", ""),
                    "actual_category": getattr(result, "actual_category", ""),
                }
            elif baseline in ("v2_critic_only", "v2_template_only", "v2_full"):
                replanning_count = result.replanning_count
                memory_hit = result.memory_hit
                record: dict = {
                    "ticket_id": result.ticket_id,
                    "resolved": result.resolved,
                    "steps_taken": result.steps_taken,
                    "tool_calls_made": result.tool_calls_made,
                    "replanning_count": replanning_count,
                    "memory_hit": memory_hit,
                    "predicted_category": result.predicted_category,
                    "actual_category": result.actual_category,
                    "critic_confidence": result.critic_confidence,
                    "retrieval_distance": result.retrieval_distance,
                    "recovery_strategy": result.recovery_strategy,
                }
            elif baseline == "policy_memory":
                replanning_count = result.replanning_count
                memory_hit = result.memory_hit
                record: dict = {
                    "ticket_id": result.ticket_id,
                    "resolved": result.resolved,
                    "steps_taken": result.steps_taken,
                    "tool_calls_made": result.tool_calls_made,
                    "replanning_count": replanning_count,
                    "memory_hit": memory_hit,
                    "predicted_category": result.predicted_category,
                    "actual_category": result.actual_category,
                    "critic_confidence": result.critic_confidence,
                    "retrieval_distance": result.retrieval_distance,
                    "recovery_strategy": result.recovery_strategy,
                    "policy_hit": result.policy_hit,
                    "policy_id_used": result.policy_id_used,
                    "policy_usage_count_at_use": result.policy_usage_count_at_use,
                }
            else:
                replanning_count = count_replanning(baseline, result.tool_calls_made, result.steps_taken)
                record: dict = {
                    "ticket_id": result.ticket_id,
                    "resolved": result.resolved,
                    "steps_taken": result.steps_taken,
                    "tool_calls_made": result.tool_calls_made,
                    "replanning_count": replanning_count,
                }
            record["latency_ms"] = round(latency_ms, 2)
        except Exception as e:
            record = {
                "ticket_id": ticket.get("ticket_id", "unknown"),
                "resolved": False,
                "steps_taken": 0,
                "tool_calls_made": [],
                "replanning_count": 0,
                "error": str(e),
            }

        with open(out_path, "a") as f:
            f.write(json.dumps(record, default=str) + "\n")

        if idx % PROGRESS_INTERVAL == 0 or idx == total:
            elapsed = time.monotonic() - start_time
            rate = idx / elapsed if elapsed > 0 else 0
            remaining = total - idx
            eta_secs = remaining / rate if rate > 0 else 0
            if eta_secs > 120:
                eta_str = f"{eta_secs / 60:.1f}min"
            elif eta_secs > 60:
                eta_str = f"1m {eta_secs - 60:.0f}s"
            else:
                eta_str = f"{eta_secs:.0f}s"

            print(
                f"[{baseline}] failure_rate={failure_rate}  "
                f"{idx}/{total}  "
                f"elapsed={elapsed / 60:.1f}min  "
                f"ETA={eta_str}  "
                f"{record['ticket_id']} resolved={record['resolved']}"
            )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run baselines on synthetic tickets.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="Process at most N tickets (default: all).",
    )
    parser.add_argument(
        "--baseline",
        choices=BASELINES,
        action="append",
        dest="baselines",
        help="Baseline(s) to run (repeatable, default: all).",
    )
    parser.add_argument(
        "--failure-rate",
        type=float,
        action="append",
        dest="failure_rates",
        help="Failure rate(s) to run (repeatable, default: all).",
    )
    parser.add_argument(
        "--dataset",
        type=str,
        default=None,
        help="Path to synthetic tickets dataset file (defaults to v2 dataset).",
    )
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()

    dataset_path = Path(args.dataset) if args.dataset else REPO_ROOT / "data" / "synthetic_tickets_v2.jsonl"
    if not dataset_path.exists():
        # Fallback to v1 if v2 isn't generated yet (just in case)
        fallback = REPO_ROOT / "data" / "synthetic_tickets.jsonl"
        if not args.dataset and fallback.exists():
            dataset_path = fallback
        else:
            print(f"Error: {dataset_path} not found.", file=sys.stderr)
            print("Run `python -m scripts.build_synthetic_data` first.", file=sys.stderr)
            sys.exit(1)

    baselines = args.baselines or list(BASELINES)
    failure_rates = args.failure_rates or list(FAILURE_RATES)
    tickets = load_tickets(dataset_path, args.limit)

    print(f"Loaded {len(tickets)} tickets from {dataset_path.name}")
    print(f"Baselines: {baselines}")
    print(f"Failure rates: {failure_rates}")
    print(f"Output: {RESULTS_DIR}/")
    print()

    for baseline in baselines:
        for fr in failure_rates:
            run_baseline(baseline, tickets, fr)
            print()


if __name__ == "__main__":
    main()
