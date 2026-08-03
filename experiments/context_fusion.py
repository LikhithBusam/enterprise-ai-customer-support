"""Context Fusion (Policy_Memory_Implementation_Plan.md, Contribution 2).

Merges Policy, Tool-Failure, and Episodic memory retrievals into one `PlanningContext` for the
Planner, per the plan's "Context Fusion" section: top-3 Policy + top-2 Failure + top-3 Episodic.

Research-track only — gated behind `experiments/memory_augmented_v2.py`'s `ENABLE_POLICY_MEMORY`
flag. Not `src/agents/context_fusion.py`: that file only gets created once this contribution
lands in production, per ENTERPRISE_ARCHITECTURE.md Phase 6 (explicitly not started yet).
"""

from __future__ import annotations

import json
import logging

from pydantic import BaseModel, Field

from src.memory.client_store import ClientStore
from src.memory.episodic import EpisodicMemory
from src.memory.tool_failure import ToolFailureMemory

from memory.policy_memory import PolicyMemory
from memory.policy_store import retrieve_policies

logger = logging.getLogger(__name__)

POLICY_TOP_K = 3
FAILURE_TOP_K = 2
EPISODIC_TOP_K = 3


class PlanningContext(BaseModel):
    policies: list[PolicyMemory] = Field(default_factory=list)
    policy_distances: list[float] = Field(default_factory=list)
    tool_failures: list[ToolFailureMemory] = Field(default_factory=list)
    episodes: list[EpisodicMemory] = Field(default_factory=list)

    @property
    def has_any_hit(self) -> bool:
        return bool(self.policies or self.tool_failures or self.episodes)

    def to_prompt_text(self) -> str:
        """Renders the fused context as an LLM-prompt-ready text block, in the same
        numbered-list style experiments/memory_augmented_v2.py::_plan_llm_memory already uses for
        PlanSuccessMemory templates — kept visually consistent so the Planner prompt doesn't
        change shape depending on which ablation is active.
        """
        sections: list[str] = []
        if self.policies:
            lines = [
                f"  [{i}] intent_cluster={p.intent_cluster!r}, "
                f"workflow={json.dumps(p.workflow_template)}, "
                f"usage_count={p.usage_count}, success_rate={p.success_rate:.2f}, "
                f"confidence={p.confidence:.2f}"
                for i, p in enumerate(self.policies, 1)
            ]
            sections.append(
                "Reusable workflow policies for similar requests "
                "(prefer these over inventing a new plan if applicable):\n" + "\n".join(lines)
            )
        if self.tool_failures:
            lines = [
                f"  [{i}] tool={f.tool_name}, failure_type={f.failure_type}, "
                f"fix={f.fix_applied!r}"
                for i, f in enumerate(self.tool_failures, 1)
            ]
            sections.append(
                "Known tool failure patterns for similar requests:\n" + "\n".join(lines)
            )
        if self.episodes:
            lines = [
                f"  [{i}] intent={e.intent!r}, outcome={e.outcome}, "
                f"plan_dag={json.dumps(e.plan_dag)}"
                for i, e in enumerate(self.episodes, 1)
            ]
            sections.append("Past episodes for similar requests:\n" + "\n".join(lines))
        if not sections:
            return ""
        return "\n\n".join(sections) + "\n\n"


def fuse_context(client_id: str, query_text: str, store: ClientStore) -> PlanningContext:
    """Retrieves top-3 Policy + top-2 Failure + top-3 Episodic memories and merges them.

    Each retrieval fails closed to an empty list on any error — a broken or empty store must
    never crash planning, matching every other memory read in this codebase
    (src/agents/memory_manager.py's retrieve_* functions follow the same try/except-empty
    pattern).
    """
    policies: list[PolicyMemory] = []
    policy_distances: list[float] = []
    tool_failures: list[ToolFailureMemory] = []
    episodes: list[EpisodicMemory] = []

    if query_text:
        try:
            policies, policy_distances = retrieve_policies(client_id, query_text, top_k=POLICY_TOP_K)
        except Exception as exc:
            logger.warning("PolicyMemory retrieval failed in context fusion: %s", exc)

        try:
            tool_failures = store.tool_failure.retrieve(
                client_id=client_id, query_text=query_text, top_k=FAILURE_TOP_K
            )
        except Exception as exc:
            logger.warning("ToolFailureMemory retrieval failed in context fusion: %s", exc)

        try:
            episodes = store.episodic.retrieve(
                client_id=client_id, query_text=query_text, top_k=EPISODIC_TOP_K
            )
        except Exception as exc:
            logger.warning("EpisodicMemory retrieval failed in context fusion: %s", exc)

    return PlanningContext(
        policies=policies,
        policy_distances=policy_distances,
        tool_failures=tool_failures,
        episodes=episodes,
    )
