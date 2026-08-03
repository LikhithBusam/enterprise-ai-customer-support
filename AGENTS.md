# AGENTS.md — Adaptive Multi-Agent Customer Support System

## Project Summary
Self-improving multi-agent customer support system with dynamic tool-use planning
and memory-augmented replanning. Research goal: show memory-augmented dynamic
replanning reduces failure rate and replanning overhead over ticket volume,
compared to memoryless replanning and static ReAct baselines. Target: workshop
paper (agentic AI / tool-use track) + production-ready client system.

## Tech Stack (lock these — no substitution without updating this file)
- Orchestration: LangGraph
- LLM(s):
  - Planner Agent / Critic-Replanner Agent: meta/llama-3.1-8b-instruct via NVIDIA NIM (free API, https://integrate.api.nvidia.com/v1) — chosen after live latency testing: responds in ~1s vs 60s+/timeouts on larger Qwen MoE models on NIM's free tier. True dense 8B, reliable tool-calling, open-weight (reproducible for the paper)
  - Intake Agent / Response Agent: qwen2.5:3b-instruct via local Ollama — lightweight enough to run on this machine (~8GB RAM WSL), no NIM dependency needed for simple classification/drafting tasks
  - LLM-as-judge (offline evaluation only, not in live pipeline): Gemini Flash free tier — used for scoring/ablation runs, never for production ticket handling
- Vector store (memory): Chroma, local, per-client isolated (separate collection per client). Migration path to Qdrant noted for production scale (>1M vectors) — do not build for that yet
- **Hardware constraint:** local dev machine (WSL, ~8GB total RAM) cannot run qwen2.5:7b-instruct — causes OOM/system freeze. Use qwen2.5:3b-instruct for lightweight local agents only. Planner/Critic run via NVIDIA NIM (cloud, no local hardware constraint) instead of local 7B.
- **NVIDIA NIM notes:** free tier, no credit card, ~40 requests/min rate limit (confirmed hard ceiling, no increase available per NVIDIA community forums). Model catalog changes — verify available models via `client.models.list()` before assuming a model ID exists. Larger/newer models (Qwen3.5, Qwen3-next MoE) showed inconsistent/slow latency on free tier during testing; stick to well-established dense models (Llama 3.1 8B) for the live pipeline unless retested. Live pipeline uses a proactive sliding-window rate limiter (35 calls/60s) to stay under the ceiling — do not rely on reactive retry/backoff alone, it caused 20+ minute stalls during testing.
- **Gemini as live-pipeline provider — rejected:** attempted as a higher-throughput alternative to NIM (higher RPM), but this API key's free tier has a **20 requests/day (RPD)** cap, far too low for a 200+ ticket experiment. Gemini remains judge-only (offline eval, low volume). `LLM_PROVIDER` env var supports switching to `gemini` if a higher-quota key becomes available later, but default/working config is `LLM_PROVIDER=nim`.
- Tool interface: MCP where possible, plain function-calling otherwise
- Language: Python 3.11+
- Package manager: uv

## Agent Architecture (do not rename without updating this file + diagrams)
1. **Intake Agent** — classify ticket intent, extract entities
2. **Planner Agent** — builds tool-call DAG; retrieves from Episodic/Plan-Success Memory before planning
3. **Executor Agents** — call tools (order lookup, refund, CRM, KB search); run in parallel where the DAG allows
4. **Critic/Replanner Agent** — detects failed/ambiguous tool results, revises plan, writes to Tool-Failure Memory
5. **Memory Manager Agent** — handles retrieval, dedup, decay/pruning across all memory stores
6. **Response Agent** — drafts customer-facing reply, tone-controlled
7. **Escalation Agent** — decides human handoff, summarizes for human agent, writes corrections to Escalation Memory

## Memory Schema (interface contract — treat like an API)
- `EpisodicMemory`: {ticket_id, intent, plan_dag, outcome, timestamp}
- `ToolFailureMemory`: {tool_name, failure_type, context, fix_applied}
- `PlanSuccessMemory`: {intent_cluster, dag_template, success_rate}
- `EscalationMemory`: {ticket_id, human_correction, original_response}
- Isolation: per-client by default (privacy/compliance requirement — do not merge across clients without explicit config flag)

## Data Contracts
- Planner output → Executor input: must be a typed DAG object, not free text
- Executor output → Critic input: must include success/failure status + raw tool response
- All inter-agent payloads: dataclass or pydantic model, never raw strings

## Coding Conventions
- Every new agent = its own module under `agents/`
- Every agent has a single typed input dataclass and output dataclass (mirrors your prior `QueryProcessingOutput` pattern)
- No hardcoded prompts inline — store in `prompts/` as versioned files
- Tests required for: DAG validity, memory retrieval correctness, replanning trigger logic

## What NOT to do
- Do not let Planner call tools directly — only Executor Agents call tools
- Do not skip Critic/Replanner step even for "simple" tickets — needed for consistent failure logging
- Do not implement global cross-client memory without explicit sign-off (compliance risk)
- Critic/Replanner Agent must never read `ToolResult.failure_type` directly — only `success`, `data`, `error`. `failure_type` is eval/logging-only metadata used by the experiment harness to score diagnosis accuracy, not an oracle label the agent gets to see. Feeding it to the Critic invalidates the replanning research result.

## Research Redesign (post-critique — incremental, not a rewrite)
Prior three-way baseline comparison (memoryless/static_react/memory_augmented) is
kept as-is and becomes the motivating baseline in the paper, not the whole result.
Two concrete code changes needed on top of existing memory_augmented.py:
1. **Failure-category-conditioned Critic**: Critic predicts failure category (timeout/
   ambiguous/wrong-result) from observable symptoms only (success/data/error — no
   oracle `failure_type`, per existing safety rule) and routes to a category-specific
   recovery strategy from ToolFailureMemory instead of one generic replan prompt.
   Log predicted-vs-actual category (actual = failure_type, eval-only) to measure
   prediction accuracy as a new metric.
2. **Template-abstracted memory write**: before writing to PlanSuccessMemory, strip
   ticket-specific values (order IDs, customer IDs) from the DAG and store at
   intent-cluster + parameterized-template level, not verbatim. Directly addresses
   the memorization-vs-generalization risk (memory_hit was ~99.5% by ticket #2 in
   current data — likely partly memorizing near-duplicate tickets, not generalizing).
   Evaluate resolution rate stratified by retrieval semantic distance to confirm.

Paper framing narrows to ONE core claim: naive agentic memory generalizes poorly;
category-conditioned + template-abstracted memory closes the gap. Existing 3-way
comparison is the motivating baseline showing the naive-memory result; the above
two changes are the actual contribution.

Everything else in this file (tool registry, dependency gating, rate limiter,
memory schema, agent list) stays as built — do not rewrite from scratch.

## Current Status
- [x] Memory schema finalized
- [x] Simulated tool layer (order, refund, crm, kb_search) + registry dispatch implemented
- [x] Synthetic ticket dataset (200 tickets, 6 intent clusters) built — TODO: increase phrasing diversity before final experiments, currently template-based with some duplication
- [x] Stateless baselines (memoryless, static_react) implemented with real LLM calls (NIM), entity extraction, dependency gating (refund blocked on failed order_lookup), proactive rate limiting
- [x] Full 200-ticket baseline runs across 3 failure rates (0.0, 0.3, 0.7) — DONE for memoryless, static_react, memory_augmented. Results backed up in experiments/results/backup_*/
- [x] Memory-augmented Planner/Critic implemented (experiments/memory_augmented.py) — retrieves PlanSuccessMemory/ToolFailureMemory, writes back with dependency-order validation (bad plans rejected before write, oracle-label safety preserved)
- [x] Headline result (FINAL, on corrected dataset — see below): memory_augmented beats both baselines at 0.0 and 0.3 failure rates; converges with memoryless at 0.7 (honest boundary condition to report)
- [x] Statistical significance testing (chi-square) — p=0.00000 for memory_augmented vs static_react at 0.3 on original dataset, confirmed real. Re-verify on final corrected dataset numbers below before citing in paper.
- [x] Learning-curve analysis run — NO clear monotonic upward trend found (75-95% bouncing); memory saturates almost immediately (memory_hit ~100% by ticket #2) rather than climbing gradually. Reframe paper claim accordingly — NOT "improves over time," IS "consistently better from early on." This finding directly motivates the memorization-vs-generalization redesign above.
- [x] Dataset diversity fix applied and verified — regenerated data/synthetic_tickets.jsonl now 200/200 unique messages (was 176/200). Old dataset archived in experiments/results/backup_v1_old_dataset/.
- [x] Tool mock-data range bug found and fixed post-dataset-regen: src/tools/order.py's _build_orders() had hardcoded range(1,31) (ORD-1001–1030), but regenerated dataset references up to ORD-1049 — widened to range(1,61). Also fixed a circular import between order.py and registry.py surfaced during the fix. crm.py's range(1,201) confirmed already sufficient for dataset's max CUST-0200.
- [x] **FINAL three-way comparison, corrected dataset + corrected tools (this is the paper-citable table):**
  | Failure Rate | memoryless | static_react | memory_augmented |
  |---|---|---|---|
  | 0.0 | 188/200 (94%) | 118/200 (59%) | 194/200 (97%) |
  | 0.3 | 84/200 (42%) | 102/200 (51%) | 169/200 (84%) |
  | 0.7 | 91/200 (46%) | 20/200 (10%) | 96/200 (48%) |
  All results deduped, verified unique-200-per-tier, backed up in archive/experiment-backups/backup_*_v3_final/
  (relocated from experiments/results/ during the repository cleanup pass — contents unchanged).
- [ ] Re-run chi-square significance test on the corrected-dataset numbers above before citing in paper
- [ ] Failure-category-conditioned Critic (redesign item 1) — NEXT
- [ ] Template-abstracted memory write + retrieval-distance stratified eval (redesign item 2) — NEXT
- [ ] Add LangGraph-ReAct baseline (cheap, closes "did you just reimplement LangGraph" reviewer question) — partial attempt exists (experiments/results/langgraph_react_0.3.jsonl, incomplete/from old dataset, re-run needed)
- [ ] Escalation Agent + human feedback loop
- [ ] LangGraph orchestration wiring (current agents are standalone functions, not yet a LangGraph graph — needed for the "multi-agent system" framing to be literally true, not just conceptually)
- [x] Basic prompt-injection filter on ticket intake (security gap flagged in critique) — `src/agents/intake.py`'s heuristic pattern filter, wired into the production graph (`ENTERPRISE_ARCHITECTURE.md` Phase 5); research-track `experiments/` baselines are unaffected
- [x] Policy Memory (Contribution 2) research implementation — per `Policy_Memory_Implementation_Plan.md`: `memory/` (new top-level package: `PolicyMemory` schema + upsert-by-`policy_id` Chroma store), `experiments/context_fusion.py` (top-3 Policy + top-2 Failure + top-3 Episodic fusion for the Planner), and `experiments/memory_augmented_v2.py`'s `ENABLE_POLICY_MEMORY`-gated `policy_memory` baseline in `scripts/run_experiment.py`. Research-track only — not wired into `src/` (that's `ENTERPRISE_ARCHITECTURE.md` Phase 6, gated on this baseline's results). Full 200-ticket runs across the 3 failure-rate tiers have not been executed yet — `scripts/analyze_policy_memory.py` is ready to report Resolution Rate / Policy Retrieval Rate / Policy Reuse Rate / Transfer once they are.
- [ ] Paper draft — single focused claim (see Research Redesign above), not a 20-contribution list



## Enterprise/Production Readiness Roadmap (post-research)
See [ENTERPRISE_ARCHITECTURE.md](ENTERPRISE_ARCHITECTURE.md) for the sequenced architecture and implementation plan for the items below.
- [ ] Containerize each agent as an independent service (Docker) per original multi-agent microservice design
- [ ] Swap Chroma → Qdrant for production-scale memory (>1M vectors)
- [x] Add per-client auth + rate limiting on the API layer (not just the LLM provider) — `src/api/` (FastAPI, `POST /v1/tickets`), API-key auth, per-client inbound rate limiter, idempotent submission. Single worker process (see `ENTERPRISE_ARCHITECTURE.md` §3/Phase 2). Real tool integrations (Phase 4) and observability (Phase 3) still open.
- [x] Structured logging + tracing across agent calls (OpenTelemetry or similar) for auditability — ties into Critic/Replanner's existing failure-logging design — `src/core/logging.py` (JSON logs) + `src/core/telemetry.py` (OTel spans per agent/tool/LLM call, metrics: tickets_total/resolved/escalated, replanning_count histogram, memory_size gauge, llm_provider_fallback_total). No-op until `OTEL_EXPORTER_OTLP_ENDPOINT` is set — no collector required for local dev (`ENTERPRISE_ARCHITECTURE.md` Phase 3).
- [x] Tool adapter layer decoupled from `ToolRegistry` — `src/tools/adapter.py`'s `ToolAdapter` interface, `SimulatedToolAdapter` (new default for `build_pipeline()`, wraps the same simulated handlers directly) and `RealToolAdapter` (composes per-tool `ToolBackend`s). Real integrations now wired: `CrmBackend`/`OrderBackend`/`RefundBackend` call Stripe (Customers / PaymentIntents / Refunds APIs — `order_id` is a Stripe PaymentIntent id, since Stripe has no separate order/fulfillment concept), `KbSearchBackend` calls Zendesk Guide's help-center search. Each fails closed with a `ToolResult(success=False, ...)` (not an exception) when its env-var credentials are unset (`STRIPE_API_KEY`, `ZENDESK_SUBDOMAIN`/`ZENDESK_EMAIL`/`ZENDESK_API_TOKEN`) or the provider call errors. Swapping either vendor is scoped to rewriting that one `ToolBackend.call()`, no changes upstream (`ENTERPRISE_ARCHITECTURE.md` Phase 4 — now complete).
- [ ] Move off free-tier NIM (40 RPM ceiling) to a paid tier or dedicated inference endpoint for production throughput
- [ ] Add monitoring dashboard: resolution rate, replanning rate, escalation rate, per-client memory size
- [x] Security review: PII handling in EpisodicMemory/EscalationMemory, data retention/deletion policy per client — `src/core/pii.py`'s `redact_pii()` scrubs email/phone/SSN/card-like patterns before `write_tool_failure`/`write_plan_success`/`write_escalation` reach `ChromaStore`; `src/jobs/retention.py` is the scheduled-job entrypoint for `MemoryManager.prune()` per `Settings.memory_retention_days`, run externally (cron/k8s CronJob), not an in-process thread (`ENTERPRISE_ARCHITECTURE.md` Phase 5 — now complete)