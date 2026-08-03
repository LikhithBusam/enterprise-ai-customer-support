# Enterprise Architecture & Implementation Roadmap

This document turns the flat TODO checklist in [AGENTS.md](AGENTS.md)'s "Enterprise/Production
Readiness Roadmap" into a real architecture with explicit component boundaries and a
dependency-ordered implementation plan. It covers the path from the current research prototype
(agent logic living as standalone functions in `experiments/`) to a production-ready client
system, without disturbing the research track.

**Hard constraints this document respects, inherited from AGENTS.md /
[Policy_Memory_Implementation_Plan.md](Policy_Memory_Implementation_Plan.md):**
- `experiments/memory_augmented.py` is frozen — it produces cited paper numbers and must never be
  modified.
- Policy Memory ("Contribution 2") is being actively implemented separately — this document does
  not redesign or duplicate that work; it defines where Policy Memory plugs in once it lands.
- Memory stays isolated per `client_id`; no cross-client merging without explicit sign-off.
- The Critic must only ever read `success` / `data` / `error` off `ToolResult` — never
  `failure_type`, which is oracle/eval-only metadata. This rule must survive into production tool
  adapters.
- `experiments/` (the research harness) and `src/` (the production track) stay separate.
  Production wiring *consumes* validated research logic; it does not modify the research files it
  draws from.

This document is planning only — it does not itself change any code under `src/` or
`experiments/`.

## 1. Guiding principle: modular monolith first

AGENTS.md's roadmap literally says "containerize each agent as an independent service (Docker) per
original multi-agent microservice design." This document **deviates from that bullet on purpose**
and recommends starting with a **modular monolith** instead: all 7 agents running in one process,
orchestrated in-process by a LangGraph `StateGraph`, deployed as a single container with clean
internal module boundaries.

Reasoning:
- LangGraph's `StateGraph` execution model is in-process node calls. Going to
  microservices-per-agent means either abandoning that execution model or wrapping every graph
  node as a network call to a sibling service — pure latency and operational overhead with no
  independent-scaling benefit, since ticket processing is a sequential pipeline
  (Intake → Planner → Executor → Critic loop → Response/Escalation), not a set of independently
  loaded services.
- All 7 agent modules (`src/agents/*.py`) are currently empty. There is no code, no
  team-ownership split, and no observed differential traffic pattern between agents that would
  justify per-agent deployment boundaries today.
- The repo currently has zero infrastructure (no Dockerfile, no CI, no k8s). Starting at 7
  services means building 7x the operational surface — health checks, service discovery,
  inter-service auth — before there is any evidence any single agent needs to scale independently
  of the others.

**Re-extraction triggers** (concrete signals to revisit this decision, not "later"):
1. Differential load between agents — e.g. the Executor's tool calls become bursty/I/O-heavy
   independent of the Planner/Critic's reasoning load.
2. An agent needs isolation for failure-domain or release-cadence reasons. The most plausible
   first candidate is the Escalation Agent gaining a human-in-the-loop UI.
3. The team grows to multiple owners per agent.

If/when extraction happens, extract by **bounded context**, not a uniform 7-way split — e.g. a
single "Tool Execution service" (Executor + tool adapters) is the most likely first candidate.

## 2. Layered architecture

