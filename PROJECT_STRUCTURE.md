# Project Structure

Annotated map of the repository. See [ARCHITECTURE.md](ARCHITECTURE.md) for how these pieces
interact, not just where they live.

```
enterprise-ai-customer-support/
│
├── src/                          # PRODUCTION TRACK — typed, tested, LangGraph-orchestrated
│   ├── agents/                   # One run(TypedInput) -> TypedOutput function per agent
│   │   ├── intake.py                #   entity extraction + prompt-injection filter
│   │   ├── planner.py               #   tool-call DAG + memory retrieval
│   │   ├── executor.py              #   the only agent that calls tools
│   │   ├── critic_replanner.py      #   failure classification + replan decision
│   │   ├── memory_manager.py        #   typed wrapper in front of src/memory/
│   │   ├── response.py              #   customer-facing reply drafting
│   │   └── escalation.py            #   human-handoff decision + summary
│   ├── api/                      # FastAPI HTTP layer
│   │   ├── main.py                  #   create_app(), POST /v1/tickets, GET /health
│   │   ├── auth.py                  #   X-API-Key -> client_id
│   │   ├── rate_limit.py            #   per-client inbound limiter (429)
│   │   ├── idempotency.py           #   (client_id, ticket_id) replay cache
│   │   └── schemas.py               #   TicketRequest / TicketResponse pydantic models
│   ├── core/                     # Cross-cutting infrastructure
│   │   ├── llm_client.py            #   LLMProviderGateway — fallback chain, rate limit, circuit breaker
│   │   ├── dag.py                   #   ExecutionDAG — typed Planner->Executor contract
│   │   ├── config.py                #   Settings (pydantic), reads .env
│   │   ├── logging.py                #   structured JSON logging
│   │   ├── telemetry.py             #   OTel spans/metrics, no-op until configured
│   │   ├── pii.py                    #   redact_pii() — best-effort PII scrub before memory writes
│   │   └── exceptions.py            #   (placeholder — only unimplemented file in src/)
│   ├── graph/
│   │   └── pipeline.py              #   build_pipeline() / run_ticket() — the LangGraph StateGraph
│   ├── memory/                   # Shared memory implementation (used by both tracks)
│   │   ├── base.py                  #   abstract MemoryManager[T] interface
│   │   ├── client_store.py          #   ChromaStore + ClientStoreRegistry
│   │   ├── episodic.py / plan_success.py / tool_failure.py / escalation_memory.py  # entry schemas
│   ├── models/                   # Per-agent typed input/output pydantic models
│   ├── tools/                    # Tool layer
│   │   ├── registry.py               #   ToolRegistry — research-track dispatch + failure injection
│   │   ├── adapter.py                #   ToolAdapter / SimulatedToolAdapter / RealToolAdapter
│   │   ├── crm.py / order.py / refund.py / kb_search.py   # simulated + real (Stripe/Zendesk) handlers
│   └── jobs/
│       └── retention.py             #   scheduled MemoryManager.prune() job (cron/k8s CronJob entrypoint)
│
├── experiments/                  # RESEARCH TRACK — produces the paper's numbers
│   ├── baselines/
│   │   ├── memoryless.py            #   LLM planner + critic, no memory
│   │   ├── static_react.py          #   fixed ReAct loop, no memory
│   │   └── langgraph_react.py       #   LangGraph-based ReAct control (partial)
│   ├── memory_augmented.py       # Contribution 1 — FROZEN, do not modify
│   ├── memory_augmented_v2.py    # Conditioned Critic + template memory + Contribution 2 (Policy Memory), env-flag-gated ablations
│   └── context_fusion.py         # PlanningContext / fuse_context() — Policy+Failure+Episodic fusion
│
├── memory/                       # Policy Memory (Contribution 2) — research-track only,
│   ├── policy_memory.py          # deliberately NOT under src/memory/ since it isn't wired into
│   └── policy_store.py           # production yet (see ENTERPRISE_ARCHITECTURE.md Phase 6)
│
├── scripts/                      # Experiment driver + post-processing
│   ├── run_experiment.py            #   the main entrypoint — {baseline} x {failure_rate}
│   ├── build_synthetic_data.py      #   regenerates data/synthetic_tickets_v2.jsonl
│   ├── compute_summary.py           #   resolution-rate / memory-hit summary table
│   ├── analyze_results.py           #   deeper per-baseline analysis
│   ├── analyze_policy_memory.py     #   Policy Retrieval/Reuse Rate, transfer metrics
│   ├── error_analysis.py            #   failure-category breakdown
│   ├── dedup_results.py             #   dataset/result dedup utility
│   ├── policy_memory_validation.py  #   Contribution 2 validation harness
│   └── v2_full_ablation.py          #   ablation runner for v2's feature flags
│
├── data/
│   ├── synthetic_tickets_v2.jsonl   # 200-ticket synthetic dataset, 6 intent clusters (current)
│   ├── synthetic_tickets.jsonl      # earlier dataset version (fallback if v2 absent)
│   └── chroma/                      # local Chroma persistence (gitignored contents)
│
├── archive/                      # Historical artifacts kept for provenance, not active code
│   └── experiment-backups/          #   experiments/results/backup_* snapshots — the specific
│                                     #   result sets AGENTS.md cites as the basis for
│                                     #   paper-cited numbers (e.g. "backed up in backup_*_v3_final/")
│
├── tests/                        # pytest — one file per module/concern, see naming below
│   ├── test_planner_agent.py / test_executor_agent.py / test_intake_agent.py /
│   │   test_response_escalation_agents.py / test_replanning.py / test_dag.py /
│   │   test_llm_client.py / test_memory_manager_agent.py / test_tool_adapter.py /
│   │   test_api.py / test_telemetry.py / test_config.py / test_retention_job.py /
│   │   test_pii.py / test_pipeline_integration.py            # production-track coverage
│   └── test_policy_memory.py / test_context_fusion.py /
│       test_policy_memory_planner.py / test_analyze_policy_memory.py / test_v2_logic.py /
│       test_memory_retrieval.py                              # research-track / Policy Memory coverage
│
├── paper/                        # Workshop paper draft, one file per section
│   ├── abstract.md / introduction.md / related_work.md / methodology.md /
│   │   implementation.md / experiments.md / results.md / discussion.md /
│   │   limitations.md / future_work.md / conclusion.md / references.md /
│   │   reproducibility.md / architecture.md / final_paper.md / paper_outline.md
│
├── dashboard/                    # Support Console — React + Vite frontend (separate npm project)
│   ├── API_CONTRACT.md           #   documented contract for every mocked endpoint
│   ├── src/
│   │   ├── app/                     #   router, providers, client (tenant) context
│   │   ├── layouts/                 #   AppShell (sidebar/topbar/command palette)
│   │   ├── components/
│   │   │   ├── ui/                     #   shadcn-generated primitives
│   │   │   ├── data-table/             #   shared DataTable<T> (sort/filter/paginate/keyboard nav)
│   │   │   ├── layout/                 #   Sidebar, Topbar, CommandPalette
│   │   │   └── status/                 #   ErrorState, skeletons, error-boundary fallback
│   │   ├── features/                #   one folder per page — see table below
│   │   ├── services/
│   │   │   ├── client.ts               #   fetch wrapper, typed ApiError
│   │   │   ├── endpoints/               #   one typed module per resource (real or mocked, same shape)
│   │   │   └── mock/
│   │   │       ├── handlers/               #   one MSW handler module per resource
│   │   │       ├── fixtures/               #   deterministic seed data (faker, fixed seed)
│   │   │       └── browser.ts              #   startMockWorker() — gated by shouldEnableMocks()
│   │   ├── hooks/                    #   useDebounce, useSearchToolbar, useMediaQuery, ...
│   │   └── types/                    #   shared cross-feature TypeScript types (mirrors API_CONTRACT.md)
│   ├── public/                    #   static assets, mockServiceWorker.js
│   └── dist/                      #   production build output (gitignored)
│
├── web/                          # Unrelated Next.js marketing/landing page — NOT part of the
│                                  # agent pipeline. Has its own AGENTS.md/CLAUDE.md. cd web && npm run dev
│
├── .github/
│   ├── workflows/                   #   frontend.yml (tsc/lint/build), backend.yml (ruff/pytest)
│   ├── ISSUE_TEMPLATE/              #   bug_report.md, feature_request.md, config.yml
│   └── PULL_REQUEST_TEMPLATE.md
│
├── docs/
│   ├── screenshots/                 #   empty by default — see README's Screenshots section
│   └── architecture/                #   empty by default — for standalone diagram images, if added
│
├── .claude/, .claude-plugin/     # Claude Code project configuration (agents, skills, hooks)
├── .env / .env.example           # backend environment variables (see DEPLOYMENT.md)
├── pyproject.toml / uv.lock      # backend dependencies (uv)
├── AGENTS.md                     # living project context, decisions, and status log — read first
├── CLAUDE.md                     # Claude Code-specific guidance, mirrors AGENTS.md + more detail
├── ENTERPRISE_ARCHITECTURE.md    # sequenced production-readiness roadmap (Phases 1-7)
└── Policy_Memory_Implementation_Plan.md   # Contribution 2 design doc
```

## Dashboard feature pages

| Folder | Page | Data source |
|---|---|---|
| `features/dashboard` | Dashboard (home) | Mocked |
| `features/conversations` | Conversations list + detail | Mocked |
| `features/live-execution` | Live Agent Execution (React Flow) | Mocked |
| `features/tickets` | New Ticket submission | **Real backend** |
| `features/memory-explorer` | Memory Explorer | Mocked |
| `features/tool-monitoring` | Tool Monitoring | Mocked |
| `features/analytics` | Analytics | Mocked |
| `features/experiments` | Experiment Dashboard | Mocked, but seeded from real `experiments/results/` |
| `features/clients` | Client Management | Mocked |
| `features/audit-logs` | Audit Logs | Mocked |
| `features/settings` | Settings | Mocked |
| `features/profile` | Profile | Mocked |
| `features/help` | Help Center | Mocked |
| `features/auth` | Login / session context | Mocked |

Each feature folder follows the same internal shape: `<name>-page.tsx`, `components/`, `hooks.ts`,
`api.ts`/`columns.tsx` where relevant.
