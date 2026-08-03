from __future__ import annotations

from src.core.dag import TOOL_DEPENDENCIES, TOOL_LAYERS, ExecutionDAG


def test_from_pending_tools_groups_by_layer() -> None:
    dag = ExecutionDAG.from_pending_tools({"refund", "crm", "order_lookup", "kb_search"})
    assert dag.layers == [["crm"], ["kb_search", "order_lookup"], ["refund"]]


def test_from_pending_tools_empty() -> None:
    assert ExecutionDAG.from_pending_tools(set()).layers == []


def test_to_dict_and_from_dict_round_trip() -> None:
    dag = ExecutionDAG.from_pending_tools({"crm", "order_lookup", "refund"})
    assert ExecutionDAG.from_dict(dag.to_dict()) == dag


def test_all_tools() -> None:
    dag = ExecutionDAG(layers=[["crm"], ["order_lookup", "kb_search"]])
    assert dag.all_tools() == {"crm", "order_lookup", "kb_search"}


def test_filtered_to_drops_disallowed_tools() -> None:
    dag = ExecutionDAG(layers=[["crm"], ["order_lookup", "kb_search"], ["refund"]])
    filtered = dag.filtered_to({"crm", "kb_search"})
    assert filtered.layers == [["crm"], ["kb_search"], []]


def test_is_dependency_ordered_valid_dag() -> None:
    dag = ExecutionDAG(layers=[["crm"], ["order_lookup"], ["refund"]])
    assert dag.is_dependency_ordered() is True


def test_is_dependency_ordered_rejects_same_layer_dependency() -> None:
    dag = ExecutionDAG(layers=[["crm"], ["refund", "order_lookup"]])
    assert dag.is_dependency_ordered() is False


def test_is_dependency_ordered_rejects_empty_dag() -> None:
    assert ExecutionDAG(layers=[]).is_dependency_ordered() is False


def test_is_dependency_ordered_rejects_gap_between_layers() -> None:
    dag = ExecutionDAG(layers=[["crm"], [], ["order_lookup"]])
    assert dag.is_dependency_ordered() is False


def test_is_dependency_ordered_ignores_missing_dependency() -> None:
    # refund present without order_lookup anywhere in the DAG: the dependency check only
    # applies when both the tool and its dependency are present.
    dag = ExecutionDAG(layers=[["crm"], ["refund"]])
    assert dag.is_dependency_ordered() is True


def test_tool_layers_and_dependencies_cover_all_registry_tools() -> None:
    assert set(TOOL_LAYERS) == {"crm", "order_lookup", "kb_search", "refund"}
    assert TOOL_DEPENDENCIES == {"refund": {"order_lookup"}}
