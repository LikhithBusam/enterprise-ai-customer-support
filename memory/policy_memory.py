"""PolicyMemory schema (Policy_Memory_Implementation_Plan.md, Contribution 2).

Stores reusable *workflow* knowledge — an intent cluster's tool-call shape and dependency
structure — instead of ticket-specific examples (PlanSuccessMemory's `parameterized_message`
still carries a per-ticket templated string; PolicyMemory carries none of the ticket text at
all). This distinction is the whole point of the contribution's hypothesis: does policy-based
memory generalize better than ticket-based memory?

Reuses `BaseMemoryEntry` from `src.memory.base` unmodified (same `timestamp` field, same pydantic
contract every other memory schema follows) — this file only adds a new schema, it does not touch
production code.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from src.memory.base import BaseMemoryEntry


class PolicyMemory(BaseMemoryEntry):
    # Deterministic key (memory.policy_store.make_policy_id) derived from intent_cluster +
    # workflow_template — *not* a random id. This is what makes "update existing matching policy
    # or create a new one" (Policy_Memory_Implementation_Plan.md's "Writing Policy Memory" section)
    # possible: the same workflow shape recurring for the same intent cluster maps to the same
    # policy_id every time, so writes upsert in place instead of accumulating duplicates.
    policy_id: str
    intent_cluster: str

    # Tool-name-only layers, e.g. [["crm"], ["order_lookup"], ["refund"]] — never ticket-specific
    # values (order IDs, emails, amounts never appear here; those live in tool-call params, not
    # the DAG shape itself, so no separate abstraction step is needed to make this reusable).
    workflow_template: list[list[str]]

    # tool_name -> sorted list of tools (within this workflow) it depends on, restricted to
    # experiments/memory_augmented_v2.py's existing _DEPENDENCIES map.
    dependency_graph: dict[str, list[str]] = Field(default_factory=dict)

    # Structural metadata beyond the dependency graph — currently just each tool's layer index,
    # kept as a loosely-typed dict since the plan doesn't pin this field's shape further.
    tool_constraints: dict = Field(default_factory=dict)

    # Write-on-success-only (mirrors PlanSuccessMemory's existing behavior in
    # experiments/memory_augmented_v2.py::_write_plan_success, which never writes on failure
    # either) — so success_rate is always 1.0 today. Tracked as a real field, not hardcoded at the
    # call site, so a future write-on-failure-too path only needs to change the writer, not this
    # schema. See "Risks" in the implementation report for why this is a known limitation.
    success_rate: float = 1.0

    usage_count: int = 1
    average_tool_calls: float = 0.0
    average_replans: float = 0.0
    # Simple reuse-weighted confidence: starts at 0.5 on first creation, nudged up per reuse (see
    # memory.policy_store.upsert_policy's caller in experiments/memory_augmented_v2.py), capped
    # at 1.0. Not a statistically calibrated score — a placeholder ordering signal for the Planner
    # prompt, not for use in resolution-rate arithmetic.
    confidence: float = 0.5

    # ticket_ids that created or reinforced this policy — capped by the writer to avoid unbounded
    # growth (see memory.policy_store's MAX_CREATED_FROM).
    created_from: list[str] = Field(default_factory=list)
    last_updated: datetime = Field(default_factory=datetime.utcnow)
