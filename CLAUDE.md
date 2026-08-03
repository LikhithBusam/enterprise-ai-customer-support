# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Summary

Research system for a self-improving multi-agent customer support pipeline. The core research
question: does memory-augmented dynamic replanning reduce ticket failure rate and replanning
overhead compared to memoryless and static-ReAct baselines — and does *policy-based* memory
(reusable workflow templates) generalize better than *ticket-based* memory (replaying past
examples)? Target output: a workshop paper plus a production-track client system. Full project
context, tech-stack rationale, and the running status log live in [AGENTS.md](AGENTS.md) —
read it before making non-trivial changes; it is the source of truth for decisions already made.

A separate `Policy_Memory_Implementation_Plan.md` documents the in-progress "Contribution 2"
(Policy Memory) work — check it for schema/architecture details when touching memory code.

## Commands

Package manager is `uv`. Python 3.11+.

```bash
uv sync                          # install deps (incl. dev deps: pytest, ruff)
uv run pytest                    # run all tests
uv run pytest tests/test_v2_logic.py::test_classify_failure  # single test
uv run pytest tests/test_memory_retrieval.py -v
# tests/ also has per-agent, API, and infra coverage worth knowing about:
# test_planner_agent.py, test_executor_agent.py, test_intake_agent.py,
# test_response_escalation_agents.py, test_replanning.py, test_dag.py,
# test_llm_client.py, test_memory_manager_agent.py, test_tool_adapter.py,
# test_api.py, test_telemetry.py, test_config.py
# Policy Memory (Contribution 2) coverage: test_policy_memory.py, test_context_fusion.py,
# test_policy_memory_planner.py, test_analyze_policy_memory.py
uv run ruff check .              # lint
uv run ruff format .             # format

# Run the production API (single worker process — see CLAUDE.md's Architecture section)
uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8000

# Run experiments (writes JSONL to experiments/results/)
uv run python -m scripts.run_experiment                                  # all baselines x all failure rates
uv run python -m scripts.run_experiment --limit 20                       # quick smoke test
uv run python -m scripts.run_experiment --baseline memoryless --failure-rate 0.3
uv run python -m scripts.run_experiment --baseline v2_full --failure-rate 0.0
uv run python -m scripts.run_experiment --baseline policy_memory --failure-rate 0.0  # Contribution 2

# Regenerate the synthetic ticket dataset
uv run python -m scripts.build_synthetic_data

# Post-processing on experiment output
uv run python -m scripts.compute_summary      # resolution-rate / memory-hit summary table
uv run python -m scripts.analyze_results
uv run python -m scripts.error_analysis
uv run python -m scripts.dedup_results
uv run python -m scripts.analyze_policy_memory  # Policy Memory comparison + reuse/transfer metrics

# Retention job (ENTERPRISE_ARCHITECTURE.md Phase 5) — prunes memory older than
# Settings.memory_retention_days per client_id in Settings.api_keys. Meant to be invoked by an
# external scheduler (cron/k8s CronJob), not run continuously.
uv run python -m src.jobs.retention
```

Note: `scripts/run_experiment.py` force-sets `BASELINE_USE_LLM=1`, so runs make real LLM calls
(NIM by default) and are rate-limited/slow — always use `--limit` for iteration, not full 200-ticket
runs, unless you actually intend a full experiment pass.

There is also a `web/` subdirectory — an unrelated Next.js marketing/landing page scaffold (not
part of the research pipeline). It has its own `AGENTS.md`/`CLAUDE.md`; `cd web && npm run dev`
to work on it.

## Architecture

