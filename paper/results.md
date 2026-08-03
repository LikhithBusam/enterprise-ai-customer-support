# Results

All figures below are drawn from `experiments/results/policy_memory_validation/report.md` and the
underlying per-ticket JSONL files, computed by `scripts/policy_memory_validation.py` (which
imports, rather than reimplements, `scripts/analyze_policy_memory.py` and
`scripts/analyze_results.py`). N = 200 tickets per cell throughout. This section reports numbers
only; interpretation is deferred to `discussion.md`.

## Table 1 — Baseline Comparison (Resolution Rate, all conditions)

| Baseline | FR = 0.0 | FR = 0.3 | FR = 0.7 |
|---|---|---|---|
| Memoryless | 94.0% (188/200) | 42.0% (84/200) | 45.5% (91/200) |
| Static ReAct | 59.0% (118/200) | 51.0% (102/200) | 10.0% (20/200) |
| Memory Augmented | 96.5% (193/200) | 73.0% (146/200) | 48.0% (96/200) |
| **Policy Memory** | **97.0% (194/200)** | **90.0% (180/200)** | **37.5% (75/200)** |

## Table 2 — Failure-Rate Comparison (all metrics, by condition)

| Failure Rate | Baseline | Resolution Rate | Avg Tool Calls | Avg Replans | Memory Hit Rate | Retrieval Distance | Avg Latency (ms) |
|---|---|---|---|---|---|---|---|
| 0.0 | Memoryless | 94.0% | 5.15 | 0.32 | n/a | n/a | n/a |
| 0.0 | Static ReAct | 59.0% | 1.37 | 0.00 | n/a | n/a | n/a |
| 0.0 | Memory Augmented | 96.5% | 2.69 | 0.09 | 72.9% | n/a | n/a |
| 0.0 | Policy Memory | 97.0% | 2.81 | 0.09 | 99.5% | 1.5898 | 5,048 |
| 0.3 | Memoryless | 42.0% | 5.06 | 1.44 | n/a | n/a | n/a |
| 0.3 | Static ReAct | 51.0% | 1.98 | 0.00 | n/a | n/a | n/a |
| 0.3 | Memory Augmented | 73.0% | 4.01 | 1.30 | 84.0% | n/a | n/a |
| 0.3 | Policy Memory | 90.0% | 4.89 | 1.60 | 99.5% | 1.5694 | 16,058 |
| 0.7 | Memoryless | 45.5% | 5.82 | 1.55 | n/a | n/a | n/a |
| 0.7 | Static ReAct | 10.0% | 1.35 | 0.34 | n/a | n/a | n/a |
| 0.7 | Memory Augmented | 48.0% | 4.85 | 2.00 | 95.0% | n/a | n/a |
| 0.7 | Policy Memory | 37.5% | 5.25 | 2.56 | 99.5% | 1.7313 | 18,311 |

## Table 3 — Statistical Significance (χ² test of independence, resolved vs. failed)

| Failure Rate | Comparison | p-value | Significant (p < 0.05)? | Direction |
|---|---|---|---|---|
| 0.0 | Policy Memory vs. Memory Augmented | 1.00000 | No | — |
| 0.0 | Policy Memory vs. Static ReAct | < 0.00001 | Yes | Policy Memory higher |
| 0.0 | Policy Memory vs. Memoryless | 0.22783 | No | — |
| 0.3 | Policy Memory vs. Memory Augmented | 0.00002 | **Yes** | **Policy Memory higher** |
| 0.3 | Policy Memory vs. Static ReAct | < 0.00001 | Yes | Policy Memory higher |
| 0.3 | Policy Memory vs. Memoryless | < 0.00001 | Yes | Policy Memory higher |
| 0.7 | Policy Memory vs. Memory Augmented | 0.04324 | **Yes** | **Policy Memory lower** |
| 0.7 | Policy Memory vs. Static ReAct | < 0.00001 | Yes | Policy Memory higher |
| 0.7 | Policy Memory vs. Memoryless | 0.12797 | No | — |

## Table 4 — Retrieval Statistics

