# Paper Outline

**Working title:** Policy Memory: An Ablation Study of Reusable Workflow Templates in
Memory-Augmented Agentic Customer Support

*(Revised from an earlier working title — "...for Generalizable Memory-Augmented..." — which
presupposed the RQ2 finding the controlled ablation did not support. See the Research Questions
note below.)*

**Target format:** Workshop paper (agentic AI / LLM tool-use track), 4–8 pages.

## Section Map

| # | Section | File | Core content |
|---|---|---|---|
| 1 | Abstract | `abstract.md` | Summary of question, method, the confounded-vs-controlled comparison, and the ablation's null result |
| 2 | Introduction | `introduction.md` | Motivation, research questions (RQ1/RQ2), contributions list |
| 3 | Related Work | `related_work.md` | Agentic tool-use, memory-augmented LLM agents, replanning/self-correction |
| 4 | Methodology | `methodology.md` | 4-arm design, dataset, failure injection, metrics, Context Fusion, Policy Memory write/retrieve semantics, the v2_full ablation design |
| 5 | Architecture | `architecture.md` | 7 Mermaid diagrams: system, LangGraph pipeline, memory architecture, Policy Memory workflow, Context Fusion, Planner workflow, evaluation pipeline |
| 6 | Implementation | `implementation.md` | Codebase structure, research vs. production track split, key modules |
| 7 | Experiments | `experiments.md` | Experimental protocol, conditions, tooling, reproducibility pointers |
| 8 | Results | `results.md` | Tables 1–7 (vs. memory_augmented) + Tables 8–11 (the v2_full ablation, with 95% CIs) |
| 9 | Discussion | `discussion.md` | What the ablation shows, why the original attribution didn't hold up, revised FR=0.7 account, strengths/weaknesses |
| 10 | Limitations | `limitations.md` | Threats to validity (internal/construct/external/statistical), non-significance ≠ equivalence |
| 11 | Future Work | `future_work.md` | Repeated-seed trials, mechanism-level plan comparison, isolating the FR=0.7 v2-vs-v1 side finding |
| 12 | Conclusion | `conclusion.md` | Restate contributions and the honest null-result takeaway |
| 13 | References | `references.md` | Related-work citations (see caveat below) |
| — | Reproducibility | `reproducibility.md` | Hardware/software/model/seed/command inventory |
| — | Final manuscript | `final_paper.md` | All sections combined into one document |

## Research Questions

- **RQ1 (Contribution 1, motivating result):** Does memory-augmented dynamic replanning reduce
  ticket failure rate and replanning overhead relative to memoryless and static-ReAct baselines?
- **RQ2 (Contribution 2, core claim):** Does policy-based memory (reusable, ticket-agnostic
  workflow templates) generalize better than ticket-based memory (replaying parameterized past
  examples), and does that advantage hold uniformly across failure conditions?

  **Answer, as measured:** Against `memory_augmented` (an architecturally simpler baseline), yes,
  significantly, at FR=0.3. Against `v2_full` (the architecturally matched control that isolates
  retrieval source as the only variable), **no significant difference was found at any failure
  rate**, with point estimates at two of three conditions favoring ticket-based retrieval. The
  honest answer to RQ2, as this evaluation currently stands, is: **not supported** once the
  comparison is properly controlled — see `results.md` Tables 8–11 and `discussion.md`.

## Citation caveat

`references.md` cites well-known, real papers from memory (ReAct, Reflexion, Generative Agents,
MemGPT, Voyager, Toolformer, ReWOO). I'm confident these papers exist and broadly what they
contain, but I have **not** verified exact venue/page/DOI metadata against a live bibliographic
database from this sandbox (no network access to a citation index). Treat `references.md` as
correct on authorship/title/year/general venue, and re-verify precise formatting details before
camera-ready submission.