There are **two parallel tracks that must not be conflated**: `experiments/` (research harness,
produces the paper's numbers) and `src/` (production LangGraph pipeline, consumes validated
research logic but never modifies the files it draws from). `src/core/exceptions.py` is the one
remaining empty placeholder; everything else under `src/` is implemented and tested. Per-agent
typed input/output pydantic models (the "Conventions" section's contract below) live in
`src/models/{intake,planner,executor,critic,response,escalation}.py`, one module per agent.

### Research track (`experiments/`)

The actual planner/executor/critic logic for each experimental condition is a self-contained
`run(ticket, registry) -> BaselineResult` function:
- `experiments/baselines/memoryless.py` — LLM planner + critic, no memory, replans from scratch every time
- `experiments/baselines/static_react.py` — fixed ReAct loop, no memory
- `experiments/baselines/langgraph_react.py` — LangGraph-based ReAct baseline (reviewer-facing control, partial)
- `experiments/memory_augmented.py` — original memory-augmented planner/critic (Contribution 1 baseline; **frozen, do not modify** per `Policy_Memory_Implementation_Plan.md`)
- `experiments/memory_augmented_v2.py` — adds the failure-category-conditioned Critic, template-abstracted memory writes, and tool-reliability scoring, all gated by env-var feature flags (`ENABLE_CONDITIONED_CRITIC`, `ENABLE_TEMPLATE_ABSTRACTION`, `ENABLE_RELIABILITY_SCORING`) so `scripts/run_experiment.py` can run `v2_critic_only` / `v2_template_only` / `v2_full` as ablations of the same file; also carries Contribution 2 (Policy Memory, below), gated by its own `ENABLE_POLICY_MEMORY` flag as the `policy_memory` baseline

All of these share the same shape: extract entities from the ticket message → build a tool-call
DAG (list of layers, each layer a set of tool names runnable in parallel) → dispatch tools through
`ToolRegistry` respecting `_DEPENDENCIES` (e.g. `refund` requires a prior successful
`order_lookup`) → run a critic pass that decides `resolved` vs. which tools need replanning →
loop up to `MAX_ITERATIONS` → write outcome to memory (memory-augmented variants only).

**Policy Memory (Contribution 2, `Policy_Memory_Implementation_Plan.md`)** — research-track only,
implemented per that plan's design:
- `memory/` — a new **top-level** package (sibling to `experiments/`/`src/`, deliberately *not*
  `src/memory/`, since this contribution isn't wired into production yet). `memory/policy_memory.py`
  defines the `PolicyMemory` schema (reuses `src.memory.base.BaseMemoryEntry` unmodified);
  `memory/policy_store.py` is its storage — deliberately built directly on ChromaDB's
  `collection.upsert(ids=...)` rather than `src.memory.client_store.ChromaStore` (whose `write()`
  always mints a fresh UUID), since `PolicyMemory.policy_id` is a *deterministic* key
  (`make_policy_id(intent_cluster, workflow_template)`) and the plan requires "update existing
  matching policy or create a new one," i.e. upsert-by-key. Still reuses the same shared Chroma
  client (`ClientStoreRegistry.get_client()`, unmodified) and `{client_id}_policy` collection
  naming convention as every other memory type.
- `experiments/context_fusion.py` — `PlanningContext`/`fuse_context()`: merges top-3 Policy +
  top-2 Failure + top-3 Episodic memory retrievals for the Planner prompt, per the plan's "Context
  Fusion" section. Not `src/agents/context_fusion.py` — that only gets created once this lands in
  production (`ENTERPRISE_ARCHITECTURE.md` Phase 6, not started).
- Inside `experiments/memory_augmented_v2.py`: `_enable_policy_memory()` (env `ENABLE_POLICY_MEMORY`,
  default off) gates a second Planner path (`_plan_llm_policy`) that swaps PlanSuccessMemory-only
  retrieval for the fused Policy+Failure+Episodic context — the controlled variable for testing
  "does policy-based memory generalize better than ticket-based memory," with the Critic/
  reliability-scoring behavior held identical to `v2_full`. `_write_policy_memory` (write-on-
  success-only, mirroring `_write_plan_success`) extracts the DAG's tool-name-only shape as
  `workflow_template`, builds `dependency_graph`/`tool_constraints` from it, and upserts by
  deterministic `policy_id` — reinforcing usage_count/running-average stats on repeat instead of
  writing a duplicate. `MemoryAugmentedV2Result` gained `policy_hit`/`policy_id_used`/
  `policy_usage_count_at_use` (always present, default False/None, regardless of the flag).
- `scripts/run_experiment.py`'s `BASELINES` gained `"policy_memory"` (v2_full's Critic config +
  `ENABLE_POLICY_MEMORY=1`); `_reset_memory_augmented_store()` now also clears the `policy`
  collection suffix per failure-rate tier. Every baseline's JSONL record also gained `latency_ms`
  (wall-clock per-ticket `run_fn()` time), for the plan's cross-baseline Latency comparison.
- `scripts/analyze_policy_memory.py` — extends `scripts/compute_summary.py`'s per-baseline table
  with the plan's Evaluation-section metrics `compute_summary.py` doesn't compute: Policy
  Retrieval Rate, Policy Reuse Rate (fraction of hits where `policy_usage_count_at_use >= 2`), and
  resolution rate conditioned on policy-hit vs. no-hit (the generalization/transfer signal).
  Compares `memoryless`/`static_react`/`memory_augmented`/`policy_memory` per failure rate.

**Tool layer** (`src/tools/`): `registry.py` is a name → handler dispatch table
(`crm`, `order_lookup`, `refund`, `kb_search`) with a shared `ToolResult` model and a
`ToolRegistry(failure_rate, seed)` that injects synthetic failures. Handlers are pure
simulated-data generators (no real backends) — `roll_failure()` randomly picks a `FailureType`
(`timeout` / `ambiguous_data` / `wrong_result`) per call based on `failure_rate`. **Critic code
must only read `success`/`data`/`error` off `ToolResult`, never `failure_type`** — that field is
oracle/eval-only metadata used to score prediction accuracy after the fact, and feeding it to the
Critic invalidates the replanning research result (see AGENTS.md "What NOT to do"). Tool mock
data ranges must stay in sync with the dataset's ID ranges (see `_build_orders()` in
`src/tools/order.py` — a mismatch here silently broke a prior experiment run).

