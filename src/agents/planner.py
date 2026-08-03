"""Planner Agent: builds the tool-call DAG, retrieving from PlanSuccessMemory / tool-reliability
scores first. Only Executor Agents call tools — this agent never does (AGENTS.md convention).

Ports experiments/memory_augmented_v2.py's `_plan_llm_memory` (memory-augmented planning, both
template abstraction and reliability scoring always on) onto the src/core/llm_client.py Provider
Gateway and the src/agents/memory_manager.py retrieval abstraction, instead of the duplicated
_call_llm/_get_client pattern. Does not wire Policy Memory / context_fusion — see
ENTERPRISE_ARCHITECTURE.md Phase 6; `retrieve_plan_templates` below is the intended swap point.
"""

from __future__ import annotations

import json
import logging
import re

from src.agents import memory_manager
from src.core.config import Settings, get_settings
from src.core.dag import ExecutionDAG
from src.core.llm_client import LLMProviderGateway, get_gateway
from src.core.telemetry import span
from src.models.planner import PlannerInput, PlannerOutput

logger = logging.getLogger(__name__)

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def abstract_ticket_message(message: str) -> str:
    """Strip ticket-specific values (order/customer IDs, email, amount) before using the
    message as a memory query or write key. Mirrors
    experiments/memory_augmented_v2.py::_abstract_dag_template (Contribution 1's
    template-abstraction, reused verbatim) — used both for PlanSuccessMemory retrieval here and
    for the write-back in src/graph/pipeline.py.
    """
    msg = re.sub(r"ORD-\d+", "{order_id}", message, flags=re.IGNORECASE)
    msg = re.sub(r"CUST-\d+", "{customer_id}", msg, flags=re.IGNORECASE)
    msg = _EMAIL_RE.sub("{email}", msg)
    msg = re.sub(r"\$\d+(?:\.\d+)?", "{amount}", msg)
    return msg


def run(
    input: PlannerInput,
    gateway: LLMProviderGateway | None = None,
    settings: Settings | None = None,
) -> PlannerOutput:
    with span("agent.planner", client_id=input.client_id):
        return _run(input, gateway, settings)


def _run(
    input: PlannerInput,
    gateway: LLMProviderGateway | None,
    settings: Settings | None,
) -> PlannerOutput:
    gateway = gateway or get_gateway()
    settings = settings or get_settings()
    pending = set(input.pending_tools)

    retrieved, retrieval_distance = memory_manager.retrieve_plan_templates(
        client_id=input.client_id,
        query_text=abstract_ticket_message(input.ticket_message),
    )
    memory_hit = bool(retrieved)

    if not settings.use_llm or not input.ticket_message:
        return PlannerOutput(
            dag=ExecutionDAG.from_pending_tools(pending),
            memory_hit=memory_hit,
            retrieval_distance=retrieval_distance,
        )

    reliability_scores = {
        tool: memory_manager.compute_tool_reliability(input.client_id, tool) for tool in pending
    }

    memory_context = ""
    if retrieved:
        templates = [
            f"  [{i}] intent_cluster={mem.intent_cluster!r}, success_rate={mem.success_rate:.2f}, "
            f"dag_template={json.dumps(mem.dag_template)}"
            for i, mem in enumerate(retrieved, 1)
        ]
        memory_context = (
            "Past successful DAG templates for similar tickets "
            "(use these as a starting point if relevant):\n" + "\n".join(templates) + "\n\n"
        )

    reliability_context = (
        "Recent tool reliability scores (1.00 = perfect, lower = more frequent failures):\n"
        + "\n".join(f"  - {tool}: {score:.2f}" for tool, score in reliability_scores.items())
        + "\nConsider these reliability scores when planning. Prefer reliable tools early and "
        "plan alternative paths for less reliable ones.\n\n"
    )

    user_prompt = (
        f"{memory_context}{reliability_context}"
        f"Available tools: {sorted(pending)}\n"
        f"Customer message: {input.ticket_message}\n\n"
        "Return a JSON array of arrays (list of layers). "
        "Each inner array is a set of tools that can run in parallel.\n"
        "Rules:\n"
        "- crm before order_lookup before refund\n"
        "- kb_search is independent\n"
        "Return ONLY the JSON array."
    )

    try:
        content = gateway.call(
            "planner",
            [
                {"role": "system", "content": "You are a tool planner. Output only valid JSON."},
                {"role": "user", "content": user_prompt},
            ],
        )
        start = content.index("[")
        end = content.rindex("]") + 1
        layers = json.loads(content[start:end])
        dag = ExecutionDAG(layers=[[t for t in layer if t in pending] for layer in layers])
    except Exception as exc:
        logger.warning(
            "Planner LLM call/parse failed (%s) — falling back to deterministic plan.", exc
        )
        dag = ExecutionDAG.from_pending_tools(pending)

    return PlannerOutput(dag=dag, memory_hit=memory_hit, retrieval_distance=retrieval_distance)
