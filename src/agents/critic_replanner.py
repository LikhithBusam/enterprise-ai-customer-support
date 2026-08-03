"""Critic/Replanner Agent: detects failed/ambiguous tool results, decides whether to replan,
and routes to a category-specific recovery strategy from ToolFailureMemory.

CRITICAL (AGENTS.md "What NOT to do"): this agent must only ever read `success`/`data`/`error`
off a tool result, never `ToolResult.failure_type` — that field is oracle/eval-only metadata for
scoring prediction accuracy after the fact. `ToolCallRecord` (src/models/executor.py) doesn't
even carry `failure_type`, so there is nothing to accidentally read here.

Ports experiments/memory_augmented_v2.py's `_critic_llm_memory_v2` (Contribution 1's
failure-category-conditioned Critic, always on) onto the Provider Gateway and the
src/agents/memory_manager.py retrieval abstraction, reusing the same
src/prompts/critic_conditioned_v2.txt prompt file research already validated.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from src.agents import memory_manager
from src.core.config import Settings, get_settings
from src.core.llm_client import LLMProviderGateway, get_gateway
from src.core.telemetry import span
from src.models.critic import CriticInput, CriticOutput
from src.models.executor import ToolCallRecord

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def _load_prompt(filename: str) -> str:
    return (_PROMPTS_DIR / filename).read_text().strip()


def _classify_failure(entry: ToolCallRecord) -> str:
    """Predict a failure category from observable symptoms only. Mirrors
    experiments/memory_augmented_v2.py::_classify_failure exactly (Contribution 1 of the paper) —
    reused, not reimplemented."""
    if not entry.success:
        return "timeout"

    data = entry.data or {}
    status = data.get("status", "")
    if status == "UNKNOWN" or data.get("note", ""):
        return "ambiguous_data"
    if status == "not_found":
        return "wrong_result"

    return "wrong_result"


def run(
    input: CriticInput,
    gateway: LLMProviderGateway | None = None,
    settings: Settings | None = None,
) -> CriticOutput:
    with span("agent.critic_replanner", client_id=input.client_id):
        return _run(input, gateway, settings)


def _run(
    input: CriticInput,
    gateway: LLMProviderGateway | None,
    settings: Settings | None,
) -> CriticOutput:
    gateway = gateway or get_gateway()
    settings = settings or get_settings()

    quick_failed = {entry.tool_name for entry in input.results if not entry.is_usable}
    if not quick_failed:
        return CriticOutput(resolved=True)

    failed_tool = sorted(quick_failed)[0]
    failed_entry = next(e for e in input.results if e.tool_name == failed_tool)
    predicted_category = _classify_failure(failed_entry)

    hits = memory_manager.retrieve_tool_failure(
        client_id=input.client_id,
        tool_name=failed_tool,
        failure_type=predicted_category,
        context=input.ticket_message,
    )
    for hit in hits:
        if hit.tool_name == failed_tool and hit.failure_type == predicted_category:
            recovery_strategy = hit.recovery_strategy or hit.fix_applied
            logger.info(
                "Memory hit in Critic for tool %s (%s) — applying stored recovery strategy "
                "%r without an LLM replan call.",
                failed_tool,
                predicted_category,
                recovery_strategy,
            )
            return CriticOutput(
                resolved=False,
                failed_tools=sorted(quick_failed),
                memory_hit=True,
                predicted_category=predicted_category,
                confidence=hit.confidence,
                recovery_strategy=recovery_strategy,
            )

    if not settings.use_llm:
        return CriticOutput(
            resolved=False,
            failed_tools=sorted(quick_failed),
            predicted_category=predicted_category,
            confidence=0.5,
            recovery_strategy="retry",
        )

    try:
        prompt_template = _load_prompt("critic_conditioned_v2.txt")
        user_prompt = prompt_template.format(
            dag_json=json.dumps(input.dag.layers),
            results_json=json.dumps([r.model_dump() for r in input.results], default=str),
        )
        content = gateway.call(
            "critic",
            [
                {
                    "role": "system",
                    "content": "You are a failure-aware tool execution critic. Output only valid JSON.",
                },
                {"role": "user", "content": user_prompt},
            ],
        )
        start = content.index("{")
        end = content.rindex("}") + 1
        parsed = json.loads(content[start:end])

        resolved = bool(parsed.get("resolved", False))
        failed_list = parsed.get("failed_tools") or sorted(quick_failed)

        category = predicted_category
        confidence = 0.8
        recovery_strategy = "retry"
        for failure_obj in parsed.get("failures", []):
            if failure_obj.get("tool_name") == failed_tool:
                category = failure_obj.get("predicted_category", predicted_category)
                confidence = float(failure_obj.get("confidence", 0.8))
                recovery_strategy = failure_obj.get("recovery_strategy", "retry")
                break

        return CriticOutput(
            resolved=resolved,
            failed_tools=sorted(set(failed_list)),
            predicted_category=category,
            confidence=confidence,
            recovery_strategy=recovery_strategy,
        )
    except Exception as exc:
        logger.warning("Critic LLM call failed (%s) — falling back to the deterministic gate.", exc)
        return CriticOutput(
            resolved=False,
            failed_tools=sorted(quick_failed),
            predicted_category=predicted_category,
            confidence=0.5,
            recovery_strategy="retry",
        )
