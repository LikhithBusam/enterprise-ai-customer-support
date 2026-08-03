"""Production orchestration: wires the 7 agents into a LangGraph StateGraph.

Ports experiments/memory_augmented_v2.py's "v2_full" behavior (conditioned critic +
template-abstracted memory + tool-reliability scoring, all always-on — the ablation flags
themselves stay research-only) onto the src/core/llm_client.py Provider Gateway and the
src/agents/memory_manager.py abstraction.

Scope boundary: this module does not touch experiments/ (memory_augmented.py stays frozen,
memory_augmented_v2.py stays mid-flight research) and does not wire Policy Memory /
context_fusion — src/agents/planner.py's retrieve_plan_templates call is the intended swap-in
point once that work lands (ENTERPRISE_ARCHITECTURE.md Phase 6).
"""

from __future__ import annotations

import logging
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from src.agents import (
    critic_replanner,
    escalation,
    executor,
    intake,
    memory_manager,
    planner,
    response,
)
from src.core.dag import ExecutionDAG
from src.core.llm_client import LLMProviderGateway, get_gateway
from src.core.telemetry import record_ticket_outcome, span
from src.models.critic import CriticInput
from src.models.escalation import EscalationInput
from src.models.executor import ExecutorInput, ToolCallRecord
from src.models.intake import IntakeInput
from src.models.planner import PlannerInput
from src.models.response import ResponseInput
from src.tools.adapter import SimulatedToolAdapter

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 3
DEFAULT_CLIENT_ID = "default_client"


class PipelineState(TypedDict, total=False):
    ticket_id: str
    customer_id: str
    customer_message: str
    intent_label: str
    client_id: str

    intent: str
    context: dict[str, Any]
    pending_tools: list[str]
    expected_tools: list[str]
    prompt_injection_detected: bool

    dag: dict
    tool_calls_made: list[dict]
    iteration: int

    resolved: bool
    memory_hit: bool
    replanning_count: int
    predicted_category: str
    recovery_strategy: str
    critic_confidence: float
    retrieval_distance: float | None

    response_message: str
    escalate: bool
    escalation_summary: str


def _check_resolved(expected_tools: list[str], calls: list[ToolCallRecord]) -> bool:
    """Mirrors experiments/memory_augmented_v2.py::_check_resolved, using ToolCallRecord.is_usable
    (oracle-free) rather than a helper that reads failure_type."""
    for tool in expected_tools:
        calls_for_tool = [c for c in calls if c.tool_name == tool]
        if not any(c.is_usable for c in calls_for_tool):
            return False
    return True


def _make_intake_node():
    def node(state: PipelineState) -> dict[str, Any]:
        result = intake.run(
            IntakeInput(
                ticket_id=state["ticket_id"],
                customer_id=state["customer_id"],
                customer_message=state["customer_message"],
                intent_label=state.get("intent_label", ""),
            )
        )
        return {
            # Phase 5's prompt-injection filter (src/agents/intake.py) overwrites
            # customer_message here — every node after this one (planner, critic, response,
            # escalation, memory write) reads state["customer_message"] fresh, so this single
            # overwrite is what makes the sanitized text the one they all see.
            "customer_message": result.sanitized_message,
            "prompt_injection_detected": result.prompt_injection_detected,
            "intent": result.intent,
            "context": result.context,
            "pending_tools": result.expected_tools,
            "expected_tools": result.expected_tools,
            "iteration": 0,
            "tool_calls_made": [],
            "memory_hit": False,
            "replanning_count": 0,
            # Defaults for keys only ever set by conditionally-executed nodes (escalation_node
            # is skipped whenever the ticket resolves) — without these, callers indexing
            # final_state["escalate"] on a resolved ticket hit a KeyError instead of False.
            "escalate": False,
            "escalation_summary": "",
        }

    return node


