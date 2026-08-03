# Discussion

Each claim below is tagged **[Evidence]** (directly supported by a specific number in
`results.md`) or **[Speculation]** (a plausible mechanism consistent with the evidence but not
independently verified by an isolating experiment). We report both because a paper that only
states what is proven says less than it knows, but conflating the two would overclaim.

**This section has been revised following the `v2_full` ablation (Tables 8–11).** The original
draft attributed Policy Memory's advantage over `memory_augmented` to policy-based retrieval
itself; the ablation shows that attribution was not supported once the comparison is properly
controlled. The discussion below reflects the corrected interpretation.

## What the `v2_full` Ablation Actually Shows

**[Evidence]** Comparing Policy Memory against `v2_full` — identical Critic, template
abstraction, and reliability-scoring configuration, differing only in retrieval source — finds
**no statistically significant difference in resolution rate at any of the three failure rates
tested** (FR=0.0: p=1.0, tied at 97.0%; FR=0.3: p=0.088, `v2_full` 95.0% vs. Policy Memory 90.0%;
FR=0.7: p=0.263, `v2_full` 43.5% vs. Policy Memory 37.5%). At two of three conditions the point
estimate favors the simpler, ticket-based `v2_full` baseline, though the 95% Wilson confidence
intervals overlap substantially at every condition (Table 8).

**[Evidence]** `v2_full`'s Memory Hit Rate (99.5%/99.5%/97.5%) is close to Policy Memory's
(99.5%/99.5%/99.5%) at every condition — and both are far above `memory_augmented`'s hit rate from
the original comparison (72.9%/84.0%/95.0%, Table 4). Since `v2_full` retrieves from the same
`PlanSuccessMemory` type `memory_augmented` does, the difference between them is template
abstraction (stripping ticket-specific values before querying) plus the conditioned Critic and
reliability scoring — none of which involve Policy Memory at all.

**[Speculation, but strongly implicated]** This is consistent with the bulk of Policy Memory's
originally observed advantage over `memory_augmented` being attributable to the surrounding v2
architecture — particularly template abstraction, which appears sufficient on its own to raise
memory hit rate to near-ceiling — rather than to the specific choice of policy-based vs.
ticket-based retrieval. We do not have a `v1`-plus-template-abstraction-only variant to test this
precisely (see `future_work.md`), so this remains an inference from the pattern of evidence, not
a directly isolated result.

## Why Retrieval Distance Diverges (Evidence-Backed Mechanism)

**[Evidence]** At every failure rate, Policy Memory's average retrieval distance (1.59/1.57/1.73)
is markedly farther than `v2_full`'s (1.00/1.05/1.18) — the single largest, most consistent gap
in the ablation (Table 9). **[Speculation]** A plausible explanation: `PolicyMemory` documents are
JSON blobs of structural fields (`workflow_template`, `dependency_graph`, numeric statistics) with
minimal natural-language content, while `PlanSuccessMemory` documents include a templated
natural-language message. Chroma's default embedding function is a text embedder; a
natural-language-sparse document plausibly embeds less precisely against a natural-language ticket
query than a document that still resembles natural language. This offers one concrete, falsifiable
explanation for why Policy Memory does not show a retrieval-quality edge over ticket-based memory
despite a comparable or higher raw hit rate — but it has not been tested directly (e.g., by
embedding a natural-language description of the policy alongside its structural fields).

## Why FR = 0.7 Is a Boundary Condition (Revised)

**[Evidence]** Both v2 arms underperform `memory_augmented` at FR=0.7: `v2_full` resolves 43.5%,
Policy Memory 37.5%, versus `memory_augmented`'s 48.0% (Table 1). **This means the FR=0.7
regression reported in the original draft is not specific to Policy Memory** — it is shared, at
least in point-estimate terms, by the plain `v2_full` baseline. **[Speculation]** This reframes the
original hypothesis (a Policy-Memory-specific "stale confidence" mechanism) as, at minimum,
incomplete: something about the broader v2 architecture (conditioned Critic, reliability scoring,
template abstraction, or their interaction) may itself underperform the simpler v1 design under
heavy failure, independent of which memory type is retrieved. We flag this as a new, higher-priority
question for future work rather than assuming the original mechanism still fully explains the
FR=0.7 pattern.

**[Evidence]** Within FR=0.7, `v2_full` and Policy Memory are nearly identical on every diagnostic
dimension we measured: planner effort on unresolved tickets (3.00 vs. 2.98 replans, 6.33 vs. 6.15
tool calls), critic diagnosis accuracy (100.0% vs. 97.0%, both very high), and memory hit rate
(97.5% vs. 99.5%). The one dimension where they diverge substantially is retrieval distance (1.18
vs. 1.73). **[Speculation]** Given the other dimensions are so closely matched, retrieval-match
quality is the most plausible remaining candidate for the (statistically non-significant)
point-estimate gap between the two arms at FR=0.7 — but this is inference from elimination, not a
directly measured causal link.

## Strengths

- Real LLM-driven experiments (NVIDIA NIM, Llama-3.1-8B, temperature 0.0) across all arms and
  both ablation conditions.
- A genuine, verified ablation: `v2_full` and `policy_memory` differ by exactly one environment
  variable, confirmed by direct code inspection (`scripts/run_experiment.py`), not assumed.
- 95% confidence intervals reported alongside point estimates (Table 8), making the
  non-significance visually and numerically explicit rather than only reporting p-values.
- The paper's central claim was revised in light of the ablation rather than the ablation being
  omitted or downplayed to preserve the original, more favorable narrative.

## Weaknesses

- Single dataset, single seed, single run per condition — the confidence intervals quantify
  within-run sampling uncertainty, not run-to-run variance (see `limitations.md`).
- Non-significance at n=200 does not establish equivalence between `v2_full` and Policy Memory;
  a real, smaller effect in either direction remains possible and undetected at this sample size.
- The FR=0.7 "both v2 arms underperform v1" observation is itself drawn from comparing across two
  different evaluation sessions/environments (see `reproducibility.md`), and is a secondary
  finding this evaluation was not designed to isolate.
- The retrieval-distance mechanism (natural-language-sparse Policy documents embedding less
  precisely) is a plausible, falsifiable hypothesis, not a tested one.
