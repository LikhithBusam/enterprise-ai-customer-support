# Implementation Plan — Policy Memory (Contribution 2)

## Status
Contribution 1 (Failure-Category-Conditioned Critic) is frozen and must not be modified.

Research-track implementation of this plan is done (see [AGENTS.md](AGENTS.md)'s Current Status
checklist and [CLAUDE.md](CLAUDE.md)'s Architecture section for the file-level breakdown). **Note:**
the actual implementation deliberately deviates from this plan's "New Files" section below —
`memory/policy_memory.py` (not `src/memory/policy_memory.py`) and `experiments/context_fusion.py`
(not `src/agents/context_fusion.py`), since this contribution isn't wired into production yet. See
CLAUDE.md's Architecture section for why.

The full 200-ticket evaluation across all 3 failure-rate tiers, plus a controlled `v2_full`
ablation isolating retrieval source as the only variable, **is now complete**. Result: no
statistically significant resolution-rate difference between Policy Memory and plain ticket-based
retrieval at any failure rate — see [`paper/results.md`](paper/results.md) (Tables 8–11) and
[`paper/discussion.md`](paper/discussion.md) for the full writeup, and this document's Evaluation
section below for the metric list that was measured. Production integration
(`ENTERPRISE_ARCHITECTURE.md` Phase 6) remains not started, and — given this null result — is now
a lower-confidence path than originally framed; see `paper/future_work.md` for what would need to
happen first.

## Goal
Replace ticket-centric planning memories with Policy Memory that stores reusable execution knowledge rather than customer-specific examples.

## Research Hypothesis
Policy-based memories generalize better than replaying previous tickets because they encode workflow knowledge instead of instance-specific data.

## Design Principles
- Keep PlanSuccessMemory unchanged.
- Add a new PolicyMemory.
- Never store ticket text or customer identifiers.
- Store reusable workflow policies.

## Architecture

Customer Ticket
→ Intent Detection
→ Memory Manager
→ (Episodic + Failure + Policy Memories)
→ Context Fusion
→ Planner
→ Dynamic DAG
→ Executor
→ Critic (Frozen)

## PolicyMemory Schema

```python
class PolicyMemory(BaseMemoryEntry):
    policy_id: str
    intent_cluster: str
    workflow_template: list[list[str]]
    dependency_graph: dict
    tool_constraints: dict
    success_rate: float
    usage_count: int
    average_tool_calls: float
    average_replans: float
    confidence: float
    created_from: list[str]
    last_updated: datetime
```

## Workflow Example

Instead of:

CRM(CUST-001)
→ ORDER(ORD-101)
→ REFUND

Store:

CRM
→ ORDER_LOOKUP
→ REFUND

## Context Fusion
Retrieve:
- Top-3 Policy memories
- Top-2 Failure memories
- Top-3 Episodic memories

Merge them into a PlanningContext for the Planner.

## New Files
- src/memory/policy_memory.py
- src/agents/context_fusion.py

## Modified Files
- src/memory/client_store.py
- src/memory/memory_manager.py
- src/agents/planner.py
- experiments/memory_augmented_v2.py
- scripts/run_experiment.py

## Writing Policy Memory
1. Extract workflow.
2. Build dependency graph.
3. Remove customer-specific information.
4. Update existing matching policy or create a new one.

## Evaluation
Compare Contribution 1 vs Contribution 2 using:
- Resolution Rate
- Average Tool Calls
- Average Replans
- Memory Hit Rate
- Policy Retrieval Rate
- Transfer Success

## Success Criteria
- No customer-specific data stored.
- Policies reused across tickets.
- Reduced replans.
- Equal or better resolution rate.
- Backward compatibility preserved.