**Memory layer** (`src/memory/`): `base.py` defines the abstract `MemoryManager[T]` interface
(`write` / `retrieve` / `prune`); `client_store.py`'s `ChromaStore` implements it over ChromaDB,
one collection per `{client_id}_{suffix}`, JSON-serialized pydantic entries. `ClientStoreRegistry`
caches a `ClientStore` (bundling `episodic`, `tool_failure`, `plan_success`, `escalation` stores)
per `client_id` — memory is isolated per client by design; do not merge across clients. Entry
schemas (`episodic.py`, `plan_success.py`, `tool_failure.py`, `escalation_memory.py`) are the
interface contract between the Planner/Critic and storage — treat changes to these as breaking.

**LLM calls**: each experiment module has its own `_call_llm()` / `_SlidingWindowRateLimiter` /
`_get_client()` (currently duplicated across `memory_augmented.py`, `memory_augmented_v2.py`, and
the baselines rather than shared — be aware when patching rate-limit or provider logic, it likely
needs updating in more than one file). Provider is chosen via `LLM_PROVIDER` env var (`nim` default,
`gemini` optional); NIM's free tier hard-caps at ~40 req/min so the rate limiter proactively throttles
to 35/60s — do not rely on reactive retry/backoff alone (caused 20+ minute stalls previously, per
AGENTS.md). `BASELINE_USE_LLM=0` switches every baseline to its deterministic non-LLM fallback
planner/critic, useful for fast structural tests.

**Experiment driver**: `scripts/run_experiment.py` iterates `{baseline} x {failure_rate}` over
`data/synthetic_tickets_v2.jsonl` (falls back to `synthetic_tickets.jsonl` if v2 is absent),
appending one JSON record per ticket to `experiments/results/{baseline}_{failure_rate}.jsonl`. For
`memory_augmented`/`v2_*` baselines it wipes the Chroma collections for `experiment_client` before
each failure-rate tier so memory doesn't leak across tiers, but *does* accumulate within a tier —
this ordering matters for reproducing published numbers.

### Production track (`src/`)

