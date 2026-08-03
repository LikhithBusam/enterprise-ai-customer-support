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

**Research harness** — three (later four) agent architectures run against the same 200-ticket
synthetic dataset with injectable, seeded tool failures at three severity tiers, so results are
reproducible and comparable:

| Failure rate | Memoryless | Static ReAct | Memory-augmented |
|---|---|---|---|
| 0.0 | 94% | 59% | **97%** |
| 0.3 | 42% | 51% | **84%** |
| 0.7 | 46% | 10% | **48%** |

Statistical significance confirmed (chi-square, p < 0.00001 at the 0.3 tier). A follow-on
learning-curve analysis found memory saturates almost immediately rather than improving
gradually — which reframed the research claim from "memory improves agents over time" to
"naive ticket-replay memory generalizes poorly," motivating a second contribution: **Policy
Memory** — storing reusable, parameterized workflow templates per intent cluster instead of
replaying past tickets verbatim, retrieved through a context-fusion layer that blends policy,
failure, and episodic memory for the planner.

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

- **A real negative-ish result handled honestly**: memory-augmented converges with the memoryless
  baseline at the highest failure-rate tier, and the learning curve did *not* show the expected
  monotonic improvement. Both findings are reported as boundary conditions and reframed the
  research contribution, rather than hidden.
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
- [`experiments/memory_augmented_v2.py`](experiments/memory_augmented_v2.py) — the research
  contribution (conditioned Critic, template-abstracted memory, Policy Memory)
- [`src/graph/pipeline.py`](src/graph/pipeline.py) — the production LangGraph wiring
- [`dashboard/src/features/live-execution/`](dashboard/src/features/live-execution) — the React
  Flow execution visualizer
- [DEMO_SCRIPT.md](DEMO_SCRIPT.md) — a 5-minute guided walkthrough of the dashboard