def _make_planner_node(gateway: LLMProviderGateway):
    def node(state: PipelineState) -> dict[str, Any]:
        result = planner.run(
            PlannerInput(
                pending_tools=state.get("pending_tools", []),
                ticket_message=state["customer_message"],
                intent=state.get("intent", "unknown"),
                client_id=state.get("client_id", DEFAULT_CLIENT_ID),
            ),
            gateway=gateway,
        )
        return {
            "dag": result.dag.to_dict(),
            "memory_hit": state.get("memory_hit", False) or result.memory_hit,
            "retrieval_distance": result.retrieval_distance,
            "iteration": state.get("iteration", 0) + 1,
        }

    return node


def _make_executor_node(dispatch: executor.DispatchFn):
    def node(state: PipelineState) -> dict[str, Any]:
        dag = ExecutionDAG.from_dict(state.get("dag", {}))
        prior_calls = [ToolCallRecord(**c) for c in state.get("tool_calls_made", [])]
        already_succeeded = [c.tool_name for c in prior_calls if c.is_usable]

        result = executor.run(
            ExecutorInput(
                dag=dag,
                context=state.get("context", {}),
                already_succeeded=already_succeeded,
                iteration=state.get("iteration", 1),
            ),
            dispatch=dispatch,
        )

        all_calls = prior_calls + result.tool_calls_made
        merged_context = {**state.get("context", {}), **result.updated_context}
        return {
            "tool_calls_made": [c.model_dump() for c in all_calls],
            "context": merged_context,
        }

    return node


def _make_critic_node(gateway: LLMProviderGateway):
    def node(state: PipelineState) -> dict[str, Any]:
        dag = ExecutionDAG.from_dict(state.get("dag", {}))
        all_calls = [ToolCallRecord(**c) for c in state.get("tool_calls_made", [])]
        iteration = state.get("iteration", 1)
        this_iteration_results = [c for c in all_calls if c.iteration == iteration]

        result = critic_replanner.run(
            CriticInput(
                dag=dag,
                results=this_iteration_results,
                ticket_message=state["customer_message"],
                client_id=state.get("client_id", DEFAULT_CLIENT_ID),
            ),
            gateway=gateway,
        )

        succeeded_this_iter = {c.tool_name for c in this_iteration_results if c.is_usable}
        pending = set(state.get("pending_tools", []))
        if result.resolved:
            pending -= succeeded_this_iter
        else:
            pending = set(result.failed_tools) | (pending - succeeded_this_iter)

        return {
            "pending_tools": sorted(pending),
            "memory_hit": state.get("memory_hit", False) or result.memory_hit,
            "replanning_count": state.get("replanning_count", 0) + (0 if result.resolved else 1),
            "predicted_category": result.predicted_category or state.get("predicted_category", ""),
            "recovery_strategy": result.recovery_strategy or state.get("recovery_strategy", ""),
            "critic_confidence": result.confidence,
        }

    return node


def _route_after_critic(state: PipelineState) -> str:
    if not state.get("pending_tools"):
        return "finalize"
    if state.get("iteration", 0) >= MAX_ITERATIONS:
        return "finalize"
    return "replan"


def _response_node(state: PipelineState) -> dict[str, Any]:
    calls = [ToolCallRecord(**c) for c in state.get("tool_calls_made", [])]
    resolved = _check_resolved(state.get("expected_tools", []), calls)
    result = response.run(
        ResponseInput(
            ticket_message=state["customer_message"], tool_calls_made=calls, resolved=resolved
        )
    )
    return {"resolved": resolved, "response_message": result.message}


def _route_after_response(state: PipelineState) -> str:
    return "escalate" if not state.get("resolved", False) else "write_memory"


def _escalation_node(state: PipelineState) -> dict[str, Any]:
    calls = [ToolCallRecord(**c) for c in state.get("tool_calls_made", [])]
    result = escalation.run(
        EscalationInput(
            ticket_id=state["ticket_id"],
            ticket_message=state["customer_message"],
            tool_calls_made=calls,
            resolved=state.get("resolved", False),
        )
    )
    return {"escalate": result.escalate, "escalation_summary": result.summary}