| Layer | Component | Maps to | Notes |
|---|---|---|---|
| API / Gateway | FastAPI service, single worker process | new `src/api/` | Versioned contract (`/v1/tickets`), idempotency on ticket submission so a crash mid-DAG can't double-process a ticket. Single-worker is a hard constraint (see §3), not a preference. |
| Orchestration | LangGraph `StateGraph` | `src/graph/pipeline.py` (currently empty) | Wires the 7 agent nodes plus the replanning conditional-edge loop. |
| Agent layer | 7 typed agent modules | `src/agents/*.py` (all currently empty) | Logic ported from `experiments/memory_augmented_v2.py`, run with all ablation flags on (`v2_full` behavior). The flags themselves (`ENABLE_CONDITIONED_CRITIC`, etc.) stay research-only, not exposed in production. |
| Typed I/O contracts | Per-agent input/output models | `src/models/*.py` (all currently empty) | Base shapes on what already works in `memory_augmented_v2.py` and `experiments/__init__.py`'s `BaselineResult` — don't invent new shapes. |
| DAG type | Formal plan representation | `src/core/dag.py` (currently empty) | Today it's just `list[list[str]]` (layers of tool names) used ad hoc across all of `experiments/`. Formalize that exact shape as a typed pydantic model — this is the Planner→Executor contract AGENTS.md's "Data Contracts" section already requires ("must be a typed DAG object, not free text"). Do not redesign the shape, just type it. |
| Tool layer | `ToolAdapter` interface, separate from `ToolRegistry` | `src/tools/adapter.py`, alongside `src/tools/registry.py`, `crm.py` / `order.py` / `refund.py` / `kb_search.py` | `ToolRegistry.dispatch()` bakes `failure_rate` and `rng` into every handler call — synthetic-failure injection for research, with no analog for a real backend. Do not extend `ToolRegistry` for production. `ToolAdapter` returns the same `ToolResult` (`failure_type` always `None` for real backends, since there's nothing to score). The existing simulated handlers are the default dev/staging adapter (`SimulatedToolAdapter`); `RealToolAdapter` wires CRM/order-lookup/refunds to Stripe (Customers / PaymentIntents / Refunds) and KB search to Zendesk Guide — each backend fails closed with a `ToolResult(success=False, ...)`, not an exception, when its credentials are unset. `ToolRegistry` itself stays untouched and research-only. |
| Memory layer | As-is, absorb Policy Memory later | `src/memory/base.py`, `client_store.py` (both real, working) | Correct to defer the Chroma → Qdrant migration. `ClientStoreRegistry` wraps an embedded `chromadb.PersistentClient` as a process-global singleton — concurrent writers across multiple app replicas is a known Chroma footgun, independent of and *earlier* than the ">1M vectors" trigger already noted for Qdrant. v1 = single writer process. |
| LLM Provider Gateway | Consolidates duplicated client/limiter code | new `src/core/llm_client.py` | See §3. Scope boundary: **production track (`src/`) only.** `memory_augmented.py` is frozen — never touched. `memory_augmented_v2.py` is mid-flight research feeding paper numbers — migrating it onto the new gateway is an optional *future* cleanup requiring a before/after equivalence check on a fixed seed, not part of this roadmap. |
| Observability | Structured JSON logging + OTel spans | new `src/core/logging.py` + instrumentation at agent/tool/LLM call sites | Nothing in `src/` logs today — only bare `logging.getLogger` inside `experiments/`. Check whether `opentelemetry` (present transitively via langgraph/langsmith in `.venv`) needs promoting to a direct `pyproject.toml` dependency before instrumenting. |
| Auth / multi-tenancy | API key → `client_id` at the gateway | new, at API layer | `client_id` is already threaded as a plain string through `ClientStoreRegistry.get(client_id)` and tool calls — no memory-layer changes needed, just stop trusting it as an unauthenticated caller-supplied string. |
| Security / compliance | PII redaction + retention | `src/core/pii.py`, `src/agents/memory_manager.py`, `src/agents/intake.py`, `src/jobs/retention.py` | **Done.** PII redaction (`redact_pii()`) runs in the Memory Manager agent before `write_tool_failure`/`write_plan_success`/`write_escalation` reach `ChromaStore.write()`, not retrofitted into `ChromaStore` itself. Retention is `src/jobs/retention.py` calling the existing `MemoryManager.prune()` per client (from `Settings.api_keys`), meant to run as an external scheduled job (cron / k8s CronJob), not a background thread in the API process — no new in-process plumbing. The prompt-injection filter lives in `src/agents/intake.py` and its sanitized message is fed back into `PipelineState["customer_message"]` so every downstream node sees it. |

## 3. LLM Provider Gateway design

The repo already has half of this shape: `.env.example` has `PLANNER_MODEL` / `CRITIC_MODEL` as
env-var-per-role, and every experiment module's `_call_llm(model_env_key, messages)` already
reads `os.environ[model_env_key]`. It's just duplicated four times (`memory_augmented.py`,
`memory_augmented_v2.py`, `baselines/memoryless.py`, `baselines/static_react.py`) and not
provider-pluggable. The gateway formalizes and centralizes this — for the production track only.

