"""Policy Memory storage (Policy_Memory_Implementation_Plan.md, Contribution 2).

Deliberately *not* built on `src.memory.client_store.ChromaStore`: that class's `write()` always
mints a fresh UUID per call, which is correct for the existing append-only memory types
(EpisodicMemory/ToolFailureMemory/PlanSuccessMemory all just accumulate one entry per ticket) but
wrong for PolicyMemory — the plan's own "Writing Policy Memory" section requires "update existing
matching policy or create a new one," i.e. upsert-by-key. `PolicyMemory.policy_id` is a
deterministic key precisely so this module can use ChromaDB's `collection.upsert(ids=...)`
directly instead of reaching into `ChromaStore`'s private `_collection` or reinventing an
update-by-metadata-filter query (ChromaStore doesn't store an entry's own fields as queryable
metadata — only client_id/timestamp — so filtering by policy_id isn't possible through its public
interface anyway).

Still reuses the *shared* Chroma client (`src.memory.client_store.ClientStoreRegistry.get_client()`,
unmodified) so this doesn't fork infrastructure — same persist directory, same per-client
collection-naming convention (`{client_id}_policy`), just different write semantics for this one
memory type.

Research-track only, per Contribution 2's current scope (Policy_Memory_Implementation_Plan.md) —
not wired into src/.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone

from src.memory.client_store import ClientStoreRegistry

from memory.policy_memory import PolicyMemory

logger = logging.getLogger(__name__)

_COLLECTION_SUFFIX = "policy"

# Caps unbounded growth of PolicyMemory.created_from across many reinforcing tickets — only the
# most recent contributors are kept; the full history isn't needed for anything downstream.
MAX_CREATED_FROM = 50


def _collection_name(client_id: str) -> str:
    return f"{client_id}_{_COLLECTION_SUFFIX}"


def _get_collection(client_id: str):
    client = ClientStoreRegistry.get_client()
    return client.get_or_create_collection(name=_collection_name(client_id))


def make_policy_id(intent_cluster: str, workflow_template: list[list[str]]) -> str:
    """Deterministic key: the same workflow shape for the same intent cluster always maps to the
    same policy_id, which is what makes upsert-by-key ("update existing matching policy or create
    a new one") possible at all. `sort_keys=True` on the canonical JSON keeps the hash stable
    regardless of incidental key ordering (workflow_template is a list so element order already
    matters and is preserved, as intended — layer order is part of the policy's identity).
    """
    canonical = json.dumps(workflow_template, sort_keys=True)
    digest = hashlib.sha256(f"{intent_cluster}:{canonical}".encode()).hexdigest()[:16]
    return f"policy_{digest}"


def get_policy(client_id: str, policy_id: str) -> PolicyMemory | None:
    """Point lookup by the deterministic key — used before a write to decide whether to
    reinforce an existing policy or create a new one. Returns None (not an exception) on any
    storage error, matching this codebase's fail-open convention for memory reads.
    """
    try:
        collection = _get_collection(client_id)
        result = collection.get(ids=[policy_id])
    except Exception as exc:
        logger.warning("PolicyMemory get_policy failed: %s", exc)
        return None
    docs = result.get("documents") or []
    if not docs:
        return None
    return PolicyMemory.model_validate_json(docs[0])


def upsert_policy(client_id: str, policy: PolicyMemory) -> None:
    """Create-or-update by `policy.policy_id`. Raises on storage failure — callers (the
    write-back path in experiments/memory_augmented_v2.py) are expected to catch and log, same
    as every other memory write in this codebase.
    """
    collection = _get_collection(client_id)
    collection.upsert(
        ids=[policy.policy_id],
        documents=[policy.model_dump_json()],
        metadatas=[
            {
                "client_id": client_id,
                "intent_cluster": policy.intent_cluster,
                "timestamp": policy.timestamp.isoformat(),
                "timestamp_epoch": policy.timestamp.timestamp(),
            }
        ],
    )


def retrieve_policies(
    client_id: str, query_text: str, top_k: int = 3
) -> tuple[list[PolicyMemory], list[float]]:
    """Semantic top-k retrieval, mirroring `ChromaStore.retrieve()`'s query shape exactly (same
    `query_texts`/`where`/`distances` usage) — the only difference from that class is this
    module's write path, not how retrieval works.
    """
    if not query_text:
        return [], []
    collection = _get_collection(client_id)
    results = collection.query(
        query_texts=[query_text], n_results=top_k, where={"client_id": client_id}
    )
    docs = results.get("documents", [[]])[0] or []
    distances = results.get("distances", [[]])[0] or []
    policies = [PolicyMemory.model_validate_json(doc) for doc in docs]
    return policies, distances


def prune_policies(client_id: str, before: datetime) -> int:
    """Retention primitive mirroring `ChromaStore.prune()` — kept for parity with the other
    memory types even though Policy_Memory_Implementation_Plan.md doesn't call it out
    specifically; a memory type with no retention path would be an inconsistency, not a feature.
    """
    collection = _get_collection(client_id)
    where: dict = {
        "$and": [
            {"client_id": client_id},
            {"timestamp_epoch": {"$lt": before.timestamp()}},
        ],
    }
    results = collection.get(where=where)
    ids: list[str] = results.get("ids") or []
    if ids:
        collection.delete(ids=ids)
    return len(ids)


def count_policies(client_id: str) -> int:
    """Distinct-policy count for this client — the "Memory Growth" metric
    (Policy_Memory_Implementation_Plan.md's Evaluation section) is this number's trajectory
    across a run, not something computed per-ticket."""
    return _get_collection(client_id).count()


def reset_policy_collection(client_id: str) -> None:
    """Deletes this client's policy collection outright — mirrors
    scripts/run_experiment.py's `_reset_memory_augmented_store` (used per failure-rate tier so
    policies don't leak across tiers within a single experiment run)."""
    try:
        client = ClientStoreRegistry.get_client()
        client.delete_collection(_collection_name(client_id))
    except Exception:
        pass  # collection didn't exist yet — fine, same tolerance as the existing reset helper


def running_average(old_avg: float, old_count: int, new_value: float) -> float:
    """Shared helper for average_tool_calls/average_replans: incorporates one new observation
    into a running mean without storing the full history.
    """
    return ((old_avg * old_count) + new_value) / (old_count + 1)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