def _memory_write_node(state: PipelineState) -> dict[str, Any]:
    client_id = state.get("client_id", DEFAULT_CLIENT_ID)
    dag = ExecutionDAG.from_dict(state.get("dag", {}))
    resolved = state.get("resolved", False)

    memory_manager.write_episodic(
        client_id=client_id,
        ticket_id=state["ticket_id"],
        intent=state.get("intent", "unknown"),
        dag=dag,
        outcome="success" if resolved else "failure",
    )

    if resolved:
        memory_manager.write_plan_success(
            client_id=client_id,
            intent_cluster=state.get("intent", "unknown"),
            dag=dag,
            parameterized_message=planner.abstract_ticket_message(state["customer_message"]),
        )
    else:
        calls = [ToolCallRecord(**c) for c in state.get("tool_calls_made", [])]
        for call in calls:
            if call.is_usable:
                continue
            memory_manager.write_tool_failure(
                client_id=client_id,
                tool_name=call.tool_name,
                predicted_category=state.get("predicted_category", ""),
                context=state["customer_message"],
                recovery_strategy=state.get("recovery_strategy", ""),
                confidence=state.get("critic_confidence", 0.5),
            )

    return {}


def build_pipeline(
    gateway: LLMProviderGateway | None = None,
    dispatch: executor.DispatchFn | None = None,
):
    """Build and compile the LangGraph StateGraph.

    `dispatch` defaults to SimulatedToolAdapter().dispatch (ENTERPRISE_ARCHITECTURE.md Phase 4) —
    the same simulated tool handlers the research track uses, called directly rather than through
    the research-only ToolRegistry, with synthetic-failure injection off (failure_rate=0.0). Pass
    `RealToolAdapter().dispatch` (or any DispatchFn) to route to the real Stripe/Zendesk backends
    instead — this stays an explicit opt-in rather than a config-driven default so a deployment
    never starts hitting real vendor APIs without someone wiring it in on purpose.
    """
    gateway = gateway or get_gateway()
    if dispatch is None:
        dispatch = SimulatedToolAdapter().dispatch

    graph = StateGraph(PipelineState)
    graph.add_node("intake", _make_intake_node())
    graph.add_node("planner", _make_planner_node(gateway))
    graph.add_node("executor", _make_executor_node(dispatch))
    graph.add_node("critic", _make_critic_node(gateway))
    graph.add_node("response", _response_node)
    graph.add_node("escalation", _escalation_node)
    graph.add_node("write_memory", _memory_write_node)

    graph.add_edge(START, "intake")
    graph.add_edge("intake", "planner")
    graph.add_edge("planner", "executor")
    graph.add_edge("executor", "critic")
    graph.add_conditional_edges(
        "critic", _route_after_critic, {"finalize": "response", "replan": "planner"}
    )
    graph.add_conditional_edges(
        "response",
        _route_after_response,
        {"escalate": "escalation", "write_memory": "write_memory"},
    )
    graph.add_edge("escalation", "write_memory")
    graph.add_edge("write_memory", END)

    return graph.compile()


def run_ticket(
    ticket: dict[str, Any],
    client_id: str = DEFAULT_CLIENT_ID,
    pipeline: Any = None,
) -> PipelineState:
    app = pipeline or build_pipeline()
    initial_state: PipelineState = {
        "ticket_id": ticket["ticket_id"],
        "customer_id": ticket["customer_id"],
        "customer_message": ticket.get("customer_message", ""),
        "intent_label": ticket.get("intent_label", ""),
        "client_id": client_id,
    }
    with span("pipeline.run_ticket", ticket_id=ticket["ticket_id"], client_id=client_id):
        final_state = app.invoke(initial_state)

    record_ticket_outcome(
        client_id=client_id,
        resolved=final_state.get("resolved", False),
        escalate=final_state.get("escalate", False),
        replanning_count=final_state.get("replanning_count", 0),
    )
    return final_state
