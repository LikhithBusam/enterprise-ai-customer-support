from __future__ import annotations

import random
from typing import Any

from src.tools.registry import ToolResult, roll_failure, timeout_result

TOOL_NAME = "kb_search"

_ARTICLES: list[dict[str, Any]] = [
    {
        "article_id": "KB-101",
        "title": "How to request a refund",
        "snippet": "Eligible orders can be refunded within 30 days of delivery.",
        "tags": ["refund", "billing"],
    },
    {
        "article_id": "KB-204",
        "title": "Shipping delays and tracking",
        "snippet": "If tracking has not updated in 72 hours, open a shipping investigation.",
        "tags": ["shipping", "tracking"],
    },
    {
        "article_id": "KB-318",
        "title": "Updating account contact details",
        "snippet": "Customers can update email and phone number from account settings.",
        "tags": ["account", "crm"],
    },
]


def _score(query: str, article: dict[str, Any]) -> float:
    query_terms = {term for term in query.lower().split() if term}
    haystack = f"{article['title']} {article['snippet']} {' '.join(article['tags'])}".lower()
    matches = sum(1 for term in query_terms if term in haystack)
    return matches / max(len(query_terms), 1)


def _success_payload(query: str, top_k: int) -> dict[str, Any]:
    ranked = sorted(_ARTICLES, key=lambda article: _score(query, article), reverse=True)
    results = [
        {**article, "relevance": round(_score(query, article), 2)}
        for article in ranked[:top_k]
    ]
    return {"query": query, "results": results, "result_count": len(results)}


def _ambiguous_payload(query: str, top_k: int) -> dict[str, Any]:
    return {
        "query": query,
        "results": [
            {
                "article_id": "KB-???",
                "title": "Possible match",
                "snippet": "",
                "tags": [],
                "relevance": 0.41,
            }
        ][:top_k],
        "result_count": None,
        "message": "Search results are incomplete and may not match the query intent",
    }


def _wrong_payload(query: str, top_k: int) -> dict[str, Any]:
    unrelated = sorted(_ARTICLES, key=lambda article: _score(query, article))[:top_k]
    return {
        "query": query,
        "results": [
            {**article, "relevance": 0.99}
            for article in unrelated
        ],
        "result_count": len(unrelated),
        "message": "High-confidence results returned",
    }


def search_kb(
    query: str,
    top_k: int = 3,
    *,
    failure_rate: float = 0.0,
    rng: random.Random | None = None,
) -> ToolResult:
    failure = roll_failure(failure_rate, rng)
    if failure == "timeout":
        return timeout_result(TOOL_NAME)

    if failure == "ambiguous_data":
        return ToolResult(
            success=True,
            tool_name=TOOL_NAME,
            data=_ambiguous_payload(query, top_k),
            failure_type="ambiguous_data",
        )

    if failure == "wrong_result":
        return ToolResult(
            success=True,
            tool_name=TOOL_NAME,
            data=_wrong_payload(query, top_k),
            failure_type="wrong_result",
        )

    return ToolResult(
        success=True,
        tool_name=TOOL_NAME,
        data=_success_payload(query, top_k),
        failure_type=None,
    )