`src/graph/pipeline.py` wires all 7 agents into a LangGraph `StateGraph` (`build_pipeline()` /
`run_ticket()`), porting `experiments/memory_augmented_v2.py`'s `v2_full` behavior (conditioned
critic + template-abstracted memory + tool-reliability scoring, all always-on here — the ablation
env flags stay research-only). Node order: `intake → planner → executor → critic` looping back to
`planner` on an unresolved verdict (up to `MAX_ITERATIONS = 3`) or falling through to
`response → escalation (if unresolved) → write_memory`. See `tests/test_pipeline_integration.py`
for the shape of a full run (happy path, replan-then-resolve, escalate-after-exhaustion).

- `src/agents/*.py` — one `run(TypedInput, ...) -> TypedOutput` function per agent, each a direct
  port of the equivalent `experiments/memory_augmented_v2.py` logic onto the abstractions below
  rather than a rewrite (e.g. `critic_replanner.py`'s `_classify_failure` mirrors
  `memory_augmented_v2.py::_classify_failure` verbatim). `intake.py` and `response.py` are
  genuinely new (experiments/ never implements Intake as a standalone step — it reads oracle
  `expected_tool_sequence` off the dataset instead) but are deterministic regex/string-formatting,
  not LLM calls yet, despite "intake"/"response" being defined roles in the gateway below.
- `src/core/llm_client.py` — `LLMProviderGateway`: per-role **ordered fallback chain** of
  provider/model pairs (`default_role_providers()`; e.g. planner/critic try `nim` then fall back to
  local `ollama`), each provider gated by its own `_SlidingWindowRateLimiter` (proactive, mirrors
  the experiments/ limiter) and `_CircuitBreaker` (opens after 3 consecutive failures, half-opens
  after a 60s cooldown — replaces relying on reactive retry/backoff alone). Not wired into
  `experiments/`; that code keeps its own duplicated `_call_llm()` per AGENTS.md.
- `src/core/dag.py` — `ExecutionDAG` (pydantic): formalizes the `list[list[str]]` layer/dependency
  shape used ad hoc across `experiments/` (`TOOL_LAYERS`, `TOOL_DEPENDENCIES`,
  `is_dependency_ordered()` mirrors `memory_augmented_v2.py::_dag_is_valid`) as the typed
  Planner→Executor contract AGENTS.md's "Data Contracts" section requires.
- `src/agents/memory_manager.py` — typed `retrieve_plan_templates` / `retrieve_tool_failure` /
  `compute_tool_reliability` / `write_episodic` / `write_plan_success` / `write_tool_failure` /
  `prune` functions in front of `ClientStoreRegistry`, so the Planner/Critic never touch
  `ChromaStore` directly (experiments/ calls store methods inline). Wraps the same
  `MemoryManager[T]`/`ChromaStore` contracts from `src/memory/` unmodified.
- `src/core/config.py` — `Settings` (pydantic), read from the same `.env` keys `experiments/`
  already uses (`get_settings()` / `Settings.from_env()`), plus a separate `PRODUCTION_USE_LLM`
  flag (`use_llm`) so the production graph's LLM toggle doesn't cross wires with `experiments/`'s
  `BASELINE_USE_LLM`.
- `src/agents/executor.py` — the only agent that calls tools; dispatch is injected as a plain
  `DispatchFn` callable rather than importing `ToolRegistry` directly, since `ToolRegistry.dispatch`
  bakes in synthetic-failure injection (`failure_rate`/`rng`) that has no analog for a real backend.
  `src/tools/adapter.py` (Phase 4) is what actually supplies that callable in production — see below.
- Policy Memory / `context_fusion` (the in-progress Contribution 2 from
  `Policy_Memory_Implementation_Plan.md`) is **not** wired into this pipeline yet —
  `src/agents/planner.py`'s `retrieve_plan_templates` call is the documented swap-in point
  (`ENTERPRISE_ARCHITECTURE.md` Phase 6).

`src/api/` (Phase 2) wraps the graph in FastAPI — `POST /v1/tickets`, `GET /health`. `main.py`'s
`create_app(pipeline=None, settings=None, rate_limiter=None, idempotency_cache=None)` builds a
`build_pipeline()` once at app construction (not per-request) and takes fakes for all four via
injection for tests, mirroring `build_pipeline`'s own gateway/dispatch injection pattern; the
module-level `app = create_app()` is the real `uvicorn` entrypoint.
- `auth.py` — `X-API-Key` header → `client_id` via `Settings.api_keys` (`API_KEYS=key:client_id,...`
  env var); `client_id` is never taken from the request body. `create_app` overrides FastAPI's
  `get_settings` dependency per app instance so an injected `settings` actually reaches this
  dependency chain instead of the global `Settings.from_env()` singleton.
