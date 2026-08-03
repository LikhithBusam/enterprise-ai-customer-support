## Table 1 — Core comparison across all four baselines

| Failure Rate | Baseline | Resolution Rate | Avg Tool Calls | Avg Replans | Memory Hit Rate | Retrieval Distance | Avg Latency (ms) |
|---|---|---|---|---|---|---|---|
| 0.0 | Memoryless | 188/200 (94.0%) | 5.15 | 0.32 | n/a | n/a | n/a |
| 0.0 | Static ReAct | 118/200 (59.0%) | 1.37 | 0.00 | n/a | n/a | n/a |
| 0.0 | Memory Augmented | 193/200 (96.5%) | 2.69 | 0.09 | 72.9% | n/a | n/a |
| 0.0 | Policy Memory | 194/200 (97.0%) | 2.81 | 0.09 | 99.5% | 1.5898 | 5048 |
| 0.3 | Memoryless | 84/200 (42.0%) | 5.06 | 1.44 | n/a | n/a | n/a |
| 0.3 | Static ReAct | 102/200 (51.0%) | 1.98 | 0.00 | n/a | n/a | n/a |
| 0.3 | Memory Augmented | 146/200 (73.0%) | 4.01 | 1.30 | 84.0% | n/a | n/a |
| 0.3 | Policy Memory | 180/200 (90.0%) | 4.89 | 1.60 | 99.5% | 1.5694 | 16058 |
| 0.7 | Memoryless | 91/200 (45.5%) | 5.82 | 1.55 | n/a | n/a | n/a |
| 0.7 | Static ReAct | 20/200 (10.0%) | 1.35 | 0.34 | n/a | n/a | n/a |
| 0.7 | Memory Augmented | 96/200 (48.0%) | 4.85 | 2.00 | 95.0% | n/a | n/a |
| 0.7 | Policy Memory | 75/200 (37.5%) | 5.25 | 2.56 | 99.5% | 1.7313 | 18311 |

## Table 2 — Policy Memory detail (retrieval / reuse / generalization)

| Failure Rate | Policy Retrieval Rate | Policy Reuse Rate | Resolution Rate (policy hit) | Resolution Rate (no hit) | Distinct Policies Used |
|---|---|---|---|---|---|
| 0.0 | 99.5% | 83.4% | 97.0% | 100.0% | 13 |
| 0.3 | 98.0% | 69.4% | 91.3% | 25.0% | 18 |
| 0.7 | 98.5% | 82.7% | 37.6% | 33.3% | 7 |

## Table 3 — Statistical significance (chi-square test of independence, resolved vs. failed)

| Failure Rate | Comparison | p-value | Significant (p < 0.05)? |
|---|---|---|---|
| 0.0 | Policy Memory vs Memory Augmented | 1.00000 | no |
| 0.0 | Policy Memory vs Static ReAct | 0.00000 | yes |
| 0.0 | Policy Memory vs Memoryless | 0.22783 | no |
| 0.3 | Policy Memory vs Memory Augmented | 0.00002 | yes |
| 0.3 | Policy Memory vs Static ReAct | 0.00000 | yes |
| 0.3 | Policy Memory vs Memoryless | 0.00000 | yes |
| 0.7 | Policy Memory vs Memory Augmented | 0.04324 | yes |
| 0.7 | Policy Memory vs Static ReAct | 0.00000 | yes |
| 0.7 | Policy Memory vs Memoryless | 0.12797 | no |

