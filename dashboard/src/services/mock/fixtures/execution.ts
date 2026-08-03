import { conversationsFixture } from "@/services/mock/fixtures/conversations"
import { NODE_LABELS, NODE_ORDER, toolLabel } from "@/lib/agent-nodes"
import type {
  AgentNodeExecution,
  AgentNodeId,
  AgentNodeStatus,
  ConversationDetail,
  ExecutionMetrics,
  ExecutionTimelineEvent,
  ExecutionToolCallRecord,
  ExecutionTrace,
} from "@/types/mocked"

/** Deterministic per-ticket PRNG (mulberry32), independent of the shared faker singleton so
 * generation here never depends on module-evaluation order relative to fixtures/conversations.ts. */
function hashSeed(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index++) {
    hash = (Math.imul(31, hash) + input.charCodeAt(index)) | 0
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NODE_WEIGHT: Partial<Record<AgentNodeId, number>> = {
  start: 0,
  intake: 0.03,
  planner: 0.18,
  executor: 0.32,
  critic: 0.08,
  executor_retry: 0.24,
  response: 0.1,
  memory_write: 0.05,
  end: 0,
}

const CONFIDENCE_MIN = 0.58
const CONFIDENCE_RANGE = 0.4

interface BuiltExecution {
  trace: ExecutionTrace
  timeline: ExecutionTimelineEvent[]
  toolCalls: ExecutionToolCallRecord[]
}

function buildExecution(conversation: ConversationDetail): BuiltExecution {
  const rng = mulberry32(hashSeed(conversation.ticket_id))
  const isTerminalFailure = conversation.status === "escalated" || conversation.status === "failed"
  const hasRetry = conversation.replanning_count > 0
  const isMidFlight = conversation.status === "pending" || conversation.status === "in_progress"

  const includedNodes = hasRetry ? NODE_ORDER : NODE_ORDER.filter((id) => id !== "executor_retry")
  const activeIndex = isMidFlight
    ? includedNodes.indexOf(
        conversation.status === "pending" ? "intake" : hasRetry ? "executor_retry" : "executor",
      )
    : includedNodes.length - 1

  const totalBudget = conversation.latency_ms
  const weightSum = includedNodes.reduce((sum, id) => sum + (NODE_WEIGHT[id] ?? 0), 0) || 1
  const primaryToolCalls = conversation.tool_calls_made
  const retryToolName =
    primaryToolCalls.find((call) => !call.success)?.tool_name ?? primaryToolCalls.at(-1)?.tool_name

  let cursor = new Date(conversation.created_at).getTime()
  const toolCalls: ExecutionToolCallRecord[] = []
  const nodes: AgentNodeExecution[] = []
  const timeline: ExecutionTimelineEvent[] = []

  includedNodes.forEach((nodeId, index) => {
    const isFuture = isMidFlight && index > activeIndex
    const isActive = isMidFlight && index === activeIndex
    let status: AgentNodeStatus = isFuture ? "pending" : isActive ? "active" : "done"

    const isFailureCarrier =
      isTerminalFailure &&
      !isMidFlight &&
      ((hasRetry && nodeId === "executor_retry") || (!hasRetry && nodeId === "executor"))
    if (isFailureCarrier) status = "failed"

    let durationMs: number | null = null
    let nodeStartedAt: string | null = null
    if (status !== "pending") {
      if (nodeId === "start" || nodeId === "end") {
        durationMs = 0
      } else {
        const share = (NODE_WEIGHT[nodeId] ?? 0) / weightSum
        durationMs = Math.max(20, Math.round(totalBudget * share * (0.85 + rng() * 0.3)))
      }
      nodeStartedAt = new Date(cursor).toISOString()
      cursor += durationMs
    }

    let inputSummary: string | null = null
    let outputSummary: string | null = null
    let reasoningSummary: string | null = null
    let confidence: number | null = null
    let retrievedMemories: AgentNodeExecution["retrieved_memories"] = []
    let toolCallSummaries: AgentNodeExecution["tool_calls"] = []
    let retryCount = 0

    if (nodeId === "start") {
      outputSummary = "Execution started."
    } else if (nodeId === "intake") {
      inputSummary = conversation.customer_message
      outputSummary = "Message sanitized, prompt-injection scan passed."
    } else if (nodeId === "planner") {
      confidence = Number((CONFIDENCE_MIN + rng() * CONFIDENCE_RANGE).toFixed(2))
      inputSummary = conversation.customer_message
      reasoningSummary = `Classified intent as "${conversation.intent_label}"; built a ${primaryToolCalls.length}-step tool-call DAG.`
      outputSummary = `Plan: ${primaryToolCalls.map((call) => call.tool_name).join(" → ")}.`
      if (conversation.memory_hit) {
        retrievedMemories = [
          {
            type: "plan_success",
            summary: `Reused a prior successful plan for "${conversation.intent_label}" tickets.`,
            similarity: Number((0.78 + rng() * 0.19).toFixed(2)),
          },
        ]
      }
    } else if (nodeId === "executor") {
      toolCallSummaries = primaryToolCalls.map((call) => ({
        tool_name: call.tool_name,
        success: call.success,
        duration_ms: call.duration_ms,
      }))
      inputSummary = `Dispatch ${primaryToolCalls.length} tool call(s) from the Planner's DAG.`
      const failedCount = primaryToolCalls.filter((call) => !call.success).length
      outputSummary =
        failedCount === 0
          ? "All tool calls completed successfully."
          : `${failedCount} of ${primaryToolCalls.length} tool call(s) failed.`
      primaryToolCalls.forEach((call, callIndex) => {
        toolCalls.push({
          id: `${conversation.ticket_id}-tc-1-${callIndex}`,
          tool_name: call.tool_name,
          arguments: call.params,
          duration_ms: call.duration_ms,
          status: call.success ? "success" : "failed",
          retries: 0,
          output_summary: call.success
            ? "Completed successfully."
            : `Failed: ${call.failure_type ?? "unknown error"}.`,
          output: call.data,
          failure_type: call.failure_type,
          iteration: 1,
        })
      })
    } else if (nodeId === "critic") {
      confidence = Number((CONFIDENCE_MIN + rng() * CONFIDENCE_RANGE).toFixed(2))
      retryCount = conversation.replanning_count
      const failedCall = primaryToolCalls.find((call) => !call.success)
      reasoningSummary = failedCall
        ? `Detected a ${failedCall.failure_type ?? "tool"} failure on "${failedCall.tool_name}" — routing to replanning.`
        : "All tool outputs satisfy the resolution criteria."
      outputSummary = hasRetry
        ? `Verdict: unresolved, replanning required (attempt ${conversation.replanning_count}).`
        : "Verdict: resolved."
    } else if (nodeId === "executor_retry") {
      retryCount = conversation.replanning_count
      const retryTools = retryToolName ? [retryToolName] : []
      const retrySucceeds = !isTerminalFailure
      const perCallDuration = Math.max(150, Math.round((durationMs ?? 400) / Math.max(retryTools.length, 1)))
      toolCallSummaries = retryTools.map((toolName) => ({
        tool_name: toolName,
        success: retrySucceeds,
        duration_ms: perCallDuration,
      }))
      inputSummary = `Re-dispatch after Critic verdict (${conversation.replanning_count} replanning attempt(s)).`
      outputSummary = retrySucceeds
        ? "Retry succeeded — resolution criteria now satisfied."
        : `Retry exhausted after ${conversation.replanning_count} attempt(s) — escalating to a human agent.`
      retryTools.forEach((toolName, callIndex) => {
        toolCalls.push({
          id: `${conversation.ticket_id}-tc-retry-${callIndex}`,
          tool_name: toolName,
          arguments: primaryToolCalls.find((call) => call.tool_name === toolName)?.params ?? {},
          duration_ms: perCallDuration,
          status: retrySucceeds ? "success" : "failed",
          retries: conversation.replanning_count,
          output_summary: retrySucceeds
            ? "Retry completed successfully."
            : "Retry failed — same error persisted.",
          output: retrySucceeds ? { status: "ok" } : null,
          failure_type: retrySucceeds ? null : "ambiguous_data",
          iteration: 2,
        })
      })
    } else if (nodeId === "response") {
      inputSummary = "Resolution verdict + tool outputs."
      outputSummary = conversation.response_message
    } else if (nodeId === "memory_write") {
      outputSummary = conversation.memory_hit
        ? "Reinforced an existing plan-success memory entry."
        : "Wrote a new episodic memory entry for this ticket."
    } else if (nodeId === "end") {
      outputSummary = "Execution complete."
    }

    nodes.push({
      node_id: nodeId,
      status,
      started_at: nodeStartedAt,
      duration_ms: durationMs,
      input_summary: inputSummary,
      output_summary: outputSummary,
      retrieved_memories: retrievedMemories,
      tool_calls: toolCallSummaries,
      reasoning_summary: reasoningSummary,
      confidence,
      retry_count: retryCount,
    })

    if (status !== "pending" && nodeStartedAt) {
      const eventStatus = status === "failed" ? "failed" : nodeId === "executor_retry" ? "retry" : "success"
      timeline.push({
        id: `${conversation.ticket_id}-tl-${nodeId}`,
        timestamp: nodeStartedAt,
        node_id: nodeId,
        label: `${NODE_LABELS[nodeId]}${status === "failed" ? " failed" : ""}`,
        detail: outputSummary,
        duration_ms: durationMs,
        status: eventStatus,
      })
      toolCallSummaries.forEach((toolCall) => {
        timeline.push({
          id: `${conversation.ticket_id}-tl-${nodeId}-${toolCall.tool_name}`,
          timestamp: nodeStartedAt,
          node_id: nodeId,
          label: toolLabel(toolCall.tool_name),
          detail: toolCall.success ? "Completed successfully." : "Failed.",
          duration_ms: toolCall.duration_ms,
          status: toolCall.success ? "success" : "failed",
        })
      })
    }
  })

  const completed = !isMidFlight
  const currentNode = isMidFlight ? (includedNodes[activeIndex] ?? "start") : "end"

  const metrics: ExecutionMetrics = {
    total_duration_ms: conversation.latency_ms,
    tool_call_count: toolCalls.length,
    retry_count: conversation.replanning_count,
    memory_retrieval_count: nodes.reduce((sum, node) => sum + node.retrieved_memories.length, 0),
    tokens_used: Math.round(400 + rng() * 2600),
    estimated_cost_usd: Number((0.0008 + rng() * 0.006).toFixed(4)),
  }

  return {
    trace: { ticket_id: conversation.ticket_id, current_node: currentNode, nodes, completed, metrics },
    timeline,
    toolCalls,
  }
}

const cache = new Map<string, BuiltExecution>()

function getBuilt(ticketId: string): BuiltExecution | null {
  const cached = cache.get(ticketId)
  if (cached) return cached
  const conversation = conversationsFixture.find((item) => item.ticket_id === ticketId)
  if (!conversation) return null
  const built = buildExecution(conversation)
  cache.set(ticketId, built)
  return built
}

export function getExecutionTrace(ticketId: string): ExecutionTrace | null {
  return getBuilt(ticketId)?.trace ?? null
}

export function getExecutionTimeline(ticketId: string): ExecutionTimelineEvent[] | null {
  return getBuilt(ticketId)?.timeline ?? null
}

export function getExecutionToolCalls(ticketId: string): ExecutionToolCallRecord[] | null {
  return getBuilt(ticketId)?.toolCalls ?? null
}
