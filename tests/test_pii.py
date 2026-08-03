from __future__ import annotations

from src.core.pii import redact_pii


def test_redacts_email() -> None:
    result = redact_pii("Contact me at a.b@example.com please")
    assert "a.b@example.com" not in result
    assert "[REDACTED_EMAIL]" in result


def test_redacts_phone_number() -> None:
    result = redact_pii("Call me at 555-123-4567 tomorrow")
    assert "555-123-4567" not in result
    assert "[REDACTED_PHONE]" in result


def test_redacts_ssn() -> None:
    result = redact_pii("My SSN is 123-45-6789")
    assert "123-45-6789" not in result
    assert "[REDACTED_SSN]" in result


def test_redacts_credit_card_number() -> None:
    result = redact_pii("Card number: 4111111111111111")
    assert "4111111111111111" not in result
    assert "[REDACTED_CARD]" in result


def test_leaves_clean_text_unchanged() -> None:
    text = "refund for {order_id} amount {amount}"
    assert redact_pii(text) == text


def test_empty_string_is_noop() -> None:
    assert redact_pii("") == ""


def test_is_idempotent() -> None:
    once = redact_pii("email me at x@y.com or call 555-987-6543")
    twice = redact_pii(once)
    assert once == twice
