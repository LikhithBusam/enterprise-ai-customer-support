"""
LangGraph ReAct baseline.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

from src.tools.registry import ToolRegistry
from experiments import BaselineResult
from experiments.memory_augmented_v2 import _check_resolved, _build_response, _SlidingWindowRateLimiter

load_dotenv()

logger = logging.getLogger(__name__)

LLM_CALL_TIMEOUT = float(os.environ.get("LLM_CALL_TIMEOUT", "30"))

# Reuse rate limiter from memory_augmented_v2 to stay within RPM constraints
_llm_rate_limiter = _SlidingWindowRateLimiter(
    max_calls=int(os.environ.get("NIM_RPM", "35")),
)


class ThrottledChatOpenAI(ChatOpenAI):
    """Subclass of ChatOpenAI that wraps generation with our sliding-window rate limiter."""

    def _generate(self, *args, **kwargs) -> Any:
        _llm_rate_limiter.acquire()
        return super()._generate(*args, **kwargs)


def run(ticket: dict[str, Any], registry: ToolRegistry) -> BaselineResult:
    ticket_id = ticket["ticket_id"]
    ticket_message = ticket.get("customer_message", "")

    # Define tools dynamically using the registry instance closure
    @tool
    def crm(customer_id: str = None, email: str = None) -> str:
        """Get customer information from CRM using customer ID or email."""
        res = registry.dispatch("crm", {"customer_id": customer_id, "email": email})
        return json.dumps(res.model_dump())

    @tool
    def order_lookup(order_id: str) -> str:
        """Look up order details from database using order ID."""
        res = registry.dispatch("order_lookup", {"order_id": order_id})
        return json.dumps(res.model_dump())

    @tool
    def refund(order_id: str, amount: float, reason: str) -> str:
        """Issue a refund for a given order and amount."""
        res = registry.dispatch("refund", {"order_id": order_id, "amount": amount, "reason": reason})
        return json.dumps(res.model_dump())

    @tool
    def kb_search(query: str) -> str:
        """Search the knowledge base for answers to customer queries."""
        res = registry.dispatch("kb_search", {"query": query, "top_k": 3})
        return json.dumps(res.model_dump())

    tools = [crm, order_lookup, refund, kb_search]

    # Initialize model using environment variables
    model = ThrottledChatOpenAI(
        model=os.environ["PLANNER_MODEL"],
        openai_api_key=os.environ["NVIDIA_API_KEY"],
        openai_api_base=os.environ["NVIDIA_BASE_URL"],
        temperature=0.0,
        timeout=LLM_CALL_TIMEOUT,
    )

    system_prompt = (
        "You are a helpful customer support agent. Help resolve the customer's request using the available tools.\n"
        "You must execute tools sequentially in proper dependency order:\n"
        "- crm lookup must occur before order_lookup\n"
        "- order_lookup must occur before refund\n"
        "- kb_search is independent and can be done anytime\n"
        "If a tool fails (e.g. returns status='UNKNOWN' or 'not_found' or times out), think step-by-step and try to fix the issue or retry.\n"
        f"Customer Message: {ticket_message}\n"
    )

    agent = create_react_agent(model, tools, prompt=system_prompt)

    # Execute the agent
    result = agent.invoke({"messages": [("user", ticket_message)]})

    # Parse execution trace to construct BaselineResult
    tool_calls_made: list[dict[str, Any]] = []
    steps_taken = 0

    for msg in result["messages"]:
        if isinstance(msg, AIMessage) and msg.tool_calls:
            steps_taken += 1
            for tc in msg.tool_calls:
                tool_calls_made.append({
                    "tool_name": tc["name"],
                    "params": tc["args"],
                    "success": False,
                    "failure_type": None,
                    "data": None,
                    "error": None,
                })
        elif isinstance(msg, ToolMessage):
            # Correlate ToolMessage with its corresponding AIMessage tool call
            for entry in reversed(tool_calls_made):
                if entry["tool_name"] == msg.name and entry["data"] is None:
                    try:
                        res_dict = json.loads(msg.content)
                        entry["success"] = res_dict.get("success", False)
                        entry["failure_type"] = res_dict.get("failure_type")
                        entry["data"] = res_dict.get("data")
                        entry["error"] = res_dict.get("error")
                    except Exception:
                        pass
                    break

    resolved = _check_resolved(ticket, tool_calls_made)
    final_response = result["messages"][-1].content if result["messages"] else ""

    return BaselineResult(
        ticket_id=ticket_id,
        resolved=resolved,
        steps_taken=steps_taken,
        tool_calls_made=tool_calls_made,
        final_response=final_response,
    )
