# Portfolio Summary

**Adaptive Multi-Agent Customer Support System** — a research project + production-track
implementation + enterprise operations dashboard, built solo end-to-end.

## The one-line pitch

A 7-agent LangGraph pipeline that resolves customer support tickets through dynamic tool-use
planning, with memory-augmented replanning that measurably outperforms memoryless and
static-ReAct baselines — plus a real FastAPI production service and a 15-page React operations
dashboard to run and observe it.

## The problem

Most "agentic" support automation demos show a single happy-path run. This project instead asks
a falsifiable research question — **does giving an agent memory of past failures and successful
plans reduce ticket failure rate and replanning overhead, compared to an agent with no memory at
all?** — and answers it with a controlled experiment, not a demo.

## What I built

**Research harness** — four agent architectures run against the same 200-ticket synthetic dataset
with injectable, seeded tool failures at three severity tiers, so results are reproducible and
comparable:

| Failure rate | Memoryless | Static ReAct | Memory-Augmented | Policy Memory |
|---|---|---|---|---|
| 0.0 | 94.0% | 59.0% | 96.5% | **97.0%** |
| 0.3 | 42.0% | 51.0% | 73.0% | **90.0%** |
| 0.7 | 45.5% | 10.0% | **48.0%** | 37.5% |

Statistical significance confirmed (χ², p < 0.0001 at the 0.3 tier vs. every simpler baseline —
the largest of the three is p = 0.00002 vs. Memory-Augmented; see
`experiments/results/policy_memory_validation/report.md` Table 3). A
follow-on learning-curve analysis found memory saturates almost immediately rather than improving
gradually — which reframed the research claim from "memory improves agents over time" to "naive
ticket-replay memory generalizes poorly," motivating a second contribution: **Policy Memory** —
storing reusable, parameterized workflow templates per intent cluster instead of replaying past
tickets verbatim, retrieved through a context-fusion layer that blends policy, failure, and
episodic memory for the planner.

**The twist — a controlled ablation overturned the headline result.** The table above compares
Policy Memory against `memory_augmented`, which lacks the conditioned Critic, template
abstraction, and reliability scoring Policy Memory inherits — a confounded comparison. Running a
second baseline (`v2_full`) that is *architecturally identical* to Policy Memory and differs
*only* in retrieval source (plain ticket-based memory vs. the fused policy context) found **no
statistically significant resolution-rate difference at any failure rate** (p = 1.0 / 0.088 /
0.263), with the point estimate favoring the simpler ticket-based baseline at two of three tiers.
The bulk of Policy Memory's apparent advantage turned out to come from template abstraction — a
detail shared by both v2 baselines — not from policy-based retrieval itself. This null result is
reported transparently in the paper rather than the confounded comparison being left to stand as
the headline finding.

**Production port** — rather than "ship the research code," I ported the best-performing
configuration into a properly typed, tested service: a LangGraph `StateGraph` orchestrating the
same 7 agents, a FastAPI layer with per-client API-key auth, inbound rate limiting, and
idempotent submission, an LLM provider gateway with per-role fallback chains and a circuit
breaker (not just retry/backoff — that alone caused 20+ minute stalls against a rate-limited free
API during development), OpenTelemetry tracing that's a true no-op until configured, PII
redaction before anything reaches the memory store, and a pluggable tool-adapter layer so the
same pipeline runs against simulated data or real Stripe/Zendesk backends without touching agent
code.

**Support Console dashboard** — a 15-page React + TypeScript operations dashboard built to real
enterprise UI standards: a React Flow visualization of an agent's actual execution trace with
full keyboard accessibility, a shared data-table component with URL-synced filtering/sorting/
pagination, light/dark themes, responsive layouts from mobile to ultrawide, and an
Experiment Dashboard that reads this project's own real research results instead of fabricated
numbers. One page (ticket submission) is wired to the real backend; the other fourteen run
against a documented, swappable mock layer so the UI could be built and reviewed at full fidelity
before every backend endpoint existed — with the mock layer verified to compile out of production
builds entirely.

## Why it's interesting to talk about

- **Caught a confound with a controlled ablation, and reported the null result.** The original
  Policy Memory vs. `memory_augmented` comparison looked like a clear win; building a second,
  architecturally-matched baseline that isolates retrieval source as the only variable showed that
  win was mostly a confound (template abstraction, not policy-based retrieval). The paper's
  conclusion changed accordingly instead of the more favorable original narrative being kept. This
  is the kind of finding that's easy to skip in a portfolio project and hard to fake in an
  interview follow-up question.
- **A second honestly-reported boundary condition**: `memory_augmented` converges with the
  memoryless baseline at the highest failure-rate tier, and a learning-curve analysis did *not*
  show the expected monotonic improvement over ticket volume — both reported as limits of the
  approach rather than smoothed over.
- **Oracle-leakage discipline**: the Critic is architecturally prevented from reading the
  synthetic failure-injection's ground-truth label (`failure_type`) — only observable
  `success`/`data`/`error` — because feeding it the oracle label would invalidate the entire
  replanning result. This constraint is enforced by convention across every baseline and the
  production port, and called out explicitly in the contributor guidelines.
- **Two tracks, one codebase, no shortcuts**: the production system is a hand-typed rewrite of
  validated research logic onto LangGraph/Pydantic/FastAPI, not an import of the research code —
  a deliberate choice to keep research free to run risky ablations without risking production
  correctness.
- **Shipped a full production-readiness pass**: a staged audit → sprint → RC1 → RC2 → release
  process on the dashboard caught and fixed real, reproducible bugs before "release" — a broken
  navigation link traced to two fixture files generating disjoint ID ranges, a duplicated/
  visually-broken control set on the flagship visualization, a keyboard-accessibility gap where
  React Flow's own accessibility hint text didn't match actual behavior, and a mock-data layer
  that would have shipped active in a production build with no gate.

## Tech stack

Python 3.11, LangGraph, FastAPI, ChromaDB, Pydantic v2, OpenTelemetry, Stripe + Zendesk SDKs · NIM
(Llama 3.1 8B) / Ollama (Qwen2.5 3B) / Gemini Flash · React 18, TypeScript (strict), Vite,
Tailwind v4, shadcn/ui, TanStack Query/Table, React Hook Form + Zod, React Flow, MSW · pytest,
ruff, oxlint.

## Where to look

- [ARCHITECTURE.md](ARCHITECTURE.md) — full technical design, both tracks
- [`paper/results.md`](paper/results.md) (Tables 8–11) and [`paper/discussion.md`](paper/discussion.md)
  — the controlled ablation and the honest null-result writeup referenced above
- [`experiments/memory_augmented_v2.py`](experiments/memory_augmented_v2.py) — the research
  contribution (conditioned Critic, template-abstracted memory, Policy Memory)
- [`src/graph/pipeline.py`](src/graph/pipeline.py) — the production LangGraph wiring
- [`dashboard/src/features/live-execution/`](dashboard/src/features/live-execution) — the React
  Flow execution visualizer
- [DEMO_SCRIPT.md](DEMO_SCRIPT.md) — 5- and 10-minute guided walkthroughs of the dashboard, plus
  common interview questions with answers
