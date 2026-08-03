import { useMemo } from "react"
import type { KeyboardEvent as ReactKeyboardEvent } from "react"
import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type NodeChange,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import {
  ExecutionNode,
  type ExecutionFlowNode,
} from "@/features/live-execution/components/execution-node"
import { ExecutionToolbar } from "@/features/live-execution/components/execution-toolbar"
import { NODE_LABELS } from "@/lib/agent-nodes"
import type { AgentNodeExecution } from "@/types/mocked"

const NODE_TYPES = { executionNode: ExecutionNode }
const VERTICAL_GAP = 108
// Matches ExecutionNode's fixed w-44/h-20 — declared up front (rather than left to React Flow's
// post-mount ResizeObserver) so the MiniMap and fitView bounds are correct on the very first
// render instead of only after measurement lands.
const NODE_WIDTH = 176
const NODE_HEIGHT = 80

// React Flow renders each custom node inside its own focusable wrapper (tabIndex + role="button",
// on by default unless disableKeyboardA11y is set — it isn't here), but that wrapper only takes a
// className via the node object itself, not through ExecutionNode's own JSX. Every other
// interactive element in the app gets a ring-based focus-visible style; without this, keyboard
// users tabbing through the graph got no visible indicator at all.
const FOCUS_RING_CLASSNAME =
  "rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"

function buildFlowNodes(nodes: AgentNodeExecution[], selectedNodeId: string | null): ExecutionFlowNode[] {
  return nodes.map((node, index) => ({
    id: node.node_id,
    type: "executionNode",
    position: { x: 0, y: index * VERTICAL_GAP },
    selected: node.node_id === selectedNodeId,
    draggable: false,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    className: FOCUS_RING_CLASSNAME,
    data: {
      label: NODE_LABELS[node.node_id],
      status: node.status,
      durationMs: node.duration_ms,
      order: index + 1,
    },
  }))
}

function buildFlowEdges(nodes: AgentNodeExecution[], currentNode: string): Edge[] {
  const edges: Edge[] = []
  for (let index = 0; index < nodes.length - 1; index++) {
    const from = nodes[index]!
    const to = nodes[index + 1]!
    const isRetryEdge = from.node_id === "executor_retry" || to.node_id === "executor_retry"
    const isFailedEdge = from.status === "failed"
    const isActiveEdge = to.node_id === currentNode && to.status === "active"
    edges.push({
      id: `${from.node_id}-${to.node_id}`,
      source: from.node_id,
      target: to.node_id,
      animated: isActiveEdge,
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
      style: {
        stroke: isFailedEdge
          ? "var(--color-destructive)"
          : isRetryEdge
            ? "var(--color-warning)"
            : "var(--color-border)",
        strokeWidth: isRetryEdge || isFailedEdge ? 2 : 1.5,
        strokeDasharray: isRetryEdge ? "4 3" : undefined,
      },
    })
  }
  return edges
}

interface ExecutionGraphProps {
  nodes: AgentNodeExecution[]
  currentNode: string
  selectedNodeId: string | null
  onSelectNode: (nodeId: string | null) => void
}

function ExecutionGraphInner({ nodes, currentNode, selectedNodeId, onSelectNode }: ExecutionGraphProps) {
  const flowNodes = useMemo(() => buildFlowNodes(nodes, selectedNodeId), [nodes, selectedNodeId])
  const flowEdges = useMemo(() => buildFlowEdges(nodes, currentNode), [nodes, currentNode])

  // Selection is read back through onNodesChange's "select" changes rather than onNodeClick,
  // because React Flow's own keyboard handler (Enter/Space on a focused node) drives selection
  // through the same internal handleNodeClick()-> selection-change path as a mouse click does,
  // but only the latter used to fire onNodeClick — keyboard selection updated React Flow's
  // internal store while this component's controlled `selected` prop (derived from
  // selectedNodeId) silently overwrote it on the next render, so the inspector panel never
  // updated for keyboard users. onNodesChange fires identically for both input methods.
  function handleNodesChange(changes: NodeChange[]): void {
    const selectChanges = changes.filter(
      (change): change is Extract<NodeChange, { type: "select" }> => change.type === "select",
    )
    if (selectChanges.length === 0) return
    const newlySelected = selectChanges.find((change) => change.selected)
    onSelectNode(newlySelected ? newlySelected.id : null)
  }

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={NODE_TYPES}
      onNodesChange={handleNodesChange}
      onPaneClick={() => onSelectNode(null)}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.4}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      elementsSelectable
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      <MiniMap pannable zoomable className="!bg-card" nodeColor={() => "var(--color-muted-foreground)"} />
      <ExecutionToolbar onReset={() => onSelectNode(null)} />
    </ReactFlow>
  )
}

// Arrow-key scanning between nodes — the graph is laid out as a single top-to-bottom column
// (buildFlowNodes positions node[i] at y = i * VERTICAL_GAP), so Down/Up mirrors that order.
// Nodes aren't draggable, so this doesn't collide with React Flow's own arrow-key handling
// (which only repositions a node when it's both selected and draggable).
function handleGraphKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.classList.contains("react-flow__node")) return
  event.preventDefault()
  const nodeEls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(".react-flow__node"))
  const currentIndex = nodeEls.indexOf(target)
  if (currentIndex === -1) return
  const nextIndex =
    event.key === "ArrowDown"
      ? Math.min(currentIndex + 1, nodeEls.length - 1)
      : Math.max(currentIndex - 1, 0)
  nodeEls[nextIndex]?.focus()
}

/** Center panel of Live Agent Execution — a React Flow rendering of the LangGraph pipeline
 * (src/graph/pipeline.py), one node per agent step in execution order. */
export function ExecutionGraph(props: ExecutionGraphProps) {
  return (
    <div
      className="h-[520px] w-full overflow-hidden rounded-lg border border-border bg-card"
      onKeyDown={handleGraphKeyDown}
    >
      <ReactFlowProvider>
        <ExecutionGraphInner {...props} />
      </ReactFlowProvider>
    </div>
  )
}
