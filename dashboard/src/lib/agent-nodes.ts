import type { AgentNodeId } from "@/types/mocked"

/** The fixed LangGraph pipeline order (src/graph/pipeline.py) — shared by the execution fixture
 * generator and every Live Agent Execution display component (graph, timeline). */
export const NODE_ORDER: AgentNodeId[] = [
  "start",
  "intake",
  "planner",
  "executor",
  "critic",
  "executor_retry",
  "response",
  "memory_write",
  "end",
]

export const NODE_LABELS: Record<AgentNodeId, string> = {
  start: "Start",
  intake: "Intake",
  planner: "Planner",
  executor: "Executor",
  critic: "Critic",
  executor_retry: "Executor Retry",
  response: "Response",
  memory_write: "Memory Write",
  end: "End",
}

const TOOL_LABELS: Record<string, string> = {
  crm: "CRM Lookup",
  order_lookup: "Order Lookup",
  kb_search: "Knowledge Base",
  refund: "Refund API",
}

export function toolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName
}
