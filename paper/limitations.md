# Limitations and Threats to Validity

## Internal Validity

- **The `memory_augmented` comparison is confounded (resolved via ablation, kept for
  transparency).** The headline comparison in Tables 1–7 (`policy_memory` vs. `memory_augmented`)
  varies more than one factor: retrieval source (policy vs. ticket-based) *and* the presence of a
  failure-category-conditioned Critic, template abstraction, and reliability scoring (present in
  `policy_memory`, absent from the frozen `memory_augmented`). **This has since been addressed**:
  Tables 8–11 report the controlled `v2_full` ablation, which isolates retrieval source as the
  only variable. That ablation found no statistically significant difference at any failure rate —
  see `discussion.md`. We retain the original confounded comparison in this paper for
  transparency about what was measured first and why the conclusion changed, not because it
  remains the paper's primary evidence.
- **Non-significance is not equivalence.** Failing to reject the null in the `v2_full` ablation
  (p=0.088 at FR=0.3, p=0.263 at FR=0.7) means this sample size (n=200) cannot distinguish the two
  arms at the observed effect sizes — it does not prove they perform identically. A formal
  equivalence test (e.g., TOST) or a larger N would be needed to actually claim "no difference,"
  which we do not claim; we claim only "no significant difference detected."
- **Deterministic failure injection, shared across arms.** `ToolRegistry(failure_rate, seed=42)`
  is reconstructed per ticket, so all arms face the same sequence of synthetic failures for a
  given ticket at a given failure rate — a deliberate design choice for fair comparison, but it
  means failure realizations are not independently sampled across arms, which the χ² test does
  not account for.
- **The FR=0.7 "both v2 arms underperform v1" observation is a secondary finding, not the
  ablation's primary target,** and rests on comparing `v2_full`/`policy_memory` (this session,
  Windows sandbox) against `memory_augmented` (an earlier session, WSL) — see the environment
  disclosure in `reproducibility.md`. It is suggestive, not confirmed by a same-environment
  comparison.

## Construct Validity

- **"Distinct Policies Used" (Table 6) is a proxy, not ground truth.** It counts unique
  `policy_id` values appearing in per-ticket JSONL records, not the live Chroma collection's true
  document count (`memory.policy_store.count_policies()` would give the latter but was not
  queried immediately after each run). A policy created but never subsequently retrieved within
  the same tier would be undercounted.
- **Resolution Rate is a binary, task-completion proxy for quality.** It does not capture partial
  correctness, response tone/appropriateness, or whether an escalation would have been the better
  outcome in ambiguous cases — those dimensions are out of scope for this evaluation.
- **The retrieval-distance mechanism proposed in `discussion.md` (Policy documents embedding less
  precisely due to sparse natural-language content) is a plausible, falsifiable explanation for
  the measured distance gap — not a directly tested one.** It has not been isolated by, e.g.,
  embedding an added natural-language description alongside a policy's structural fields and
  re-measuring retrieval distance.

## External Validity

- **Synthetic dataset.** 200 templated tickets across 6 intent clusters, with 90% "standard"
  phrasing — real customer traffic has far more lexical, intent, and multi-turn diversity. The
  Policy Memory advantage observed here (a small number of reusable workflow shapes covering
  nearly all traffic) may be an artifact of the dataset's own intent-cluster structure being
  cleanly separable in the first place.
- **Four fixed, simulated tools.** No real backend integration is involved in the research track;
  results may not transfer directly to a system with a larger or noisier real tool surface.
- **Single LLM, single temperature.** All experiments used one model (Llama-3.1-8B via NVIDIA
  NIM) at temperature 0.0. Results have not been checked against other model families or
  temperature settings.

## Statistical Validity

- **Single run per arm×condition cell.** All reported percentages are point estimates from one
  200-ticket run; there is no repeated-seed variance estimate, so we cannot distinguish "a stable
  arm effect" from "this particular run's luck" beyond the χ² test's within-run comparison. The
  FR=0.7 regression is reproducible in the sense that it was measured directly (not simulated or
  extrapolated), but has not been replicated across independent runs.
- **Multiple comparisons.** Table 3 reports 9 pairwise χ² tests without a multiple-comparisons
  correction (e.g., Bonferroni); the two flagged "significant" results central to this paper's
  claims (FR=0.3 and FR=0.7 vs. Memory Augmented) have p-values (0.00002 and 0.04324) that would
  survive a modest correction, but this was not formally applied.

## Instrumentation Gaps

- **Latency has no baseline-arm comparison.** `latency_ms` was added to the result schema only
  during this evaluation's final instrumentation pass; the pre-existing `memoryless` /
  `static_react` / `memory_augmented` result files predate it and cannot retroactively report it
  without re-execution.

## Scope Explicitly Not Covered

- Production integration (this contribution is research-track only; see `ENTERPRISE_ARCHITECTURE.md`
  Phase 6, explicitly gated on further validation).
- Stratified analysis by the dataset's edge-case types (`ambiguous`, `contradictory`,
  `missing_entity`, `multi_intent` — 20/200 tickets); the existing `scripts/analyze_results.py`
  supports this stratification for other baselines but it was not re-run for `policy_memory` in
  this pass.
