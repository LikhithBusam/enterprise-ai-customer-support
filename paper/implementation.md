# Implementation

## Codebase Structure (relevant to this paper)

```
experiments/
  memory_augmented.py        # Contribution 1 (frozen) — ticket-based memory baseline
  memory_augmented_v2.py      # Contribution 1 extensions + Contribution 2 (this paper)
  context_fusion.py           # Context Fusion: PlanningContext + fuse_context()
  baselines/
    memoryless.py
    static_react.py
  __init__.py                 # BaselineResult base type

memory/                       # NEW top-level package for this contribution
  policy_memory.py            # PolicyMemory schema
  policy_store.py             # Deterministic-id, upsert-based Chroma storage

src/memory/                   # Existing, unmodified — reused by both tracks
  base.py                     # BaseMemoryEntry, MemoryManager[T] ABC
  client_store.py              # ChromaStore, ClientStore, ClientStoreRegistry
  episodic.py, tool_failure.py, plan_success.py, escalation_memory.py

scripts/
  run_experiment.py           # Experiment driver; "policy_memory" is one of its baselines
  analyze_policy_memory.py    # Core + Policy-specific metric computation (pure functions)
  analyze_results.py          # Pre-existing chi-square significance testing (reused, not modified)
  policy_memory_validation.py # This paper's table/figure generator

data/synthetic_tickets_v2.jsonl        # 200-ticket dataset
experiments/results/*.jsonl            # Per-ticket experiment output (one file per arm×condition)
experiments/results/policy_memory_validation/   # Generated tables (report.md) and figures (*.png)
```

## Design Decisions Worth Recording

- **`PolicyMemory` lives in a new top-level `memory/` package, not `src/memory/`.** This
  contribution's scope was explicitly research-track-only; `src/` (the production LangGraph
  pipeline) was never touched. `memory/policy_store.py` still reuses the *existing* shared Chroma
  client (`src.memory.client_store.ClientStoreRegistry.get_client()`, unmodified) and the same
  `{client_id}_{suffix}` naming convention — it does not fork infrastructure, only adds a new
  memory type on top of it.
- **`policy_store.py` is built directly on ChromaDB's `collection.upsert()`, not on the existing
  `ChromaStore` class.** `ChromaStore.write()` always mints a fresh UUID per call — correct for
  the append-only memory types (`EpisodicMemory`, `ToolFailureMemory`, `PlanSuccessMemory`), wrong
  for `PolicyMemory`, whose whole purpose is to *reinforce* an existing record when the same
  workflow shape recurs. `PolicyMemory.policy_id` is deterministic specifically to make this
  upsert-by-key semantics possible.
- **The ablation is flag-gated, default off.** `ENABLE_POLICY_MEMORY` defaults to `"0"`; the
  existing `v2_critic_only` / `v2_template_only` / `v2_full` baselines are provably unaffected by
  this contribution's presence in the same file (verified by unit test — see
  `tests/test_policy_memory_planner.py::TestPlanPolicyMemoryGate::
  test_disabled_path_ignores_policy_memory_even_if_written`).
- **`Policy_Memory_Implementation_Plan.md`'s original file list** (`src/memory/policy_memory.py`,
  `src/agents/context_fusion.py`) predates this narrower research-track-only scope; the
  as-built locations (`memory/policy_memory.py`, `experiments/context_fusion.py`) are documented
  in `CLAUDE.md`'s Architecture section as the authoritative as-built layout.

## Testing

43 unit tests were added covering: `policy_id` determinism, upsert-not-duplicate semantics,
per-client isolation, prune/reset, running-average arithmetic, Context Fusion's merge and
fail-closed error handling, dependency-graph/tool-constraint construction, the
write-then-reinforce policy lifecycle, the `ENABLE_POLICY_MEMORY` ablation gate (disabled,
enabled, and disabled-ignores-existing-policies), and the evaluation script's pure metric
functions — all passing at the time of this evaluation, alongside 156/157 of the pre-existing test
suite (one unrelated, pre-existing failure in a production-track planner test untouched by this
work).
