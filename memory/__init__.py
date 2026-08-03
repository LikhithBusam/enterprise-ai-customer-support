"""Research-track Policy Memory package (Policy_Memory_Implementation_Plan.md, Contribution 2).

Deliberately a top-level package, sibling to `experiments/` and `src/`, not `src/memory/` — this
contribution's current scope is research-track only (see Policy_Memory_Implementation_Plan.md's
"New Files" list, adapted: production wiring is future work gated on this landing in
`experiments/` first, per ENTERPRISE_ARCHITECTURE.md Phase 6). Reuses `src.memory.base` and
`src.memory.client_store` unmodified for the underlying pydantic entry contract and shared Chroma
client — it does not fork that infrastructure, only adds a new memory type on top of it.
"""
