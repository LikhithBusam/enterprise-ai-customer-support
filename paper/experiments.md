# Experiments

## Protocol

For each of the 4 arms (`memoryless`, `static_react`, `memory_augmented`, `policy_memory`) and 3
failure rates (0.0, 0.3, 0.7):

1. A fresh `ToolRegistry(failure_rate, seed=42)` is constructed per ticket.
2. All 200 tickets in `data/synthetic_tickets_v2.jsonl` are processed **in dataset order**,
   sequentially, within a single process.
3. For memory-bearing arms, per-client Chroma collections are reset at the **start of each
   failure-rate tier** (not between arms within a tier, and not between tickets) — memory
   accumulates *within* a tier across its 200 tickets, but does not leak *across* tiers. This
   ordering is load-bearing for interpreting within-tier reuse statistics (e.g., "Distinct
   Policies Used" reflects one tier's worth of accumulation, starting from empty).
4. One JSON record per ticket is appended to `experiments/results/{arm}_{failure_rate}.jsonl`.

## Provenance of the Four Arms' Result Files

- `memoryless_{0.0,0.3,0.7}.jsonl`, `static_react_{0.0,0.3,0.7}.jsonl`,
  `memory_augmented_{0.0,0.3,0.7}.jsonl`: pre-existing, validated runs from an earlier phase of
  this project (the same files AGENTS.md's originally-cited three-way comparison table is drawn
  from), reused as-is for this paper rather than re-run — re-running would cost hours of
  additional rate-limited LLM calls to reproduce numbers this project has already validated once,
  with no expected scientific benefit given temperature=0.0 and a fixed tool-failure seed.
- `policy_memory_{0.0,0.3,0.7}.jsonl`: run specifically for this evaluation, real LLM calls via
  NVIDIA NIM, no simulated/mocked planning.

## Execution Notes

The `policy_memory` runs were interrupted partway through the FR=0.3 tier (at 94/200 tickets) at
the user's request, and resumed later. Because the standard driver
(`scripts/run_experiment.py`) resets the tier's memory collections at the start of every
invocation — correct behavior for a fresh tier, but destructive to an in-progress one — resuming
used a small one-off script (not part of the repository) that continued appending only the
remaining tickets against the *existing* accumulated Chroma state, verified by ticket-count
inspection before and after (no duplicate or dropped records). FR=0.7 was run in a single
uninterrupted pass. This is reported for reproducibility transparency, not because it introduces
a threat to validity: the resume mechanism reused the same per-ticket logic as the standard
driver, just without re-triggering the tier reset.

## Total Experimental Volume

12 arm×condition cells × 200 tickets = 2,400 ticket-runs total; 800 of those
(`policy_memory` × 3 conditions) involved live LLM calls made specifically for this paper.

See `reproducibility.md` for exact commands, environment variables, and software/hardware
versions.
