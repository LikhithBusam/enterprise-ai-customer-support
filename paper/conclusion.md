# Conclusion

We implemented Policy Memory — a memory type storing reusable, ticket-agnostic workflow
templates rather than parameterized past examples — and Context Fusion, a retrieval step merging
policy, tool-failure, and episodic memories for an LLM agent's planner. Evaluated against a
ticket-based memory-augmented baseline (`memory_augmented`, Contribution 1) across three synthetic
tool-failure rates using real LLM planning, Policy Memory initially appeared to resolve
significantly more tickets under moderate failure (FR=0.3: 90.0% vs. 73.0%, p=0.00002).

A controlled ablation against `v2_full` — an architecturally identical baseline sharing Policy
Memory's conditioned Critic, reliability scoring, and template abstraction, differing *only* in
retrieval source — changes this conclusion substantially: **no statistically significant
difference was found at any of the three failure rates tested**, and at two of three (FR=0.3,
FR=0.7) the point estimate favors the simpler, ticket-based `PlanSuccessMemory` retrieval `v2_full`
uses. Diagnostic evidence from the same ablation (memory hit rate, retrieval distance, critic
diagnosis accuracy) indicates the originally observed advantage over `memory_augmented` was driven
substantially by the surrounding v2 architecture — most plausibly template abstraction, which
alone brings hit rate to near-ceiling regardless of retrieval source — rather than by policy-based
memory specifically.

We report this as a null result rather than retrofitting a positive claim the evidence does not
support. This is, itself, a useful scientific outcome: it demonstrates that an intuitively
appealing memory design (store reusable procedures, not instances) does not automatically confer
an advantage over well-engineered ticket-based retrieval once other architectural improvements are
controlled for — and it isolates *which* improvements (template abstraction, conditioned critic,
reliability scoring) are doing the actual work. The most valuable next steps, left explicitly as
future work, are a larger and repeated-trial evaluation capable of detecting a smaller effect size
if one exists, and a mechanism-level comparison of the specific plans each retrieval source
produces — rather than further tuning of the current implementation, which was not the goal of
this evaluation phase.
