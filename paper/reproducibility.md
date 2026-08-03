# Reproducibility

## Important Disclosure: Two Different Execution Environments

The four arms' result files reported in this paper were **not all produced on the same
environment**, and this is disclosed here rather than glossed over:

- `memoryless`, `static_react`, `memory_augmented` (all three failure rates): produced in an
  earlier phase of this project on the canonical development environment described below
  (WSL, per `AGENTS.md`), using the project's `uv`-managed virtual environment.
- `policy_memory` (all three failure rates): produced in **this** evaluation session, on a
  Windows sandbox with no `uv` or WSL distribution available. Dependencies were installed
  directly into a system Python 3.10.9 interpreter rather than the project's pinned
  Python 3.11+ `uv`-managed environment, specifically to be able to execute
  `scripts/run_experiment.py` and the test suite at all in that sandbox.

This is a genuine environment mismatch (Python 3.10.9 vs. the project's required `>=3.11`, and a
different OS/filesystem) between the historical three arms and the newly-run fourth arm. It does
not affect the LLM provider or model used (both environments called the same NVIDIA NIM API with
the same model), but it is a reproducibility caveat that should be resolved — by re-running all
four arms in one canonical environment — before treating this paper's numbers as final.

## Hardware

- **Historical runs** (`memoryless`, `static_react`, `memory_augmented`): WSL on a local
  development machine, ~8GB total RAM (per `AGENTS.md`'s documented hardware constraint — the
  reason local 7B-class models were ruled out in favor of NVIDIA NIM for Planner/Critic).
- **This session's run** (`policy_memory`): Windows 11, no GPU involved (all inference is via the
  remote NVIDIA NIM API, not local).

## Software

| Component | Version / value |
|---|---|
| Python (project-pinned, `pyproject.toml`) | `>=3.11` |
| Python (actually used for `policy_memory` runs, this session) | 3.10.9 (system interpreter — see disclosure above) |
| Package manager (project-pinned) | `uv` |
| Key dependencies (`pyproject.toml`) | `langgraph>=0.4`, `chromadb>=0.6`, `pydantic>=2`, `httpx>=0.28`, `openai>=2.45.0`, `python-dotenv>=1.2.2`, `scipy>=1.17.1`, `langchain-openai>=1.3.5`, `fastapi>=0.115`, `uvicorn>=0.30`, `opentelemetry-api>=1.20`, `opentelemetry-sdk>=1.20`, `stripe>=11.0` |
| Dev dependencies | `pytest>=8`, `pytest-asyncio`, `ruff>=0.9` |
| Analysis/plotting (this paper's tooling, not a project dependency) | `matplotlib`, `numpy` — used only by `scripts/policy_memory_validation.py` |

## Models

| Role | Provider | Model | Temperature |
|---|---|---|---|
| Planner | NVIDIA NIM | `meta/llama-3.1-8b-instruct` | 0.0 |
| Critic / Replanner | NVIDIA NIM | `meta/llama-3.1-8b-instruct` | 0.0 |
| Intake / Response (production track only — not used in these experiments) | Local Ollama | `qwen2.5:3b-instruct` | n/a |
| LLM-as-judge (offline eval only — not used in these experiments) | Gemini | `gemini-2.5-flash` | n/a |

NVIDIA NIM's free tier is rate-limited to ~40 requests/minute; the experiment harness proactively
throttles to 35 requests/60s via a sliding-window limiter (`_SlidingWindowRateLimiter` in
`experiments/memory_augmented_v2.py`) rather than relying on reactive retry/backoff.

## Random Seeds

- `ToolRegistry(failure_rate, seed=42)` — reconstructed fresh per ticket, per arm, per condition.
  Deterministic synthetic tool-failure injection given ticket processing order.
- LLM sampling: `temperature=0.0` for all Planner/Critic calls (deterministic in intent, though
  NIM's API is not contractually guaranteed bit-identical across calls).
- No additional seeding is applied to Python's `random` module beyond what `ToolRegistry`
  constructs internally.

## Dataset

- `data/synthetic_tickets_v2.jsonl` — 200 tickets, 6 intent clusters, 90% standard phrasing / 10%
  stress-test edge cases (5 each of ambiguous, contradictory, missing_entity, multi_intent). See
  `methodology.md` for the full per-cluster breakdown. Regeneration command:
  `uv run python -m scripts.build_synthetic_data`.

## Configuration (environment variables)

| Variable | Value used | Purpose |
|---|---|---|
| `BASELINE_USE_LLM` | `1` | Forces real LLM calls (force-set by `scripts/run_experiment.py`) |
| `ENABLE_CONDITIONED_CRITIC` | `1` | Failure-category-conditioned Critic (both `memory_augmented`'s v2 lineage and `policy_memory`) |
| `ENABLE_TEMPLATE_ABSTRACTION` | `1` | Ticket-text abstraction before `PlanSuccessMemory`/Policy query |
| `ENABLE_RELIABILITY_SCORING` | `1` | Tool-reliability scores injected into Planner prompt |
| `ENABLE_POLICY_MEMORY` | `1` for `policy_memory` arm; `0` (default) otherwise | Switches Planner retrieval from `PlanSuccessMemory`-only to Context Fusion |
| `LLM_PROVIDER` | `nim` | Selects NVIDIA NIM over Gemini |
| `NIM_RPM` | `35` | Sliding-window rate limiter ceiling |

## Commands

```bash
# Historical arms (already-validated result files, reused as-is for this paper)
uv run python -m scripts.run_experiment --baseline memoryless
uv run python -m scripts.run_experiment --baseline static_react
uv run python -m scripts.run_experiment --baseline memory_augmented

# Policy Memory arm (run for this paper)
uv run python -m scripts.run_experiment --baseline policy_memory \
  --failure-rate 0.0 --failure-rate 0.3 --failure-rate 0.7 \
  --dataset data/synthetic_tickets_v2.jsonl

# Analysis and paper artifacts
uv run python -m scripts.analyze_policy_memory
uv run python -m scripts.policy_memory_validation
```

## Experiment Order

Within `scripts.run_experiment`'s `policy_memory` invocation above, failure rates are processed
sequentially in the order given (0.0, then 0.3, then 0.7); Chroma memory collections are reset at
the start of each failure-rate tier and accumulate across that tier's 200 tickets, in dataset
order. See `experiments.md` for the mid-run pause/resume that occurred for the FR=0.3 tier during
this session, and why it did not require re-running from scratch.