**Config.** Extend `src/core/config.py` (currently just `CHROMA_PERSIST_DIR` + `DEFAULT_TOP_K`)
into a typed `Settings` object that reads the **same** `.env` keys `experiments/` already depends
on, so research and production never fork configuration.

**Role → provider mapping.** Each agent role maps to an **ordered list** of provider configs, not
a single provider:

```
{
  "planner": [
    {"provider": "nim", "model": "meta/llama-3.1-8b-instruct"},
    {"provider": "ollama", "model": "qwen2.5:3b-instruct"}
  ],
  "critic": [
    {"provider": "nim", "model": "meta/llama-3.1-8b-instruct"},
    {"provider": "ollama", "model": "qwen2.5:3b-instruct"}
  ],
  "intake": [{"provider": "ollama", "model": "qwen2.5:3b-instruct"}],
  "response": [{"provider": "ollama", "model": "qwen2.5:3b-instruct"}]
}
```

This keeps today's validated split — NVIDIA NIM (`meta/llama-3.1-8b-instruct`) for the
reasoning-heavy Planner/Critic roles, local Ollama (`qwen2.5:3b-instruct`) for the lighter
Intake/Response roles — as the default, live-pipeline configuration. Gemini Flash free tier
remains judge-only for offline evaluation (its 20-requests/day cap makes it unusable for live
ticket volume) and is never wired into this gateway's live-pipeline role list.

**Fallback Tier 1 — free, zero new vendor risk.** Local Ollama, already used for Intake/Response,
serves as an emergency degraded-mode path for Planner/Critic when NIM throttles or errors out —
even though it wasn't originally selected for those roles, it's an already-accepted quality
tradeoff and requires no new procurement.

**Circuit breaker, not retry/backoff.** Each provider entry tracks consecutive failures/429s; on
threshold, mark the provider unhealthy and skip it until a cooldown elapses, then fall through to
the next entry in the role's list. This follows directly from the existing lesson in AGENTS.md:
reactive retry/backoff alone caused 20+ minute stalls against NIM's rate ceiling — a proactive
sliding-window limiter plus a circuit breaker is required, not backoff by itself.

**Secondary free-tier provider — a research spike, not a commitment.** This document intentionally
does not name a second external provider or assert its current rate limits as fact — provider free
tiers change too often to treat as settled. Instead, the roadmap (§4, Phase 0) includes a spike:
evaluate 1–2 candidate secondary free-tier providers against the Planner/Critic's actual
requirements (tool-calling reliability, latency, published limits *at evaluation time*), and record
the result as a short decision note before wiring anything as a second fallback beyond local
Ollama.

**Known gap, flagged not fixed.** The existing `_SlidingWindowRateLimiter` is in-process,
in-memory state scoped to a single script run. In a production API service with more than one
worker process, each process gets its own independent limiter, and the fleet collectively exceeds
NIM's ceiling even though each process individually respects it. Practical implication: **the v1
production service runs as a single worker process.** Any future horizontal scale-out needs a
shared/coordinated rate limiter (e.g. a Redis token bucket) as a *prerequisite*, solved together
with the Chroma single-writer constraint below — not as two separate afterthoughts.

**Pluggability for paid tiers.** Because model selection is config, not code, moving any role to a
paid provider or a dedicated inference endpoint later is a config change to the role→provider list,
not a rewrite of the gateway or the agents that call it.

## 4. Phased roadmap

Dependency-ordered; sizing is relative (S/M/L), not calendar time.

