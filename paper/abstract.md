# Abstract

Memory-augmented LLM agents typically store and replay *ticket-specific* examples: a past
successful plan, keyed by a parameterized version of the request that produced it. This risks
memorization rather than generalization — an agent that has "seen" a near-duplicate request
performs well, but one facing a genuinely novel request in a familiar category gets no benefit.
We present **Policy Memory**, a memory type that stores reusable *workflow policies* — an intent
cluster's tool-call shape and dependency structure, deliberately stripped of ticket-specific
values — retrieved via a **Context Fusion** step that merges top-3 Policy, top-2 Tool-Failure, and
top-3 Episodic memories into the Planner's context. We implement Policy Memory as a
research-track extension of an existing memory-augmented customer-support agent pipeline (7
agents: Intake, Planner, Executor, Critic/Replanner, Memory Manager, Response, Escalation) and
evaluate it across 200 synthetic support tickets at three synthetic tool-failure rates (0.0, 0.3,
0.7), using real LLM calls (NVIDIA NIM, Llama-3.1-8B) rather than simulated planning.

Against `memory_augmented` (a ticket-based memory baseline lacking the conditioned Critic,
reliability scoring, and template abstraction that Policy Memory inherits), Policy Memory shows a
large, statistically significant advantage at FR=0.3 (90.0% vs. 73.0%, χ² p = 0.00002). However,
**a controlled ablation against `v2_full`** — an architecturally identical baseline differing
*only* in retrieval source (plain `PlanSuccessMemory` retrieval vs. Policy Memory's fused
Policy+Failure+Episodic context) — **finds no statistically significant difference at any failure
rate tested** (FR=0.0: tied, 97.0% vs. 97.0%, p=1.0; FR=0.3: 95.0% vs. 90.0%, p=0.088; FR=0.7:
43.5% vs. 37.5%, p=0.263), with point estimates at FR=0.3 and FR=0.7 favoring the simpler,
ticket-based `v2_full` baseline. Evidence from this ablation (near-identical memory hit rates
between `v2_full` and Policy Memory, both far above `memory_augmented`'s; measurably farther
average retrieval distance for Policy Memory at every condition) indicates that the bulk of Policy
Memory's originally observed advantage is attributable to the surrounding v2 architecture —
particularly template abstraction, which alone raises memory hit rate from ~73–95% to
~97.5–99.5% — rather than to policy-based retrieval specifically. We report this null result
transparently: this evaluation does not find evidence that reusable workflow-template memory
generalizes better than ticket-based template memory once the surrounding critic architecture is
held constant, and we identify what would be needed (larger sample sizes, repeated trials, and a
mechanism-level comparison of retrieved plan quality) to test that hypothesis more conclusively.
