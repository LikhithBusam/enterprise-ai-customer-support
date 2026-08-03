"""API-key -> client_id resolution (ENTERPRISE_ARCHITECTURE.md Phase 2 "Auth / multi-tenancy").

`client_id` is already threaded as a plain string through `ClientStoreRegistry.get(client_id)`
and tool calls — the gap this closes is that it stops being an unauthenticated caller-supplied
string. Callers must present a configured API key (`X-API-Key` header); the resolved client_id is
never taken from the request body.
"""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status

from src.core.config import Settings, get_settings


def get_api_key_map(settings: Settings = Depends(get_settings)) -> dict[str, str]:
    return settings.api_keys


def resolve_client_id(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    api_keys: dict[str, str] = Depends(get_api_key_map),
) -> str:
    if not x_api_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing X-API-Key header")
    client_id = api_keys.get(x_api_key)
    if client_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid API key")
    return client_id
