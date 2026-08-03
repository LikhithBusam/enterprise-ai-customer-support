# Future Work

**Update:** item 1 below (the `v2_full` ablation) has been completed — see `results.md` Tables
8–11 and `discussion.md`. It changed the paper's conclusion from "Policy Memory generalizes
better" to "no significant difference detected between policy-based and ticket-based retrieval
once the surrounding architecture is held constant." The items below are ordered by priority for
the *next* phase, given that result.

1. **Larger sample size / repeated trials to detect a smaller effect, if one exists.** The
   `v2_full` ablation's confidence intervals (Table 8) are wide enough that a real but modest
   effect in either direction could exist undetected at n=200, single-run. A pre-registered power
   analysis targeting a specific minimum detectable effect size, run across multiple seeds, would
   let the paper make a stronger equivalence claim than "not significant here."
2. **Mechanism-level comparison of retrieved plan quality**, not just outcome. The ablation found
   Policy Memory's retrieval distance is consistently farther than `v2_full`'s — directly comparing
   the *actual DAG* each retrieval source causes the Planner to produce, ticket-by-ticket, would
   test the "farther match → worse suggested plan" hypothesis in `discussion.md` directly, rather
   than inferring it from aggregate metrics.
3. **Investigate why both v2 arms underperform `memory_augmented` at FR=0.7** — a new, higher-priority
   question raised by this ablation (Table 1 vs. Table 8): `v2_full` (43.5%) and Policy Memory
   (37.5%) are both below `memory_augmented`'s 48.0%, suggesting the FR=0.7 regression may be a
   broader property of the v2 architecture (conditioned Critic, reliability scoring, template
   abstraction, or their interaction) rather than specific to Policy Memory. This should be
   re-measured in one consistent environment first (see `reproducibility.md`'s disclosed
   environment mismatch) before drawing further conclusions.
4. **An isolated test of the template-abstraction hypothesis.** `discussion.md` infers that
   template abstraction (not policy-vs-ticket retrieval) drives most of the hit-rate gap between
   `memory_augmented` and the v2 family. A `memory_augmented`-plus-template-abstraction-only
   variant (no conditioned Critic, no reliability scoring, no Policy Memory) would test this
   directly instead of by inference.
5. **A true success-rate signal for `PolicyMemory`.** Currently write-on-success-only means
   `success_rate` is always 1.0. *(Not implemented in this validation-phase task, which was
   scoped to evaluation only.)*
6. **Stratified evaluation by dataset edge-case type** (`ambiguous`, `contradictory`,
   `missing_entity`, `multi_intent`).
7. **Larger and more diverse dataset**, beyond 200 templated tickets across 6 intent clusters.
8. **Re-run all baselines in one canonical environment** to remove the disclosed Python-version/OS
   mismatch between the original three baselines and this session's `v2_full`/`policy_memory` runs.
9. **Production integration**, per `ENTERPRISE_ARCHITECTURE.md` Phase 6 — explicitly gated on
   items 1–4 above, not started as part of this work. Given the null result in item-1's ablation,
   this is now a lower-confidence path than originally framed and should not proceed on the
   strength of the original (confounded) comparison alone.
