# Demo Script (5 minutes)

A guided walkthrough of Support Console for an interview or live demo. Timings are targets, not
hard stops — adjust for questions.

**Setup before you start:** `cd dashboard && npm run dev`, open `http://localhost:5173`. Mocks are
on by default in dev, so every page works immediately with realistic generated data — no backend
required except for the Ticket Submission step.

---

## 0:00 – 0:30 · Login

Open `http://localhost:5173` — you'll land on the sign-in screen. Enter **any** email and any
value in the API key field (this build's login is intentionally unauthenticated against the mock
layer — say so explicitly rather than pretending it's real auth) and click **Sign in**.

> *Talking point:* "The whole dashboard runs against a documented mock service layer for every
> page except one — I'll show that one in a minute. This login screen is part of that mock
> layer; there's no real auth backend behind it yet."

---

## 0:30 – 1:15 · Dashboard

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

---

## 1:15 – 2:00 · Ticket Submission (the one real backend call)

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

---

## 2:00 – 3:00 · Live Agent Execution (the flagship feature)

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

---

## 3:00 – 3:45 · Memory Explorer

Navigate to **Memory Explorer**. Filter by memory type (Episodic / Plan-Success / Tool-Failure /
Escalation), search, and click an entry to open its inspector.

> *Talking point:* "This is the actual memory the agents read from before planning — the research
> question behind this whole project is whether this memory measurably improves resolution rate
> over a memoryless agent. It does, and I can walk through the numbers in the Experiment
> Dashboard."

---

## 3:45 – 4:15 · Analytics

Navigate to **Analytics**. Switch the date range (7D / 14D / 21D / All time) and point out the
KPI deltas and charts (conversation volume, resolution/escalation trend, latency, tool usage)
updating together.

> *Talking point:* "Standard ops analytics — but every number here, like everywhere else in the
> mocked pages, is generated from a fixed seed, so it's reproducible across demo runs."

---

## 4:15 – 5:00 · Experiment Dashboard (the research payoff)

Navigate to **Experiment Dashboard**. This is the one mocked page seeded from **real research
data** — this project's actual `experiments/results/*.jsonl` output, not fabricated numbers.

- Show the baseline comparison table/chart: memoryless vs. static ReAct vs. memory-augmented
  (and Policy Memory, if that run is included) across failure-rate tiers.
- Point out the headline result: memory-augmented resolves 97%/84%/48% of tickets across
  increasing failure-rate tiers, vs. 94%/42%/46% memoryless and 59%/51%/10% static ReAct.
- If time allows, mention the honest boundary condition: memory-augmented converges with
  memoryless at the highest failure rate, and the learning curve didn't show gradual
  improvement — which is exactly what motivated the Policy Memory follow-on work.

> *Closing line:* "So the dashboard isn't just a UI shell — the numbers on this last page are the
> actual output of the research half of this repository."

---

## If something goes wrong live

- **Blank page after `npm run dev`**: check the terminal for a port conflict; Vite defaults to
  `5173`.
- **New Ticket submission hangs/errors**: expected if the backend isn't running — narrate it as
  the real-network-failure path (see 1:15–2:00 above) rather than treating it as a demo failure.
- **A page looks empty on first load**: most pages show a brief skeleton before data resolves —
  wait a beat before assuming something broke.
