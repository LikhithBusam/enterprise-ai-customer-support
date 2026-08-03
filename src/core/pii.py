"""PII redaction (ENTERPRISE_ARCHITECTURE.md Phase 5): scrubs personally-identifiable patterns
out of free text before it reaches a memory write. Regex-based structured-PII redaction (email,
phone, SSN, credit-card-like number) — not a full PII/NER model. Applied in
src/agents/memory_manager.py before ChromaStore.write(), per ENTERPRISE_ARCHITECTURE.md Phase 5's
"PII redaction belongs in the Memory Manager agent before write, not retrofitted into
ChromaStore."
"""

from __future__ import annotations

import re

_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
_CARD_RE = re.compile(r"\b(?:\d[ -]?){13,19}\b")
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)")

# Order matters: SSN/card (pure-digit patterns) must run before phone, since a card number would
# otherwise partially match the shorter phone pattern.
_REDACTIONS: tuple[tuple[re.Pattern[str], str], ...] = (
    (_SSN_RE, "[REDACTED_SSN]"),
    (_CARD_RE, "[REDACTED_CARD]"),
    (_EMAIL_RE, "[REDACTED_EMAIL]"),
    (_PHONE_RE, "[REDACTED_PHONE]"),
)


def redact_pii(text: str) -> str:
    """Best-effort structured-PII scrub of free text. Idempotent — redacting already-redacted
    text is a no-op."""
    if not text:
        return text
    redacted = text
    for pattern, placeholder in _REDACTIONS:
        redacted = pattern.sub(placeholder, redacted)
    return redacted