- `rate_limit.py` — `ClientRateLimiter`: per-*client* inbound sliding-window limiter (`api_rate_limit_per_minute`,
  default 60/min), **rejects with 429 instead of sleeping** — distinct in kind from
  `llm_client.py`'s per-*provider* limiter, which throttles outbound LLM calls by blocking.
- `idempotency.py` — `IdempotencyCache`: keyed on `(client_id, ticket_id)`, so a retried
  submission returns the cached response (`TicketResponse.replayed=True`) instead of
  re-dispatching tools (e.g. double-issuing a refund). Checked before the rate limiter, so retries
  of an already-processed ticket don't consume rate-limit budget.
- Both limiter and cache are **in-process, single-worker-process state** — the same accepted
  limitation as `llm_client.py`'s rate limiter (see `ENTERPRISE_ARCHITECTURE.md` §3); a multi-worker
  deployment needs a shared store (Redis token bucket / durable idempotency table) first.

`src/core/telemetry.py` (Phase 3) adds OTel spans + metrics on top of Phase 0's structured JSON
logging (`src/core/logging.py`, already emitted globally by every plain `logging.getLogger`
call once `configure_logging()` has run, since child loggers propagate to the root handler).
- `span(name, **attrs)` wraps a block in a traced span; used at every agent `run()` (each ported
  agent has a thin `run()` → `_run()` split so the span wraps the whole body without reindenting
  it — see `planner.py`/`critic_replanner.py`/`executor.py`), every tool dispatch
  (`executor.py`'s `tool.dispatch` span), every LLM call (`llm_client.py`'s `_call_provider`),
  and the whole graph run (`pipeline.py`'s `run_ticket`, the umbrella span everything else nests
  under).
- Metrics recorded: `tickets_total`/`tickets_resolved_total`/`tickets_escalated_total` counters +
  a `ticket_replanning_count` histogram (all recorded once per ticket in `run_ticket`, after
  `app.invoke()` returns — one place, works for API calls and any future direct caller alike),
  `llm_provider_fallback_total` (recorded in `llm_client.py`'s `call()` when a provider fails and
  the gateway falls through), and a `memory_size` observable gauge (callback iterates
  `ClientStoreRegistry.snapshot()` — a new accessor, necessarily incomplete: only clients touched
  since the last process restart appear).
- **True no-op until configured**: `configure_telemetry()` does nothing (no SDK provider
  registered, no background thread started) unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set — every
  `span()`/metric call elsewhere is then a real OTel-API no-op. This is deliberate: an earlier
  version of this module defaulted to a live `ConsoleSpanExporter`/`ConsoleMetricExporter` when
  unconfigured, which — since `create_app()` calls `configure_telemetry()` unconditionally, and
  every test builds an app via `create_app()` — spammed every test run with span/metric dumps.
  Called unconditionally from `create_app()`; safe to call from tests too for the same reason.
- If you construct a `BatchSpanProcessor`/`MeterProvider` directly (e.g. testing
  `_build_span_processor`/`_build_meter_provider`), you must call `.shutdown()` — they start real
  background export threads on construction, and leaking them across tests caused an observed
  native-level crash (Windows access violation) when a later test imported `onnxruntime`.

`src/tools/adapter.py` (Phase 4) is the `ToolAdapter` interface production dispatch is built on —
deliberately decoupled from `ToolRegistry.dispatch()`'s failure-injecting signature, per the same
rule `executor.py` already follows.
- `ToolAdapter` (ABC) — one method, `dispatch(tool_name, params) -> ToolResult`, matching
  `DispatchFn`'s shape exactly so any concrete adapter's `.dispatch` drops straight into
  `build_pipeline(dispatch=...)`.
