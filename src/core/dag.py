"""The Planner -> Executor contract, formalized.

Across experiments/, the plan is just a `list[list[str]]` (an ordered list of layers, each
layer a set of tool names runnable in parallel) — used ad hoc via functions like
`_dag_to_dict`, `_dag_is_valid`, `_plan_fallback`, plus a duplicated `_TOOL_LAYERS` /
`_DEPENDENCIES` pair in every experiment module. This module formalizes that exact, already-
proven shape as a typed pydantic model rather than redesigning it — AGENTS.md's "Data
Contracts" section already requires the Planner->Executor payload to be "a typed DAG object,
not free text."
"""

from __future__ import annotations

from pydantic import BaseModel

# Deterministic fallback layer assignment and cross-tool dependency gating. Mirrors
# _TOOL_LAYERS / _DEPENDENCIES from experiments/memory_augmented_v2.py (and the other
# experiment modules) exactly — reused, not reinvented.
TOOL_LAYERS: dict[str, int] = {
    "crm": 0,
    "order_lookup": 1,
    "kb_search": 1,
    "refund": 2,
}

TOOL_DEPENDENCIES: dict[str, set[str]] = {
    "refund": {"order_lookup"},
}


class ExecutionDAG(BaseModel):
    """An ordered list of layers; each layer is a set of tool names the Executor may dispatch
    in parallel. Layers are ordered, but within a layer there is no ordering guarantee.
    """

    layers: list[list[str]] = []

    @classmethod
    def from_pending_tools(cls, pending_tools: set[str]) -> ExecutionDAG:
        """Deterministic fallback plan, grouping tools into layers via TOOL_LAYERS. Mirrors
        experiments/memory_augmented_v2.py::_plan_fallback."""
        layers: list[list[str]] = []
        for layer_idx in sorted({TOOL_LAYERS.get(t, 99) for t in pending_tools}):
            layer = sorted(t for t in pending_tools if TOOL_LAYERS.get(t, 99) == layer_idx)
            if layer:
                layers.append(layer)
        return cls(layers=layers)

    @classmethod
    def from_dict(cls, data: dict) -> ExecutionDAG:
        return cls(layers=data.get("layers", []))

    def to_dict(self) -> dict:
        return {"layers": self.layers}

    def all_tools(self) -> set[str]:
        return {tool for layer in self.layers for tool in layer}

    def filtered_to(self, allowed: set[str]) -> ExecutionDAG:
        return ExecutionDAG(layers=[[t for t in layer if t in allowed] for layer in self.layers])

    def is_dependency_ordered(self) -> bool:
        """True if every tool's dependencies (per TOOL_DEPENDENCIES) appear in a strictly
        earlier layer, and there are no gaps between populated layers. Mirrors
        experiments/memory_augmented_v2.py::_dag_is_valid — used to gate PlanSuccessMemory
        writes so a bad plan is never memorized as a template.
        """
        non_empty = [layer for layer in self.layers if layer]
        if not non_empty:
            return False

        last_non_empty_idx = max(i for i, layer in enumerate(self.layers) if layer)
        for i in range(last_non_empty_idx):
            if not self.layers[i]:
                return False

        tool_layer: dict[str, int] = {}
        for layer_idx, layer in enumerate(self.layers):
            for tool in layer:
                tool_layer[tool] = layer_idx

        for tool, deps in TOOL_DEPENDENCIES.items():
            if tool not in tool_layer:
                continue
            for dep in deps:
                if dep not in tool_layer:
                    continue
                if tool_layer[dep] >= tool_layer[tool]:
                    return False

        return True
