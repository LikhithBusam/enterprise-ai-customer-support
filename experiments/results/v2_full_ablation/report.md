## Table A1 — v2_full vs. Policy Memory: Resolution Rate with 95% Wilson CI

| Failure Rate | Arm | Resolution Rate | 95% CI |
|---|---|---|---|
| 0.0 | v2_full (no Policy Memory) | 194/200 (97.0%) | [93.6%, 98.6%] |
| 0.0 | Policy Memory | 194/200 (97.0%) | [93.6%, 98.6%] |
| 0.3 | v2_full (no Policy Memory) | 190/200 (95.0%) | [91.0%, 97.3%] |
| 0.3 | Policy Memory | 180/200 (90.0%) | [85.1%, 93.4%] |
| 0.7 | v2_full (no Policy Memory) | 87/200 (43.5%) | [36.8%, 50.4%] |
| 0.7 | Policy Memory | 75/200 (37.5%) | [31.1%, 44.4%] |

## Table A2 — Full metric comparison

| Failure Rate | Arm | Avg Tool Calls | Avg Replans | Memory Hit Rate | Retrieval Distance | Avg Latency (ms) |
|---|---|---|---|---|---|---|
| 0.0 | v2_full (no Policy Memory) | 3.15 | 0.09 | 99.5% | 1.0032 | 4653 |
| 0.0 | Policy Memory | 2.81 | 0.09 | 99.5% | 1.5898 | 5048 |
| 0.3 | v2_full (no Policy Memory) | 5.38 | 1.62 | 99.5% | 1.0492 | 11451 |
| 0.3 | Policy Memory | 4.89 | 1.60 | 99.5% | 1.5694 | 16058 |
| 0.7 | v2_full (no Policy Memory) | 5.33 | 2.53 | 97.5% | 1.1803 | 11790 |
| 0.7 | Policy Memory | 5.25 | 2.56 | 99.5% | 1.7313 | 18311 |

## Table A3 — Policy utilization (Policy Memory arm only; undefined for v2_full)

| Failure Rate | Policy Retrieval Rate | Policy Reuse Rate | Resolution Rate (hit) | Resolution Rate (no hit) | Distinct Policies Used |
|---|---|---|---|---|---|
| 0.0 | 99.5% | 83.4% | 97.0% | 100.0% | 13 |
| 0.3 | 98.0% | 69.4% | 91.3% | 25.0% | 18 |
| 0.7 | 98.5% | 82.7% | 37.6% | 33.3% | 7 |

## Table A4 — Statistical significance (chi-square test, resolved vs. failed, v2_full vs. Policy Memory)

| Failure Rate | p-value | Significant (p<0.05)? | Direction |
|---|---|---|---|
| 0.0 | 1.00000 | no | — |
| 0.3 | 0.08755 | no | — |
| 0.7 | 0.26254 | no | — |

## Root-Cause Comparison at FR = 0.7 (measured evidence only)

### Planner behaviour (work done on tickets that ultimately failed)

| Arm | Unresolved tickets | Avg replans (unresolved) | Avg tool calls (unresolved) |
|---|---|---|---|
| v2_full (no Policy Memory) | 113 | 3.00 | 6.33 |
| Policy Memory | 125 | 2.98 | 6.15 |

### Retrieval behaviour

| Arm | Memory Hit Rate | Avg Retrieval Distance |
|---|---|---|
| v2_full (no Policy Memory) | 97.5% | 1.1803 |
| Policy Memory | 99.5% | 1.7313 |

### Tool-failure diagnosis accuracy (shared Critic — a proxy for "tool reliability" handling, since both arms use the identical failure-category-conditioned Critic)

| Arm | Critic Diagnosis Accuracy | Samples |
|---|---|---|
| v2_full (no Policy Memory) | 100.0% | 200 |
| Policy Memory | 97.0% | 199 |

### Policy utilisation (Policy Memory arm only)

- Policy Retrieval Rate: 98.5%
- Policy Reuse Rate: 82.7%
- Resolution rate on policy hit: 37.6%
- Resolution rate on no hit: 33.3%
- Distinct policies used: 7