| Failure Rate | Arm | Memory Hit Rate | Policy Retrieval Rate | Avg Retrieval Distance |
|---|---|---|---|---|
| 0.0 | Memory Augmented | 72.9% | — | n/a |
| 0.0 | Policy Memory | 99.5% | 99.5% | 1.5898 |
| 0.3 | Memory Augmented | 84.0% | — | n/a |
| 0.3 | Policy Memory | 99.5% | 98.0% | 1.5694 |
| 0.7 | Memory Augmented | 95.0% | — | n/a |
| 0.7 | Policy Memory | 99.5% | 98.5% | 1.7313 |

*(Retrieval distance is n/a for Memory Augmented because that field was only recorded starting
with the `v2`-family result schema, which the pre-existing `memory_augmented` (v1) result files
predate; see `limitations.md`.)*

## Table 5 — Policy Reuse

| Failure Rate | Policy Retrieval Rate | Policy Reuse Rate | Resolution Rate (policy hit) | Resolution Rate (no hit) |
|---|---|---|---|---|
| 0.0 | 99.5% | 83.4% | 97.0% | 100.0% |
| 0.3 | 98.0% | 69.4% | 91.3% | 25.0% |
| 0.7 | 98.5% | 82.7% | 37.6% | 33.3% |

*Policy Reuse Rate = fraction of policy hits where the retrieved policy already had
`usage_count ≥ 2` at retrieval time (i.e., reinforced by at least one earlier ticket, not just
created).*

## Table 6 — Memory Growth (Policy Memory arm)

| Failure Rate | Distinct Policies Used (JSONL-derived) | Tickets Resolved (policies eligible to be written) |
|---|---|---|
| 0.0 | 13 | 194 |
| 0.3 | 18 | 180 |
| 0.7 | 7 | 75 |

*"Distinct Policies Used" counts unique `policy_id` values retrieved within a tier — a lower-bound
proxy computed from per-ticket JSONL records, not the live Chroma collection's true document
count (see `limitations.md`). The pool is smallest at FR = 0.7 despite identical ticket volume and
intent-cluster distribution, directly following from write-on-success-only: only 75 tickets ever
resolve and become eligible to create or reinforce a policy at that failure rate, versus 180–194
at the lower rates.*

## Table 7 — Latency

| Failure Rate | Policy Memory Avg Latency (ms) | Memoryless / Static ReAct / Memory Augmented |
|---|---|---|
| 0.0 | 5,048 | n/a — not recorded in these arms' historical result files |
| 0.3 | 16,058 | n/a |
| 0.7 | 18,311 | n/a |

*Latency was added to the result schema (`latency_ms`, wall-clock per-ticket `run()` time) only
during this evaluation's instrumentation pass, after the other three arms' result files had
already been produced. Their historical runs cannot retroactively report this field without
re-execution (see `limitations.md`). Within the Policy Memory arm, latency increases sharply with
failure rate — consistent with more replanning iterations and tool calls (Table 2) at higher FR,
each involving an additional LLM round-trip.*

## Summary of Observations, Tables 1–7 (facts only — see `discussion.md` for interpretation)

- Policy Memory's resolution rate is statistically indistinguishable from Memory Augmented at
  FR=0.0, significantly higher at FR=0.3, and significantly *lower* at FR=0.7.
- Policy Memory's Memory Hit Rate (99.5% at every condition) is higher than Memory Augmented's
  (72.9–95.0%, increasing with failure rate) at every condition tested.
- Policy Retrieval Rate is near-ceiling (98.0–99.5%) at all three conditions; Policy Reuse Rate is
  lowest at FR=0.3 (69.4%) and similar at FR=0.0 and FR=0.7 (83.4%, 82.7%).
- Distinct Policies Used is lowest at FR=0.7 (7), despite FR=0.7 having neither the fewest tickets
  nor a different intent-cluster distribution than the other two conditions.
- At FR=0.7, Resolution Rate conditioned on a policy hit (37.6%) is close to Resolution Rate with
  no hit (33.3%) — a much smaller gap than at FR=0.3 (91.3% vs. 25.0%).
- Average Tool Calls and Average Replans for Policy Memory both increase monotonically with
  failure rate and are higher than Memory Augmented's at FR=0.3 and FR=0.7.

---

## Tables 8–11 — The `v2_full` Ablation (the controlled comparison)

