# Deployment

This project ships as two independently deployable pieces: a static frontend build
(`dashboard/`) and a standard ASGI Python service (`src/api/main:app`). CI (GitHub Actions) is
configured; a Dockerfile and platform config files (`vercel.json`, `render.yaml`) are not — the
Docker section below is what to add if you containerize the backend.

See also: [README.md](README.md) for local setup, [ARCHITECTURE.md](ARCHITECTURE.md) for how the
system fits together, and [CONTRIBUTING.md](CONTRIBUTING.md) for the checks CI runs on every PR.

---

## Development

For local development (not deployment), see [README.md](README.md#running):

```bash
cd dashboard && npm run dev                                       # frontend, http://localhost:5173
uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8000        # backend, http://localhost:8000
```

The frontend runs against a documented mock layer (MSW) by default in development, so it works
without the backend running — see [ARCHITECTURE.md §9](ARCHITECTURE.md#9-frontend).

---

## Production Build

### Frontend

```bash
cd dashboard
npm install
npm run build      # tsc -b && vite build -> dashboard/dist/
```

Serve `dashboard/dist/` as a static site (any static host — Vercel, Netlify, S3+CloudFront,
nginx). It's a client-side-routed SPA, so the host must rewrite all unmatched paths to
`index.html` (Vercel/Netlify do this automatically for a Vite app; nginx needs
`try_files $uri /index.html;`).

**Verify mocks are disabled before shipping — the most important pre-deploy check.** The dashboard
gates its mock service worker (MSW) by environment (`dashboard/src/main.tsx`):

```ts
function shouldEnableMocks(): boolean {
  const override = import.meta.env.VITE_ENABLE_MOCKS
  if (override === "true") return true
  if (override === "false") return false
  return import.meta.env.DEV   // on in dev, OFF in a production build, unless overridden
}
```

After `npm run build`, confirm the mock worker is never fetched at runtime:

```bash
npm run preview -- --port 4173
```

Open the preview build in a browser, open DevTools → Network, and reload. You should **not** see
`browser-*.js` (the MSW worker chunk) requested. If you intentionally want a demo deployment that
still uses mocked data (e.g. a staging preview with no backend), set `VITE_ENABLE_MOCKS=true` at
build time — otherwise leave it unset.

### Backend

There's no build step for the Python service beyond dependency install:

```bash
uv sync --no-dev
uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8000
```

For multiple workers, note the documented limitation in [ARCHITECTURE.md](ARCHITECTURE.md): the
rate limiter and idempotency cache are **in-process, single-worker state**. Running
`--workers > 1` (or multiple replicas behind a load balancer) without first moving those to a
shared store (Redis) means rate limits and idempotency are enforced per-worker, not globally —
acceptable for a demo/portfolio deployment, not for real production traffic. See
[Known Limitations](#known-limitations) below.

---

## Environment Variables

### Frontend

Set these as build-time env vars on your hosting platform (Vite inlines `VITE_*` vars at build
time — they are **public**, never put secrets here):

| Variable | Required | Default | Notes |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes, for the New Ticket page to work | — | Base URL of the deployed backend, e.g. `https://api.example.com` |
| `VITE_ENABLE_MOCKS` | No | `true` in dev, `false` in production builds | Explicit `"true"`/`"false"` overrides the dev/prod default |

### Backend

Copy `.env.example` to `.env` locally, or set these as platform secrets in production — **never**
commit real values (see [Security](#security) below):

| Variable | Required | Notes |
|---|---|---|
| `LLM_PROVIDER` | No | `nim` (default) or `gemini` |
| `NVIDIA_API_KEY` | Yes, if using NIM (default) | Free tier, ~40 req/min hard ceiling |
| `NVIDIA_BASE_URL` | No | Defaults to `https://integrate.api.nvidia.com/v1` |
| `PLANNER_MODEL`, `CRITIC_MODEL` | No | Defaults documented in `.env.example` |
| `OLLAMA_BASE_URL`, `INTAKE_MODEL` | Only if running Intake/Response against local Ollama | Not reachable from most PaaS hosts — see [Known Limitations](#known-limitations) |
| `GEMINI_API_KEY` | Only for offline evaluation scripts | Not used by the live API |
| `CHROMA_PERSIST_DIR` | Yes | Must point at a **persistent** volume in production — most PaaS filesystems are ephemeral by default |
| `API_KEYS` | Yes | `key1:client_a,key2:client_b` |
| `API_RATE_LIMIT_PER_MINUTE` | No | Default 60 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | Unset = telemetry stays a no-op |
| `STRIPE_API_KEY` | Only to enable the real CRM/order/refund backend | Unset = fails closed |
| `ZENDESK_SUBDOMAIN`, `ZENDESK_EMAIL`, `ZENDESK_API_TOKEN` | Only to enable the real KB-search backend | Unset = fails closed |

---

## GitHub Actions

Two workflows run in CI (`.github/workflows/`), each scoped to only run when its own part of the
repo changes:

| Workflow | Triggers on changes under | Steps |
|---|---|---|
| `frontend.yml` | `dashboard/` | Install Node 20 → `npm ci` → `npx tsc -b` → `npm run lint` → `npm run build` |
| `backend.yml` | `src/`, `experiments/`, `memory/`, `scripts/`, `tests/`, `pyproject.toml`, `uv.lock` | Install `uv` (`astral-sh/setup-uv`) → Python 3.11 → `uv sync` → `uv run ruff check .` → `uv run pytest` |

Both also support manual triggering (`workflow_dispatch`). Neither currently deploys anywhere —
they gate merges on the same checks listed in [CONTRIBUTING.md](CONTRIBUTING.md), not push to a
hosting platform. Wiring an actual deploy step (e.g. a Vercel/Render deploy hook) on merge to
`main` is a natural next step once this repo has a production environment to deploy to.

---

## Docker

No Dockerfile is included in the repository yet. A minimal one for the backend would look like:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN pip install uv
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen
COPY src/ ./src/
COPY data/ ./data/
CMD ["uv", "run", "uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

The frontend doesn't need a Dockerfile for most deployments (Vercel/Netlify build the static
output directly), but a simple static-file container (e.g. `nginx:alpine` serving `dashboard/dist/`
with the SPA rewrite rule from [Production Build](#production-build) above) works if you need to
containerize it too.

---

## Cloud Deployment

### Vercel (frontend)

1. Import the repo, set **Root Directory** to `dashboard`.
2. Build command: `npm run build`. Output directory: `dist`.
3. Add `VITE_API_BASE_URL` (and `VITE_ENABLE_MOCKS` if you want a mocked demo deployment) under
   Project Settings → Environment Variables.
4. Vercel handles SPA rewrites automatically for a Vite project — no extra `vercel.json` needed
   unless you add custom headers/redirects.

Vercel is **not** suitable for the backend (no Chroma persistent volume, no long-running Ollama
process) — use it for the frontend only.

### Render / Railway (backend)

1. New Web Service, root directory the repo root (not `dashboard/`).
2. Build command: `pip install uv && uv sync --no-dev` (or use the Dockerfile above).
3. Start command: `uv run uvicorn src.api.main:app --host 0.0.0.0 --port $PORT` (both platforms
   inject `$PORT`; adapt the command to read it, e.g. via a small `sh -c` wrapper).
4. Attach a **persistent disk** and point `CHROMA_PERSIST_DIR` at its mount path.
5. Set all backend environment variables above as service secrets.
6. Health check path: `GET /health`.

### Azure (backend, App Service)

1. Deploy as a **Linux Web App**, Python 3.11 runtime, or use the Dockerfile above with **Azure
   Container Apps** for more control over persistent storage and scaling.
2. Startup command: `uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8000`.
3. Use an **Azure Files** or managed-disk mount for `CHROMA_PERSIST_DIR` — App Service's local
   filesystem is not guaranteed persistent across restarts/scale events.
4. Set environment variables under Configuration → Application settings.

---

## Known Limitations

- **Single-worker backend.** The rate limiter and idempotency cache are in-process, single-worker
  state (see [ARCHITECTURE.md §5](ARCHITECTURE.md#5-component-responsibilities)). Multi-worker or
  multi-replica deployment needs a shared store (Redis token bucket / durable idempotency table)
  first — not yet built.
- **Ollama isn't portable to most PaaS hosts.** The Intake/Response agents default to a local
  Ollama instance. Most managed hosts (Render, Railway, Vercel Functions, Azure App Service) can't
  run Ollama alongside your app on the same free/starter tier. For a hosted deployment, either
  point `OLLAMA_BASE_URL` at a separately-hosted Ollama instance, or switch Intake/Response to a
  cloud provider — a configuration change in `src/core/llm_client.py`'s `default_role_providers()`,
  not a code rewrite.
- **Chroma needs a persistent volume.** `CHROMA_PERSIST_DIR` must resolve to storage that survives
  restarts and redeploys. On Render/Railway this means attaching a persistent disk; a bare
  container filesystem loses all memory on every deploy.
- **No CI deploy step yet.** The GitHub Actions workflows above run checks only; they do not
  deploy anywhere.
- **No E2E test suite.** CI runs type-check/lint/build (frontend) and ruff/pytest (backend), but
  there's no automated browser-level test of the deployed dashboard yet.

---

## Security

`.env.example` in this repository is a sanitized template — every field, including
`NVIDIA_API_KEY`, is a placeholder (`your_nvidia_api_key_here`), not a real key. This was verified
and fixed during an earlier documentation/security pass; if you fork this repository, double-check
`.env.example` still contains no real secrets before every commit that touches it, and never
commit `.env` itself (it's already gitignored).
