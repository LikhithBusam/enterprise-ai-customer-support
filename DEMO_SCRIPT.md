# Demo Script

A guided walkthrough of Support Console for an interview or live demo — a 5-minute core version,
a 10-minute extended version, and a set of common interview follow-up questions with answers.
Timings are targets, not hard stops — adjust for questions.

**Setup before you start:** `cd dashboard && npm run dev`, open `http://localhost:5173`. Mocks are
on by default in dev, so every page works immediately with realistic generated data — no backend
required except for the Ticket Submission step.

---

## 5-Minute Demo

### 0:00 – 0:30 · Login

Open `http://localhost:5173` — you'll land on the sign-in screen. Enter **any** email and any
value in the API key field (this build's login is intentionally unauthenticated against the mock
layer — say so explicitly rather than pretending it's real auth) and click **Sign in**.

> *Talking point:* "The whole dashboard runs against a documented mock service layer for every
> page except one — I'll show that one in a minute. This login screen is part of that mock
> layer; there's no real auth backend behind it yet."

### 0:30 – 1:15 · Dashboard

You land on the home Dashboard. Point out:
- The KPI grid — tickets today, resolution rate, escalation rate, memory hit rate, policy
  retrieval rate, tool success rate — a realistic operational snapshot.
- **Live activity** feed — click one of the five recent-activity rows to jump straight into a
  real conversation record (these links resolve to actual generated conversations, not
  placeholders — a bug that was caught and fixed during this project's own release-readiness
  pass, worth mentioning if asked about process).
- Toggle **light/dark** theme in the top bar to show both are fully designed, not an afterthought.

> *Talking point:* "This is the ops-manager view — health at a glance, with drill-down into
> anything that looks off."

### 1:15 – 2:00 · Ticket Submission (the one real backend call)

Navigate to **New ticket** (top-right button, or `Cmd/Ctrl+K` → "New Ticket"). Fill in a Customer
ID and a message (e.g. *"My order hasn't arrived and it's been two weeks"*), leave Intent on
Auto-detect, and submit.

- If the backend (`uv run uvicorn src.api.main:app --port 8000`) is running, this call goes to
  the **real FastAPI service** and returns a real pipeline result — show the resolved/escalated
  badge, tool calls made, and memory-hit indicator that come back.
- If the backend isn't running, submit anyway — show the friendly "Couldn't reach the backend"
  error message and note that this is a genuine network failure being handled gracefully, not a
  simulated one.

> *Talking point:* "Every other page in this app is mocked on purpose — documented in
> API_CONTRACT.md as the target for a real backend. This page is the one exception: it's wired to
> the actual multi-agent pipeline running underneath."

### 2:00 – 3:00 · Live Agent Execution (the flagship feature)

Open any conversation from Conversations or the Dashboard feed, then click **Live execution**.

- Point at the React Flow graph: Intake → Planner → Executor → Critic → Response → Memory Write,
  one node per agent step, colored by status (done/failed/retry).
- Click a node — the right-hand inspector updates with that step's input, output, duration, and
  retrieved memories.
- **Demonstrate keyboard access**: Tab to a node, press **Enter** or **Space** to select it, use
  **Arrow keys** to move between nodes — the inspector updates identically to a mouse click.
- Scroll to the execution timeline below the graph and the tool-call table for the same trace at
  a different level of detail.

> *Talking point:* "This is a real execution trace of the LangGraph pipeline — not a canned
> animation. If a ticket needed 3 replanning attempts, you see 3 loops back through Planner here,
> with each attempt's reasoning in the inspector."

### 3:00 – 3:45 · Memory Explorer

Navigate to **Memory Explorer**. Filter by memory type (Episodic / Plan-Success / Tool-Failure /
Escalation), search, and click an entry to open its inspector.

> *Talking point:* "This is the actual memory the agents read from before planning — the research
> question behind this whole project is whether this memory measurably improves resolution rate
> over a memoryless agent. It does, and I can walk through the numbers in the Experiment
> Dashboard."

### 3:45 – 4:15 · Analytics

Navigate to **Analytics**. Switch the date range (7D / 14D / 21D / All time) and point out the
KPI deltas and charts (conversation volume, resolution/escalation trend, latency, tool usage)
updating together.

> *Talking point:* "Standard ops analytics — but every number here, like everywhere else in the
> mocked pages, is generated from a fixed seed, so it's reproducible across demo runs."

### 4:15 – 5:00 · Experiment Dashboard (the research payoff)

Navigate to **Experiment Dashboard**. This is the one mocked page seeded from **real research
data** — this project's actual `experiments/results/*.jsonl` output, not fabricated numbers.

- Show the baseline comparison table/chart: memoryless vs. static ReAct vs. memory-augmented vs.
  Policy Memory across failure-rate tiers.
- Point out the headline result: memory-augmented resolves 96.5%/73.0%/48.0% of tickets across
  increasing failure-rate tiers, vs. 94.0%/42.0%/45.5% memoryless and 59.0%/51.0%/10.0% static
  ReAct — memory helps, clearly, at every tier.
- **Then lead with the actual research payoff**: Policy Memory looked even better than that at
  first (90.0% at the 0.3 tier) — but a *controlled ablation* against an architecturally identical
  baseline differing only in retrieval source found **no statistically significant difference at
  any failure rate**. Most of the original advantage traced back to template abstraction, not to
  policy-based retrieval. That's the honest, reported finding — not the more flattering original
  number.

> *Closing line:* "So the dashboard isn't just a UI shell — the numbers on this last page are the
> actual output of the research half of this repository, including the result that didn't hold up
> under a controlled ablation."

---

## 10-Minute Demo (Extended)

Run the full 5-minute script above, then add these five stops (roughly a minute each) before the
Experiment Dashboard closing section.

### +1 min · Data Tables — Conversations

Navigate to **Conversations**. Demonstrate the shared `DataTable` component that every list page
in the app reuses:
- Type in the search box — debounced, URL-synced (`?search=...` updates as you type).
- Click a column header (e.g. **Created**) — sort toggles, also URL-synced and deep-linkable.
- Use the **Status** or **Intent** filter facets.
- Tab to a row's open button, then **Arrow Down/Up** to move between rows — keyboard row
  navigation, not just mouse.

> *Talking point:* "One `DataTable<T>` component powers Conversations, Memory Explorer, Tool
> Monitoring, Client Management, and Audit Logs — filter/sort/pagination state all lives in the
> URL, so every view is bookmarkable and survives a refresh."

### +1 min · Tool Monitoring

Navigate to **Tool Monitoring**. Show the per-tool health cards (latency, success rate, circuit
breaker state) and the charts below them.

> *Talking point:* "This mirrors the LLM Provider Gateway's real circuit-breaker design in
> `src/core/llm_client.py` — open after 3 consecutive failures, half-open after a cooldown, rather
> than relying on retry/backoff alone."

### +1 min · Client Management

Navigate to **Client Management**. Select a client row and show the detail/config panel.

> *Talking point:* "Memory is isolated per client by design — one Chroma collection per
> `{client_id}_{suffix}`. This page is where that per-tenant boundary would be administered."

### +1 min · Settings — Edit / Save / Cancel / Reset

Navigate to **Settings**, click **Edit** on a section, change a field, and show **Save** and
**Reset** both becoming enabled (dirty-state gating), then click **Cancel** and confirm the
field reverts.

> *Talking point:* "Small detail, but worth pointing at: forms track dirty state properly — Save
> and Reset are disabled until something actually changes, and Cancel discards cleanly."

### +1 min · Error Recovery

Open DevTools, and either throttle the network to offline or let the interviewer know you're about
to force a failure. Reload a data-heavy page (e.g. Tool Monitoring) — show the `ErrorState`
component with a **Try again** button, then restore the network and click it to show recovery.

> *Talking point:* "Every data-fetching panel in this app has a real loading/error/retry state,
> not just a happy path — this was a specific, tracked item in the production-readiness pass
> before release."

---

## Common Interview Questions

**"Why did you build two separate implementations of the same pipeline?"**
So the research code stays free to run risky ablations (env-var feature flags, frozen baselines,
oracle-label experiments) without risking the correctness of a typed, tested production service —
and so production isn't blocked waiting on research to finish. See `ARCHITECTURE.md` §3.

**"What was the actual research finding?"**
Two, reported honestly rather than cherry-picked: (1) memory-augmented replanning clearly
outperforms memoryless and static-ReAct baselines at low-to-moderate failure rates but converges
with the memoryless baseline at the highest tier tested (0.7); (2) a follow-on contribution
(Policy Memory) initially looked like a further improvement, but a controlled ablation isolating
retrieval source as the only variable found no statistically significant difference from simpler
ticket-based memory at any failure rate — the original advantage was mostly attributable to a
different, shared architectural change (template abstraction), not to policy-based retrieval
itself.

**"How do you know the Critic isn't cheating?"**
The synthetic tool-failure injector tags every failure with a ground-truth `failure_type` for
scoring purposes — but that field is deliberately never exposed to the Critic, in either the
research or production code. The Critic only ever sees `success`/`data`/`error`, the same
observable signal a real tool integration would produce. This is enforced by convention and called
out explicitly in `CONTRIBUTING.md`'s Ground Rules.

**"Is any of this running against a real LLM, or is it all simulated?"**
Both — the research experiments (`scripts/run_experiment.py`) make real calls to NVIDIA NIM
(Llama 3.1 8B) by default; the dashboard's New Ticket page calls the real FastAPI backend, which
runs the real LangGraph pipeline end-to-end, also against real LLM providers if `PRODUCTION_USE_LLM`
is on. Every other dashboard page is intentionally mocked — documented in `dashboard/API_CONTRACT.md`
as the target for real endpoints that don't exist yet.

**"What would you do differently, or do next?"**
Per the paper's own future-work section: re-run the ablation with a larger sample size to detect a
smaller effect if one exists, do a mechanism-level comparison of retrieved plan quality (not just
outcome), and re-run all four baselines in one canonical environment — a disclosed
Python-version/OS mismatch between the original three baselines and the newer runs is a real,
flagged reproducibility gap, not swept under the rug.

**"How production-ready is this, really?"**
Through Phase 5 of the enterprise roadmap in good faith: real auth, per-client rate limiting,
idempotent submission, OpenTelemetry tracing, PII redaction, a scheduled retention job, and real
Stripe/Zendesk tool integrations behind a fail-closed adapter. Explicitly not done: multi-worker
support (the rate limiter and idempotency cache are single-process state today), containerization,
and wiring Policy Memory into production (intentionally gated on the ablation result above). See
`ENTERPRISE_ARCHITECTURE.md` for the full phased plan and what's deliberately deferred.

---

## If something goes wrong live

- **Blank page after `npm run dev`**: check the terminal for a port conflict; Vite defaults to
  `5173`.
- **New Ticket submission hangs/errors**: expected if the backend isn't running — narrate it as
  the real-network-failure path (see 1:15–2:00 above) rather than treating it as a demo failure.
- **A page looks empty on first load**: most pages show a brief skeleton before data resolves —
  wait a beat before assuming something broke.