- `SimulatedToolAdapter` — the new default (`build_pipeline(dispatch=None)`, replacing the interim
  `ToolRegistry(failure_rate=0.0)` wiring). Calls the same simulated handlers
  (`src/tools/{crm,order,refund,kb_search}.py`) directly rather than through `ToolRegistry`
  (research-only, untouched). `failure_rate` defaults to 0.0 but stays configurable for staging use.
- `RealToolAdapter` — composes one `ToolBackend` per tool (`CrmBackend`/`OrderBackend`/
  `RefundBackend`/`KbSearchBackend`) behind the same `dispatch(tool_name, params)` interface.
  `CrmBackend`/`OrderBackend`/`RefundBackend` call Stripe (Customers / PaymentIntents / Refunds
  APIs — `order_id`/`refund`'s `order_id` are Stripe PaymentIntent ids, not a separate order
  system); `KbSearchBackend` calls Zendesk Guide's help-center search API. Each backend fails
  closed with a `ToolResult(success=False, error=...)` (not an exception) when its credentials
  (`STRIPE_API_KEY` / `ZENDESK_SUBDOMAIN`+`ZENDESK_EMAIL`+`ZENDESK_API_TOKEN` in `src/core/config.py`)
  are unset, or when the provider call itself raises. Swapping any one integration for a different
  vendor means rewriting that backend's `call()`; nothing upstream (`RealToolAdapter`, `Executor`,
  `Planner`, `Critic`) changes.
- Real backends must never set `ToolResult.failure_type` (stays `None`, the model default) — same
  oracle/eval-only rule as everywhere else in `src/` and `experiments/`.

`src/core/pii.py` (Phase 5) is `redact_pii()`: a regex-based, best-effort scrub of email/phone/
SSN/credit-card-like patterns from free text. Called inside `src/agents/memory_manager.py`
(`write_tool_failure`'s `context`, `write_plan_success`'s `parameterized_message`, and
`write_escalation`'s `human_correction`/`original_response`) before any of it reaches
`ChromaStore.write()` — deliberately in the Memory Manager agent, not retrofitted into
`ChromaStore` itself. `write_escalation` isn't called anywhere yet (`EscalationMemory` needs a
`human_correction`, which only exists once the human-feedback loop — a separate, still-open
AGENTS.md TODO — is built), but the writer already redacts so that future wiring doesn't need to
retrofit compliance later. `src/agents/intake.py`'s prompt-injection filter (heuristic regex
patterns, not a classifier) runs at the same layer: `src/graph/pipeline.py`'s intake node
overwrites `PipelineState["customer_message"]` with `IntakeOutput.sanitized_message`, so every
downstream node (Planner, Critic, Response, Escalation, memory write) — all of which read
`customer_message` straight off state — sees the sanitized text, not the raw one.

`src/jobs/retention.py` is Phase 5's other piece: a scheduled-job entrypoint
(`uv run python -m src.jobs.retention`) that
calls the existing `MemoryManager.prune()` per `client_id` in `Settings.api_keys`, per
`Settings.memory_retention_days` — deliberately an externally-scheduled job (cron/k8s CronJob),
not a background thread inside the single-worker API process.

`ENTERPRISE_ARCHITECTURE.md` is the sequenced roadmap for the rest of production-readiness
(Phase 6 Policy Memory integration, blocked on external research; Phase 7 scale-out) — check it
before adding infrastructure so new work lands in the right phase rather than jumping ahead.

## Conventions carried over from AGENTS.md

- Every new agent gets its own module under `agents/`, with a single typed input dataclass/pydantic
  model and output dataclass/pydantic model — never pass raw strings between agents/tools.
- No hardcoded prompts inline — store versioned prompt files under `src/prompts/`.
- Only the Executor Agents call tools; the Planner must never call tools directly.
- Never skip the Critic/Replanner step, even for "simple" tickets — its failure logging is load-bearing for the research metrics.
- Do not implement cross-client memory sharing without explicit sign-off (compliance requirement).
- `experiments/memory_augmented.py` (Contribution 1) is frozen — put new work in `memory_augmented_v2.py` or new files instead of editing it.
