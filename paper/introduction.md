# Introduction

## Motivation

LLM-based agentic systems increasingly handle multi-step tool-use tasks — looking up records,
calling APIs, retrying after failures — where a single wrong tool call or misordered dependency
can derail an entire task. Two ways to improve such agents are (a) **dynamic replanning**: a
critic that inspects tool results and revises the plan rather than executing a fixed script, and
(b) **memory augmentation**: retrieving from past experience so the agent doesn't have to
re-derive a working plan from first principles every time.

Memory augmentation as usually implemented, though, stores *ticket-specific* examples — a past
successful plan keyed by a parameterized version of the request that produced it (e.g., "refund
for order {order_id}, amount {amount}"). This is subject to a specific failure mode: an agent
that has effectively memorized near-duplicate requests looks like it's "learning," when in fact it
may not generalize at all to requests that share an *intent* but differ in surface form. A prior
phase of this project's research (see `AGENTS.md`'s "Research Redesign" log) observed exactly this
symptom: memory-hit rate saturated by the second ticket in early runs, with no learning curve —
consistent with near-duplicate memorization rather than genuine generalization.

## Research Questions

- **RQ1:** Does memory-augmented dynamic replanning reduce ticket failure rate and replanning
  overhead relative to memoryless and static-ReAct baselines? *(the motivating result — established
  in prior work on this codebase, restated here as the baseline this paper builds on.)*
- **RQ2:** Does *policy-based* memory — reusable workflow templates, deliberately stripped of
  ticket-specific values — generalize better than *ticket-based* memory (parameterized replay of
  past examples), across a range of environmental failure conditions?

## Contributions

1. **Policy Memory**, a new memory type (`PolicyMemory`) storing an intent cluster's tool-call
   shape (`workflow_template`), inferred dependency structure (`dependency_graph`), and reuse
   statistics (`usage_count`, running-average tool calls/replans, a reuse-weighted `confidence`),
   keyed by a **deterministic** identifier so a recurring workflow shape reinforces the same
   record instead of accumulating duplicates.
2. **Context Fusion**, a retrieval step that merges top-3 Policy, top-2 Tool-Failure, and top-3
   Episodic memories into a single planning context — isolating the retrieval-source variable
   (policy vs. ticket-based) while holding the rest of the memory-augmented architecture (a
   failure-category-conditioned Critic, tool-reliability scoring) constant.
3. **A controlled, 4-arm empirical evaluation** — memoryless, static ReAct, ticket-based
   memory-augmented, and Policy Memory — across three synthetic tool-failure rates, using real
   LLM planner/critic calls rather than mocked reasoning, with per-ticket instrumentation
   (`policy_hit`, `policy_id_used`, `policy_usage_count_at_use`, latency) enabling fine-grained
   reuse and generalization analysis beyond aggregate resolution rate.
4. **A transparently-reported boundary condition**: Policy Memory's advantage does not hold
   uniformly — it reverses at the highest failure rate tested — and we report the reproducible
   regression along with a root-cause analysis rather than presenting only the favorable
   conditions.

## Paper Structure

Section 3 (`related_work.md`) situates this work against agentic tool-use and memory-augmented
LLM agent literature. Section 4 (`methodology.md`) and Section 5 (`architecture.md`) describe the
system and experimental design. Section 7 (`experiments.md`) and Section 8 (`results.md`) report
the protocol and findings. Section 9 (`discussion.md`) interprets the results, including the
FR=0.7 regression, and Sections 10–11 (`limitations.md`, `future_work.md`) state what this
evaluation does and does not establish.
