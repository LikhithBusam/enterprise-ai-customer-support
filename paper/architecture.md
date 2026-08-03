# Architecture

This system has **two parallel tracks that are not conflated**: `experiments/` (the research
harness that produced every result in this paper) and `src/` (a production LangGraph pipeline).
**All experiments reported in this paper ran through the research-track harness
(`experiments/memory_augmented_v2.py`'s iterative Python loop), not through the LangGraph graph
described below** — Policy Memory is not wired into production yet (see `future_work.md`). The
production architecture is included here for completeness, since it is the intended eventual home
for this contribution, not because it was used to generate any reported number.

## 1. Overall System Architecture

```mermaid
flowchart TB
    subgraph Agents["7-Agent Pipeline (conceptual, both tracks)"]
        direction LR
        Intake[Intake Agent] --> Planner[Planner Agent]
        Planner --> Executor[Executor Agent]
        Executor --> Critic[Critic / Replanner Agent]
        Critic -- unresolved, replan --> Planner
        Critic -- resolved / exhausted --> Response[Response Agent]
        Response --> Escalation[Escalation Agent]
    end
    MM[Memory Manager] <-.-> Planner
    MM <-.-> Critic
    MM <-.-> Escalation

    subgraph Research["Research Track (experiments/) — used for this paper"]
        RH[memory_augmented_v2.py loop] --> RTools[Simulated Tool Registry\nwith synthetic failure injection]
        RH --> RMem[(Chroma-backed memory stores)]
    end

    subgraph Prod["Production Track (src/) — not used for this paper"]
        LG[LangGraph StateGraph] --> PTools[ToolAdapter\nSimulated or Real backends]
        LG --> PMem[(Chroma-backed memory stores,\nshared schema with research track)]
    end

    Agents -.conceptual role mapping.-> Research
    Agents -.conceptual role mapping.-> Prod
```

## 2. Production LangGraph Pipeline (`src/graph/pipeline.py`)

```mermaid
stateDiagram-v2
    [*] --> Intake
    Intake --> Planner
    Planner --> Executor
    Executor --> Critic
    Critic --> Planner: unresolved, iteration < MAX_ITERATIONS
    Critic --> Response: resolved OR iteration == MAX_ITERATIONS
    Response --> Escalation: unresolved
    Response --> WriteMemory: resolved
    Escalation --> WriteMemory
    WriteMemory --> [*]
```

*Not used to generate this paper's results — shown for architectural completeness. Policy Memory's
production integration point (Phase 6 of `ENTERPRISE_ARCHITECTURE.md`) is the Planner node's
memory-retrieval call.*

## 3. Memory Architecture

```mermaid
flowchart LR
    subgraph Stores["Per-client Chroma-backed stores"]
        Epi[(EpisodicMemory\nticket_id, intent, plan_dag, outcome)]
        Fail[(ToolFailureMemory\ntool_name, failure_type, context, fix_applied)]
        Plan[(PlanSuccessMemory\nintent_cluster, dag_template,\nparameterized_message)]
        Esc[(EscalationMemory\nticket_id, human_correction,\noriginal_response)]
        Pol[(PolicyMemory — NEW\npolicy_id, intent_cluster,\nworkflow_template, dependency_graph,\nusage_count, confidence)]
    end
    Epi & Fail & Plan & Esc -->|append-only, fresh UUID per write| ChromaStoreWrite[ChromaStore.write]
    Pol -->|upsert by deterministic policy_id| PolicyStoreWrite[policy_store.upsert_policy]
    ChromaStoreWrite --> ChromaClient[(Shared chromadb.PersistentClient)]
    PolicyStoreWrite --> ChromaClient
```

Every store shares one Chroma client and the `{client_id}_{suffix}` per-client collection
convention. `PolicyMemory` is the only type stored via direct ChromaDB `upsert` rather than
`ChromaStore.write()`, because its identity (`policy_id`) is deterministic and reinforcement
requires updating an existing record rather than always appending a new one.

## 4. Policy Memory Workflow (write path)

```mermaid
flowchart TD
    Resolved([Ticket resolved]) --> Extract[Extract workflow_template\nfrom resolved DAG\n— tool names only, no ticket-specific values]
    Extract --> Dep[Build dependency_graph\nfrom tools present in workflow]
    Dep --> Hash[Compute deterministic policy_id\n= SHA256 intent_cluster + workflow_template]
    Hash --> Lookup{Existing policy\nwith this id?}
    Lookup -- yes --> Reinforce[usage_count += 1\nrunning-average tool_calls/replans\nconfidence += 0.05, capped 1.0\ncreated_from += ticket_id]
    Lookup -- no --> Create[usage_count = 1\nconfidence = 0.5\ncreated_from = [ticket_id]]
    Reinforce --> Upsert[collection.upsert by policy_id]
    Create --> Upsert
```

## 5. Research Evaluation Pipeline

```mermaid
flowchart LR
    DS[(data/synthetic_tickets_v2.jsonl\n200 tickets, 6 intent clusters)] --> Run[scripts/run_experiment.py]
    Run --> M[memoryless]
    Run --> S[static_react]
    Run --> MA[memory_augmented]
    Run --> PM[policy_memory]
    M & S & MA & PM --> JSONL[(experiments/results/*.jsonl\nper-ticket records)]
    JSONL --> APM[scripts/analyze_policy_memory.py\ncore + policy metrics]
    JSONL --> AR[scripts/analyze_results.py\nchi-square significance]
    APM & AR --> PMV[scripts/policy_memory_validation.py]
    PMV --> Tables[Markdown tables]
    PMV --> Figures[PNG figures]
    Tables & Figures --> Paper[This paper]
```

*(See `methodology.md` for the Context Fusion and Planner Workflow diagrams — the two remaining
requested diagrams, placed there since they are discussed inline with the methodology text they
illustrate.)*
