# Related Work

*(Citation caveat: bibliographic details below — authorship, title, year, general venue — reflect
well-established, widely-cited papers. Exact page numbers/DOIs/camera-ready venue names have not
been re-verified against a live bibliographic index from this environment; confirm formatting
details before submission. See `references.md`.)*

## Agentic Tool Use and Reasoning

**ReAct** (Yao et al., 2022) interleaves reasoning traces with tool-use actions in a single LLM
prompt loop, letting the model plan, act, and observe iteratively. Our `static_react` baseline is
a fixed version of this pattern — an unconditioned reasoning-then-acting loop with no memory —
included specifically to separate the effect of *dynamic replanning* from the effect of *memory*.

**ReWOO** (Xu et al., 2023) separates planning from execution to reduce redundant tool calls
under a fixed plan. Our pipeline's DAG-based planner/executor split (plan once as a set of
parallel-executable layers, then dispatch) is architecturally similar in spirit, though our
Critic/Replanner loop reintroduces iterative revision that ReWOO's single-pass design avoids.

**Toolformer** (Schick et al., 2023) trains a model to decide *when* to call a tool via
self-supervised API-call insertion. Our tool-use decisions are prompt-driven rather than trained,
but the underlying question — when does an agent need external information vs. its own
reasoning — is the same one our Intake/Planner split addresses heuristically.

## Memory-Augmented LLM Agents

**Generative Agents** (Park et al., 2023) store a stream of observations and retrieve/reflect
over them to drive believable long-horizon behavior — an episodic-memory design close to this
project's `EpisodicMemory` schema, though aimed at simulating believable behavior rather than
task completion under measurable failure conditions.

**MemGPT** (Packer et al., 2023) treats an LLM's context window as a memory hierarchy (main
context vs. external storage), paging information in and out as an operating system manages
virtual memory. Our `ChromaStore`-backed per-client memory types (Episodic, Tool-Failure,
Plan-Success, and now Policy) are a much simpler flat retrieval design by comparison, without an
explicit paging/eviction policy beyond time-based `prune()`.

**Reflexion** (Shinn et al., 2023) has an agent verbally reflect on failure and store that
reflection as episodic memory to inform the next attempt at the *same* task. Our
failure-category-conditioned Critic (predicting `timeout`/`ambiguous_data`/`wrong_result` from
observable symptoms and routing to a category-specific recovery strategy from `ToolFailureMemory`)
is a narrower, schema-constrained version of the same idea, applied across tickets rather than
within retries of one task.

**Voyager** (Wang et al., 2023) builds a growing *skill library* of reusable, composable code
functions that an embodied agent can retrieve and reuse across an open-ended sequence of tasks —
the closest prior work in spirit to Policy Memory's core idea: store *reusable procedures*, not
*specific past instances*. Voyager's skills are executable code retrieved by embedding similarity
over a growing library; our `PolicyMemory` entries are structural workflow templates
(tool-call-layer shapes plus a dependency graph) retrieved the same way, over a much narrower
action space (four fixed tools) and evaluated under controlled synthetic failure injection rather
than open-ended exploration.

## Positioning

The closest comparison to Policy Memory within this literature is Voyager's skill library: both
store reusable procedures abstracted away from any single episode's specifics, keyed for
retrieval-and-reuse rather than one-off replay. This paper's contribution relative to that line of
work is a **controlled, ablated comparison** — holding the surrounding agent architecture (Critic,
reliability scoring) fixed and varying only the memory type retrieved (policy-based vs.
ticket-based) — under a parameterized, repeatable failure-injection harness, rather than an
open-ended or qualitative evaluation setting.