**Everything above compares Policy Memory against `memory_augmented`, which lacks the conditioned
Critic, template abstraction, and reliability scoring that Policy Memory inherits from the v2
architecture — a confounded comparison, flagged as a limitation in the original draft of this
paper.** The tables below report the controlled ablation against `v2_full`: the identical
implementation with Policy Memory switched off (`ENABLE_POLICY_MEMORY=0`), differing from the
`policy_memory` arm *only* in retrieval source. Source: `experiments/results/v2_full_ablation/report.md`,
computed by `scripts/v2_full_ablation.py` (imports `scripts/analyze_policy_memory.py` and
`scripts/analyze_results.py`, adds a Wilson-score confidence interval).

### Table 8 — Resolution Rate with 95% Wilson Confidence Interval

| Failure Rate | Arm | Resolution Rate | 95% CI |
|---|---|---|---|
| 0.0 | v2_full | 194/200 (97.0%) | [93.6%, 98.6%] |
| 0.0 | Policy Memory | 194/200 (97.0%) | [93.6%, 98.6%] |
| 0.3 | v2_full | 190/200 (95.0%) | [91.0%, 97.3%] |
| 0.3 | Policy Memory | 180/200 (90.0%) | [85.1%, 93.4%] |
| 0.7 | v2_full | 87/200 (43.5%) | [36.8%, 50.4%] |
| 0.7 | Policy Memory | 75/200 (37.5%) | [31.1%, 44.4%] |

### Table 9 — Full Metric Comparison, v2_full vs. Policy Memory

| Failure Rate | Arm | Avg Tool Calls | Avg Replans | Memory Hit Rate | Retrieval Distance | Avg Latency (ms) |
|---|---|---|---|---|---|---|
| 0.0 | v2_full | 3.15 | 0.09 | 99.5% | 1.0032 | 4,653 |
| 0.0 | Policy Memory | 2.81 | 0.09 | 99.5% | 1.5898 | 5,048 |
| 0.3 | v2_full | 5.38 | 1.62 | 99.5% | 1.0492 | 11,451 |
| 0.3 | Policy Memory | 4.89 | 1.60 | 99.5% | 1.5694 | 16,058 |
| 0.7 | v2_full | 5.33 | 2.53 | 97.5% | 1.1803 | 11,790 |
| 0.7 | Policy Memory | 5.25 | 2.56 | 99.5% | 1.7313 | 18,311 |

### Table 10 — Statistical Significance (χ², v2_full vs. Policy Memory)

| Failure Rate | p-value | Significant (p < 0.05)? | Point-estimate direction |
|---|---|---|---|
| 0.0 | 1.00000 | No | tied |
| 0.3 | 0.08755 | No | v2_full higher (95.0% vs. 90.0%) |
| 0.7 | 0.26254 | No | v2_full higher (43.5% vs. 37.5%) |

**No comparison reaches statistical significance.** At two of three conditions, the point estimate
favors `v2_full`'s plain `PlanSuccessMemory` retrieval over Policy Memory.

### Table 11 — Root-Cause Comparison at FR=0.7 (measured, not simulated)

| Dimension | v2_full | Policy Memory |
|---|---|---|
| Avg replans, unresolved tickets | 3.00 | 2.98 |
| Avg tool calls, unresolved tickets | 6.33 | 6.15 |
| Memory Hit Rate | 97.5% | 99.5% |
| Avg Retrieval Distance | 1.1803 | 1.7313 |
| Critic diagnosis accuracy | 100.0% (n=200) | 97.0% (n=199) |

### Additional Observations, Tables 8–11

- Retrieval distance is measurably farther (worse) for Policy Memory than for `v2_full` at every
  condition (1.00/1.05/1.18 vs. 1.59/1.57/1.73) — the largest, most consistent gap in this
  ablation.
- Memory Hit Rate for `v2_full` (99.5%/99.5%/97.5%) is close to Policy Memory's
  (99.5%/99.5%/99.5%) — and both are far above `memory_augmented`'s hit rate in Table 4
  (72.9%/84.0%/95.0%), implicating template abstraction (shared by both v2 arms, absent from
  `memory_augmented`) as a major driver of that earlier gap.
- Latency is consistently higher for Policy Memory (5,048/16,058/18,311 ms vs. `v2_full`'s
  4,653/11,451/11,790 ms) at every condition.
- Both `v2_full` (43.5%) and Policy Memory (37.5%) resolve fewer FR=0.7 tickets than
  `memory_augmented` (48.0%, Table 1) — the FR=0.7 regression is not unique to Policy Memory.
