"""Intake Agent: classify ticket intent, extract entities.

experiments/'s baselines never actually implement this as a standalone step — they read
`expected_tool_sequence` straight off the dataset ticket, an oracle label from
scripts/build_synthetic_data.py's dataset generation, and the message is scanned for entities
inline. A real inbound ticket has neither — this module is genuinely new, not a port.
"""

from __future__ import annotations

import logging
import re

from src.core.telemetry import span
from src.models.intake import IntakeInput, IntakeOutput

logger = logging.getLogger(__name__)

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_ORDER_RE = re.compile(r"(ORD-\d+)", re.IGNORECASE)
_AMOUNT_RE = re.compile(r"\$(\d+\.?\d*)")

# Basic prompt-injection filter (ENTERPRISE_ARCHITECTURE.md Phase 5 / AGENTS.md's already-planned
# "basic prompt-injection filter on ticket intake"). Heuristic pattern matching, not a classifier
# — every downstream agent embeds the raw customer message into an LLM prompt (planner, critic,
# response, escalation all read PipelineState["customer_message"] directly), so this has to run at
# intake, before that message is used anywhere else.
_INJECTION_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"ignore (all |any )?(previous|prior|above)( instructions)?",
        r"disregard (all |any )?(previous|prior|above)",
        r"forget (all |any )?(previous|prior|above)( instructions)?",
        r"new instructions\s*:",
        r"system\s*prompt",
        r"you are now",
        r"act as (an?|the)",
        r"pretend (you are|to be)",
        r"reveal (your|the) (system )?(prompt|instructions)",
        r"override your (instructions|programming)",
        r"do anything now",
        r"jailbreak",
    )
)
_REDACTION_PLACEHOLDER = "[redacted: possible prompt injection]"


def _sanitize_message(message: str) -> tuple[str, bool]:
    detected = False
    sanitized = message
    for pattern in _INJECTION_PATTERNS:
        sanitized, count = pattern.subn(_REDACTION_PLACEHOLDER, sanitized)
        detected = detected or count > 0
    return sanitized, detected

# The intent-cluster -> canonical tool sequence mapping already established by
# scripts/build_synthetic_data.py's INTENTS table (see build_synthetic_data.py:59-594) —
# reused as-is so production and research agree on what each intent cluster means.
INTENT_TOOLS: dict[str, list[str]] = {
    "refund_request": ["crm", "order_lookup", "refund"],
    "order_status": ["crm", "order_lookup"],
    "billing_dispute": ["crm", "order_lookup", "kb_search", "refund"],
    "account_issue": ["crm", "kb_search"],
    "complaint_escalation": ["crm", "order_lookup", "kb_search"],
    "general_inquiry": ["kb_search"],
}

# Ordered, first-match-wins keyword heuristic — a v1 classifier. No LLM call today, despite
# "intake" being a defined role in src/core/llm_client.py's default_role_providers: swapping in
# an LLM-based classifier later only touches this function, not the IntakeOutput contract.
_KEYWORD_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("refund_request", ("refund", "money back", "return the", "reimburse")),
    (
        "billing_dispute",
        (
            "charged twice",
            "double charged",
            "overcharged",
            "billing dispute",
            "wrong charge",
            "dispute",
        ),
    ),
    (
        "order_status",
        ("where is my order", "order status", "track my", "delivery status", "has it shipped"),
    ),
    (
        "account_issue",
        ("can't log in", "cannot log in", "login", "password", "account locked", "account issue"),
    ),
    (
        "complaint_escalation",
        ("unacceptable", "escalate", "speak to a manager", "furious", "terrible service"),
    ),
]


def _classify_intent(message: str) -> str:
    lowered = message.lower()
    for intent, keywords in _KEYWORD_RULES:
        if any(keyword in lowered for keyword in keywords):
            return intent
    return "general_inquiry"


def run(input: IntakeInput) -> IntakeOutput:
    """Extract entities and classify intent. Entity extraction mirrors the regex extraction
    proven in experiments/memory_augmented_v2.py::_extract_context.
    """
    with span("agent.intake", ticket_id=input.ticket_id):
        sanitized_message, prompt_injection_detected = _sanitize_message(input.customer_message)
        if prompt_injection_detected:
            logger.warning(
                "Prompt-injection pattern detected and redacted.",
                extra={"ticket_id": input.ticket_id},
            )

        context: dict[str, object] = {"customer_id": input.customer_id}

        order_match = _ORDER_RE.search(input.customer_message)
        if order_match:
            context["order_id"] = order_match.group(1).upper()

        email_match = _EMAIL_RE.search(input.customer_message)
        if email_match:
            context["email"] = email_match.group(0)

        amount_match = _AMOUNT_RE.search(input.customer_message)
        if amount_match:
            try:
                context["amount"] = float(amount_match.group(1))
            except ValueError:
                pass

        intent = input.intent_label or _classify_intent(input.customer_message)
        expected_tools = INTENT_TOOLS.get(intent, ["kb_search"])

        return IntakeOutput(
            intent=intent,
            context=context,
            expected_tools=expected_tools,
            sanitized_message=sanitized_message,
            prompt_injection_detected=prompt_injection_detected,
        )
