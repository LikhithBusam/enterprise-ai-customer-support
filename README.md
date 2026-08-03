# Adaptive Multi-Agent Customer Support System

A research system and production-track reference implementation for a **self-improving,
memory-augmented multi-agent customer support pipeline** — plus **Support Console**, a full
enterprise operations dashboard for monitoring and interacting with it.

The core research question: does **memory-augmented dynamic replanning** reduce ticket failure
rate and replanning overhead compared to memoryless and static-ReAct baselines — and does
*policy-based* memory (reusable workflow templates) generalize better than *ticket-based* memory
(replaying past examples)? The target output is a workshop paper plus a production-track client
system, and this repository contains both.

> **Status:** Research track is experiment-complete for Contribution 1 (memory-augmented vs.
> memoryless vs. static-ReAct) with paper-citable results; Contribution 2 (Policy Memory) is
> implemented and instrumented but not yet fully evaluated. The production track (`src/`) is
> fully implemented through Phase 5 of the enterprise roadmap. See [Roadmap](#roadmap).

---

## Overview

This project has three parts that share code but serve different purposes:

1. **Research harness** (`experiments/`) — runs controlled comparisons between baseline agent
   architectures (memoryless, static ReAct, memory-augmented, policy-memory) against a synthetic
   ticket dataset with injectable tool failures, and produces the metrics behind the paper.
2. **Production pipeline** (`src/`) — a LangGraph-orchestrated port of the best-performing
   research baseline into a real, typed, testable service: FastAPI HTTP layer, per-client auth
   and rate limiting, OpenTelemetry tracing, pluggable real tool backends (Stripe, Zendesk), PII
   redaction, and a scheduled memory-retention job.
3. **Support Console** (`dashboard/`) — a 15-page enterprise operations dashboard (React + Vite)
   for support ops teams and researchers: live ticket submission against the real backend, a
   React Flow visualization of an agent's execution trace, memory/tool/analytics explorers, and
   an experiment-comparison view grounded in this repository's own research results.

The two tracks intentionally **do not share runtime code** — `src/` is a from-scratch, typed port
of validated research logic, not an import of `experiments/`. See [ARCHITECTURE.md](ARCHITECTURE.md)
for the full rationale and data flow.

---

## Architecture

```mermaid
flowchart LR
    subgraph Research["Research Track — experiments/"]
        direction TB
        RB["Baselines\nmemoryless / static_react /\nmemory_augmented / policy_memory"]
        RH["run_experiment.py"]
        RD["Synthetic tickets\n(200, 6 intent clusters)"]
        RD --> RH --> RB
        RB --> RR["experiments/results/*.jsonl"]
    end

    subgraph Production["Production Track — src/"]
        direction TB
        API["FastAPI\nPOST /v1/tickets"]
        GRAPH["LangGraph pipeline\nIntake → Planner → Executor →\nCritic → Response → Escalation"]
        API --> GRAPH
        GRAPH --> MEM[("Memory\nChroma, per-client")]
        GRAPH --> TOOLS["Tool Adapter\nSimulated / Stripe / Zendesk"]
    end

    UI["Support Console\ndashboard/ (React)"] -->|"POST /v1/tickets\nGET /health"| API
    UI -.->|"mocked (MSW)\nother 14 pages"| UI
```

Full breakdown (agent roles, memory schema, LangGraph wiring, research-vs-production divergence)
lives in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Features

### Multi-agent pipeline
- **7 typed agents**: Intake, Planner, Executor, Critic/Replanner, Memory Manager, Response,
  Escalation — each a single `run(TypedInput) -> TypedOutput` function, never raw strings between
  agents.
- **Memory-augmented replanning**: Episodic, Tool-Failure, Plan-Success, Escalation, and (research
  track) Policy memory, isolated per client in Chroma.
- **LLM provider gateway** with per-role ordered fallback chains, a proactive sliding-window rate
  limiter, and a circuit breaker — not just reactive retry/backoff.
- **Pluggable tools**: simulated handlers for research/demo use, or real Stripe (CRM/orders/refunds)
  and Zendesk Guide (KB search) backends behind the same interface.

### Support Console dashboard
- Dashboard, Conversations, Conversation Detail, **Live Agent Execution** (React Flow graph of an
  actual LangGraph run), Memory Explorer, Tool Monitoring, Analytics, Experiment Dashboard (real
  research results), Client Management, Settings, Audit Logs, Profile, Help Center, and a
  production **Ticket Submission** page wired to the real `POST /v1/tickets` endpoint.
- Full keyboard accessibility (skip links, focus-trapped dialogs, arrow-key graph/table
  navigation), light/dark themes, and responsive layouts from 390px to 1920px.
- Every other page is served by a documented, swappable mock layer (MSW) — see
  [`dashboard/API_CONTRACT.md`](dashboard/API_CONTRACT.md) — so the UI ships at full fidelity
  ahead of backend endpoints that don't exist yet, with zero fabricated experiment numbers (the
  Experiment Dashboard reads this repo's actual `experiments/results/`).

---

## Screenshots

> _Add screenshots to a `docs/screenshots/` directory and update the paths below._

| Dashboard | Live Agent Execution |
|---|---|
| `docs/screenshots/dashboard.png` | `docs/screenshots/live-execution.png` |

| Memory Explorer | Analytics |
|---|---|
| `docs/screenshots/memory-explorer.png` | `docs/screenshots/analytics.png` |

| Experiment Dashboard | Ticket Submission |
|---|---|
| `docs/screenshots/experiments.png` | `docs/screenshots/new-ticket.png` |

---

## Tech Stack

**Backend / Research**
- Python 3.11+, [uv](https://github.com/astral-sh/uv) package manager
- [LangGraph](https://github.com/langchain-ai/langgraph) — production agent orchestration
- [FastAPI](https://fastapi.tiangolo.com/) + Uvicorn — HTTP API
- [ChromaDB](https://www.trychroma.com/) — per-client vector memory store
- [Pydantic v2](https://docs.pydantic.dev/) — every inter-agent and API payload
- LLM providers: NVIDIA NIM (Llama 3.1 8B, planner/critic), local Ollama (Qwen2.5 3B,
  intake/response), Gemini Flash (offline LLM-as-judge only)
- OpenTelemetry (tracing/metrics), Stripe + Zendesk SDKs (real tool backends)
- pytest, ruff

**Frontend**
- React 18 + TypeScript (strict) + Vite + Tailwind CSS v4
- shadcn/ui (Radix primitives), TanStack Query + TanStack Table, React Hook Form + Zod
- React Router v7, Recharts, [@xyflow/react](https://reactflow.dev/) (React Flow)
- MSW (Mock Service Worker) for the documented mock service layer

---

## Installation

### Prerequisites
- Python 3.11+ and [uv](https://github.com/astral-sh/uv)
- Node.js 20+ and npm
- (Optional, for local intake/response LLM calls) [Ollama](https://ollama.com/) running
  `qwen2.5:3b-instruct`

### Clone

```bash
git clone https://github.com/LikhithBusam/enterprise-ai-customer-support.git
cd enterprise-ai-customer-support
```

### Backend

```bash
uv sync                 # installs runtime + dev dependencies (pytest, ruff)
cp .env.example .env    # fill in your own keys — see Environment Variables below
uv run pytest           # optional: verify the install
```

### Frontend

```bash
cd dashboard
npm install
```

---

## Running

### Frontend (Support Console)

```bash
cd dashboard
npm run dev
```

Opens at **http://localhost:5173**. By default the mock service layer (MSW) is active in dev, so
every page works immediately with realistic generated data — no backend required. The one
exception is the **New Ticket** page, which calls the real backend below.

### Backend (production API)

```bash
uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8000
```

Runs at **http://localhost:8000** (`GET /health`, `POST /v1/tickets`). Point the dashboard's
`VITE_API_BASE_URL` at this address to submit real tickets through the New Ticket page.

### Research experiments

```bash
uv run python -m scripts.run_experiment --limit 20                 # quick smoke test
uv run python -m scripts.run_experiment                            # full run, all baselines × failure rates
uv run python -m scripts.compute_summary                           # resolution-rate / memory-hit summary
uv run python -m scripts.analyze_policy_memory                     # Contribution 2 metrics
```

`scripts/run_experiment.py` makes real LLM calls by default and is rate-limited — always pass
`--limit` while iterating.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your own values. **Never commit real keys.**

| Variable | Used by | Notes |
|---|---|---|
| `LLM_PROVIDER` | research + production | `nim` (default) or `gemini` |
| `NVIDIA_API_KEY`, `NVIDIA_BASE_URL` | Planner/Critic (NIM) | free tier, ~40 req/min hard ceiling |
| `PLANNER_MODEL`, `CRITIC_MODEL` | Planner/Critic | e.g. `meta/llama-3.1-8b-instruct` |
| `OLLAMA_BASE_URL`, `INTAKE_MODEL` | Intake/Response (local) | e.g. `qwen2.5:3b-instruct` |
| `GEMINI_API_KEY` | offline LLM-as-judge only | 20 req/day free-tier cap — not used live |
| `CHROMA_PERSIST_DIR` | memory layer | local Chroma persistence path |
| `API_KEYS` | production API | `key1:client_a,key2:client_b` — `X-API-Key` → `client_id` map |
| `API_RATE_LIMIT_PER_MINUTE` | production API | per-client inbound limit, default 60 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | telemetry | unset = spans/metrics are true no-ops |
| `STRIPE_API_KEY` | real CRM/order/refund backend | unset = that backend fails closed |
| `ZENDESK_SUBDOMAIN`, `ZENDESK_EMAIL`, `ZENDESK_API_TOKEN` | real KB-search backend | unset = fails closed |

Dashboard-side variables (`dashboard/.env`, not committed): `VITE_API_BASE_URL`,
`VITE_ENABLE_MOCKS` (defaults to on in dev, **off in production builds** — see
[DEPLOYMENT.md](DEPLOYMENT.md)).

---

## Deployment

Short version: the dashboard is a static Vite build (deploy to Vercel/Netlify/any static host)
and the backend is a standard ASGI app (deploy to Render/Railway/Azure App Service, or any
container host, behind `uvicorn`/`gunicorn`). Full step-by-step instructions, environment variable
matrices per platform, and production-build verification steps are in
**[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## Folder Structure

```
customer_support/
├── src/                    # Production track — LangGraph pipeline, FastAPI, typed agents
├── experiments/            # Research track — baselines, experiment driver, ablations
├── memory/                 # Policy Memory (Contribution 2) — research-track only
├── data/                   # Synthetic ticket dataset
├── scripts/                # Experiment runner, summary/analysis, dataset builder
├── tests/                  # pytest suite (per-agent, API, memory, DAG, telemetry, ...)
├── dashboard/               # Support Console — React + Vite frontend
│   ├── src/
│   │   ├── app/            # Router, providers, client context
│   │   ├── components/     # Shared UI (shadcn primitives, data-table, layout)
│   │   ├── features/       # One folder per page/domain
│   │   ├── services/       # Real + mocked API clients (the mock/real swap boundary)
│   │   └── types/          # Shared cross-feature TypeScript types
│   └── API_CONTRACT.md     # Documented contract for every mocked endpoint
├── paper/                   # Workshop paper drafts/assets
├── web/                     # Unrelated Next.js marketing site (not part of the pipeline)
├── AGENTS.md / CLAUDE.md    # Full project context, decisions, and status log
└── ENTERPRISE_ARCHITECTURE.md  # Sequenced production-readiness roadmap
```

Full annotated structure: **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)**.

---

## Roadmap

- [ ] Re-run chi-square significance test on the corrected research dataset before citing in the paper
- [ ] Complete Contribution 2 (Policy Memory) full 200-ticket evaluation across all failure-rate tiers
- [ ] Add a LangGraph-based ReAct baseline as a reviewer-facing control (partial implementation exists)
- [ ] Escalation Agent human-feedback loop (writes to Escalation Memory — not wired up yet)
- [ ] Wire Policy Memory into the production pipeline (`ENTERPRISE_ARCHITECTURE.md` Phase 6)
- [ ] Scale-out: containerize each agent as an independent service; swap Chroma → Qdrant at >1M vectors (Phase 7)
- [ ] Move off free-tier NVIDIA NIM (40 req/min ceiling) to a paid/dedicated inference endpoint

See [AGENTS.md](AGENTS.md) for the full, detailed status log this summary is drawn from.

---

## Documentation

| Document | Covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Full technical design — frontend, backend, memory, LangGraph, both tracks |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production build, environment variables, Vercel, Render/Railway/Azure |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Dev setup, ground rules, coding conventions, PR process |
| [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | Annotated folder-by-folder map |
| [PORTFOLIO_SUMMARY.md](PORTFOLIO_SUMMARY.md) | One-page summary for interviews/resume discussions |
| [DEMO_SCRIPT.md](DEMO_SCRIPT.md) | 5-minute guided walkthrough of the dashboard |
| [dashboard/API_CONTRACT.md](dashboard/API_CONTRACT.md) | Every mocked endpoint's documented request/response shape |
| [AGENTS.md](AGENTS.md) | Living project context and detailed status log |
| [ENTERPRISE_ARCHITECTURE.md](ENTERPRISE_ARCHITECTURE.md) | Sequenced production-readiness roadmap |

## License

Released under the [MIT License](LICENSE).