| Phase | Size | Scope | Depends on |
|---|---|---|---|
| 0 — Shared foundations | S | `src/core/llm_client.py` (gateway, fallback chain, consolidated rate limiter) + typed `Settings` + shared structured-logging factory + the secondary-provider evaluation spike (§3). Purely additive; does not touch `experiments/`. | — |
| 1 — Orchestration wiring | L | `src/core/dag.py`, `src/models/*.py`, all 7 `src/agents/*.py`, `src/graph/pipeline.py` as a real LangGraph `StateGraph`. Port `memory_augmented_v2.py`'s `v2_full` logic, rewired onto the Phase 0 gateway. Reuse `ToolResult`, `MemoryManager[T]`, and memory entry schemas unchanged. Does **not** wire Policy Memory / `context_fusion` (Phase 6) — leave that retrieval call site swappable. Includes a test suite (unit per agent + one graph integration test) as part of this phase's sizing. | 0 |
| 2 — API / Gateway | M | FastAPI wrapping the Phase 1 graph; API-key auth → `client_id`; per-client inbound rate limiting (traffic shaping, distinct from the LLM-provider limiter); versioned schema; idempotent submission; single worker process. | 1 |
| 3 — Observability | S/M | Structured logging + OTel spans per agent/tool/LLM call; metrics for resolution rate, replanning rate, escalation rate, per-client memory size, provider-fallback-trigger counts. Can start as soon as Phase 1 exists; can run partially parallel with Phase 2, sharing the Phase 0 logging foundation. | 1 |
| 4 — Tool adapter layer | M | **Done.** `ToolAdapter` interface decoupled from `ToolRegistry`'s failure-injection signature; simulated handlers wrapped as the default dev adapter; real CRM/order-lookup/refund adapters wired to Stripe, KB search wired to Zendesk Guide, all failing closed on missing credentials. | 1 |
| 5 — Security / compliance | S | **Done.** PII redaction in the Memory Manager agent before `write_tool_failure`/`write_plan_success`/`write_escalation`; `src/jobs/retention.py` scheduled-job entrypoint for `prune()` per `Settings.memory_retention_days`; prompt-injection filter on intake, sanitized message fed back into pipeline state for every downstream node. | 1 |
| 6 — Policy Memory integration | blocked, unsized, **now lower-confidence** | The `experiments/` validation this phase was gated on is complete — and found no statistically significant resolution-rate advantage for Policy Memory over plain ticket-based retrieval in a controlled ablation (see `paper/results.md` Tables 8–11, `paper/discussion.md`). Completion of the validation does **not** mean this phase is ready to start: porting `PolicyMemory` + `context_fusion` into the `src/` Planner is not justified by the current evidence. Re-evaluate against `paper/future_work.md`'s prioritized next steps (larger sample size, mechanism-level retrieval-quality comparison) before reconsidering. | 1, external (Policy Memory work) |
| 7 — Scale-out | trigger-based, not scheduled | Containerize the modular-monolith unit (satisfies the AGENTS.md bullet in spirit, not literally); move off free-tier NIM when volume justifies it (config-only change, thanks to the Gateway); Chroma server-mode or Qdrant migration *together with* a distributed rate limiter — never one without the other; revisit microservice extraction only against the §1 triggers. A decision runbook, not a scheduled phase. | 1–5 |

## 5. Summary of deliberate deviations from the AGENTS.md roadmap bullets

- "Containerize each agent as an independent service" → start as a modular monolith instead; see
  §1 for the reasoning and concrete re-extraction triggers.
- "Move off free-tier NIM ... for production throughput" → kept as a Phase 7 trigger-based item,
  not scheduled, since the Gateway makes it a config change whenever volume actually demands it;
  no premature migration.
- Everything else in the original checklist (Qdrant migration, per-client auth, structured
  logging/tracing, real tool integrations, monitoring dashboard, PII/retention review) is kept as
  originally scoped, just sequenced and given file-level detail above.
