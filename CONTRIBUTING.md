# Contributing

Thanks for considering a contribution. This is primarily a research + portfolio project, but it's
built to real engineering standards and welcomes issues, discussion, and pull requests.

## Before you start

Read [AGENTS.md](AGENTS.md) first — it's the living source of truth for decisions already made
(tech stack choices, agent architecture, what's frozen vs. in progress) and will save you from
re-litigating something already settled. [ARCHITECTURE.md](ARCHITECTURE.md) explains the
research-track/production-track split; [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) is the
folder-by-folder map.

## Development setup

```bash
# Backend
uv sync
cp .env.example .env    # fill in your own keys

# Frontend
cd dashboard && npm install
```

## Testing

Run the full check before opening a PR — this is exactly what CI (`.github/workflows/`) runs on
every push and pull request, so a clean local run means a clean CI run:

```bash
uv run pytest                 # backend tests
uv run ruff check .           # backend lint
uv run ruff format .          # backend format

cd dashboard
npx tsc -b                    # frontend type-check
npm run lint                  # frontend lint (oxlint)
npm run build                 # frontend production build
```

`backend.yml` triggers on changes under `src/`, `experiments/`, `memory/`, `scripts/`, `tests/`,
or the lockfiles; `frontend.yml` triggers on changes under `dashboard/`. See
[DEPLOYMENT.md](DEPLOYMENT.md#github-actions) for the exact steps each workflow runs.

## Ground rules (non-negotiable, per AGENTS.md)

These aren't style preferences — they protect the validity of the research results and the
production system's safety properties:

- **Never let the Planner call tools directly.** Only Executor agents call tools.
- **Never skip the Critic/Replanner step**, even for "simple" tickets — its failure logging is
  load-bearing for the research metrics.
- **The Critic must never read `ToolResult.failure_type`** — only `success`/`data`/`error`.
  `failure_type` is oracle/eval-only metadata used to score the Critic's own diagnosis accuracy
  after the fact. Feeding it to the Critic invalidates the replanning research result.
- **`experiments/memory_augmented.py` (Contribution 1) is frozen.** Put new work in
  `memory_augmented_v2.py` or a new file — don't edit the frozen baseline.
- **No cross-client memory sharing** without explicit sign-off (compliance requirement). Memory
  is isolated per `client_id` by design.
- **No hardcoded prompts inline** — store versioned prompt files under `src/prompts/`.
- **Every inter-agent and API payload is a typed dataclass/pydantic model, never a raw string or
  dict.**

## Coding conventions

- **Backend**: one module per agent under `src/agents/` (or a new baseline file under
  `experiments/`), each a single typed `input -> output` function. Type hints throughout;
  `ruff` config is in `pyproject.toml` (line length 100, target Python 3.11).
- **Frontend**: strict TypeScript, no `any`. One folder per page/domain under
  `dashboard/src/features/`. New shared UI goes in `dashboard/src/components/`. If you add a new
  mocked endpoint, update both `dashboard/src/types/mocked.ts` and
  [`dashboard/API_CONTRACT.md`](dashboard/API_CONTRACT.md) — they're meant to stay in sync as the
  documented contract for a future real backend.
- **Tests are required** for: DAG validity, memory retrieval correctness, replanning trigger
  logic, and any new agent or API route. Mirror the existing `tests/test_<module>.py` naming.

## Commit messages

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

## Pull requests

Opening a PR loads [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md)
automatically — fill it in fully, including which track your change touches and which of the
Ground Rules checklist items apply. In addition:

1. Keep PRs scoped to one concern — a baseline change, a dashboard feature, a doc update. This
   codebase's own history shows what happens when scope creeps (see the sprint-gated history in
   `AGENTS.md`'s status log); reviewers can't reason about a PR that mixes research-track and
   production-track changes.
2. Run the full check list from [Testing](#testing) above before requesting review.
3. If your change touches `experiments/`, note which baseline(s) and failure-rate tier(s) you
   re-ran to confirm it, since results are the whole point of that half of the repo.
4. If your change touches `src/`, confirm `tests/test_pipeline_integration.py` still passes — it
   covers the full graph run (happy path, replan-then-resolve, escalate-after-exhaustion).
5. If your change touches `dashboard/`, confirm `npm run build` succeeds and, for anything
   interactive, do a quick manual pass (keyboard nav, light/dark) — there is no E2E suite yet.

## Reporting issues

Use the templates under [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/) — a bug report or
feature request form appears automatically when you open a new issue. Either way, please include:
which track (research/production/dashboard), reproduction steps, and — for research-track issues —
the exact `run_experiment.py` invocation (baseline + failure rate) if relevant. Never include real
API keys or `.env` contents in an issue.

## Security

If you find a real vulnerability (not a style nit), please open a private report rather than a
public issue where practical. Do not commit real secrets in `.env.example` or anywhere else — see
[DEPLOYMENT.md's Security section](DEPLOYMENT.md#security) for how this repo's own template is
kept sanitized.
