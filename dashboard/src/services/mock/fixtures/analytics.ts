import { conversationsFixture } from "@/services/mock/fixtures/conversations"
import { memoryFixture } from "@/services/mock/fixtures/memory"
import { ANALYTICS_CLIENTS } from "@/lib/analytics-clients"
import { formatIntentLabel } from "@/lib/intent-labels"
import { MEMORY_TYPES, MEMORY_TYPE_LABELS } from "@/lib/memory-types"
import { TOOL_NAMES, toolLabel } from "@/lib/tools"
import type {
  AnalyticsCategoryPoint,
  AnalyticsChartsResponse,
  AnalyticsKpi,
  AnalyticsSummary,
  AnalyticsSummaryResponse,
  AnalyticsTablesResponse,
  AnalyticsTrendPoint,
  ConversationDetail,
  FrequentMemoryRow,
  HighRetryConversationRow,
  InsightItem,
  LongResolutionRow,
  MemoryEntryBase,
  TicketStatus,
  TopCustomerRow,
  TopToolFailureRow,
} from "@/types/mocked"

/** Deterministic per-ticket PRNG (mulberry32) — same approach as fixtures/tools.ts and
 * fixtures/execution.ts, kept independent of the shared faker singleton. */
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

/** Structurally mirrors features/analytics/search-params.ts's AnalyticsFilterParams (the
 * URL-synced frontend shape) — kept as a separate declaration since this module must stay
 * import-free of the feature layer, but the two are meant to travel over the wire unchanged. */
export interface AnalyticsQueryFilters {
  dateFrom: string
  dateTo: string
  intent: string[]
  status: string[]
  tool: string[]
  memoryType: string[]
  resolution: "all" | "resolved" | "unresolved"
  client: string
}

interface Augmented {
  clientId: string
  confidence: number
}

/** Neither `client_id` nor a ticket-level `confidence` exist on ConversationDetail — the former
 * because Conversations has never been multi-tenant-scoped, the latter because confidence today
 * only lives per-node on ExecutionTrace (Live Execution), not rolled up per ticket. Both are
 * synthesized here, deterministically per ticket_id, purely so Analytics's "Client" filter and
 * "Average Confidence" KPI have something real and stable to work with — grounded in the same 3
 * placeholder clients already shown in the topbar switcher, not a fourth invented one. */
const augmentCache = new Map<string, Augmented>()

function augment(ticketId: string, status: TicketStatus): Augmented {
  const cached = augmentCache.get(ticketId)
  if (cached) return cached
  const rng = mulberry32(hashSeed(ticketId))
  const clientRoll = rng()
  const clientId =
    clientRoll < 0.6 ? ANALYTICS_CLIENTS[0]!.id : clientRoll < 0.85 ? ANALYTICS_CLIENTS[1]!.id : ANALYTICS_CLIENTS[2]!.id
  const base = status === "resolved" ? 0.78 : status === "escalated" || status === "failed" ? 0.5 : 0.65
  const confidence = Number(Math.min(0.98, Math.max(0.4, base + (rng() - 0.5) * 0.3)).toFixed(2))
  const result: Augmented = { clientId, confidence }
  augmentCache.set(ticketId, result)
  return result
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function kpi(value: number, previousValue: number): AnalyticsKpi {
  const delta = value - previousValue
  const delta_pct = previousValue !== 0 ? delta / previousValue : null
  return { value, previous_value: previousValue, delta, delta_pct }
}

function inDateRange(iso: string, dateFrom: string, dateTo: string): boolean {
  const t = new Date(iso).getTime()
  if (dateFrom && t < new Date(dateFrom).getTime()) return false
  if (dateTo && t > new Date(dateTo).getTime() + 86_400_000 - 1) return false
  return true
}

interface NumericRange {
  from: number
  to: number
}

function effectiveRange(params: AnalyticsQueryFilters): NumericRange {
  const allTimes = conversationsFixture.map((conv) => new Date(conv.created_at).getTime())
  const datasetMin = Math.min(...allTimes)
  const datasetMax = Math.max(...allTimes)
  const from = params.dateFrom ? new Date(params.dateFrom).getTime() : datasetMin
  const to = params.dateTo ? new Date(params.dateTo).getTime() + 86_400_000 - 1 : datasetMax
  return { from, to }
}

function previousRange(range: NumericRange): NumericRange {
  const span = range.to - range.from + 1
  return { from: range.from - span, to: range.from - 1 }
}

function filterByRange(params: AnalyticsQueryFilters, range: NumericRange): ConversationDetail[] {
  return conversationsFixture.filter((conv) => {
    const t = new Date(conv.created_at).getTime()
    if (t < range.from || t > range.to) return false
    if (params.intent.length > 0 && !params.intent.includes(conv.intent_label)) return false
    if (params.status.length > 0 && !params.status.includes(conv.status)) return false
    if (params.resolution === "resolved" && conv.status !== "resolved") return false
    if (params.resolution === "unresolved" && conv.status === "resolved") return false
    if (params.tool.length > 0 && !conv.tool_calls_made.some((call) => params.tool.includes(call.tool_name))) {
      return false
    }
    if (params.client !== "all" && augment(conv.ticket_id, conv.status).clientId !== params.client) return false
    return true
  })
}

interface FilteredSets {
  currentSet: ConversationDetail[]
  previousSet: ConversationDetail[]
  current: NumericRange
}

function currentAndPrevious(params: AnalyticsQueryFilters): FilteredSets {
  const current = effectiveRange(params)
  const previous = previousRange(current)
  return {
    currentSet: filterByRange(params, current),
    previousSet: filterByRange(params, previous),
    current,
  }
}

function filterMemoryEntries(params: AnalyticsQueryFilters): MemoryEntryBase[] {
  return memoryFixture.filter((entry) => {
    if (params.memoryType.length > 0 && !params.memoryType.includes(entry.memory_type)) return false
    if (!inDateRange(entry.timestamp, params.dateFrom, params.dateTo)) return false
    return true
  })
}

interface FlatToolCall {
  ticket_id: string
  tool_name: string
  success: boolean
  failure_type: string | null
  duration_ms: number
  timestamp: string
}

/** Individual tool calls have no timestamp of their own on ConversationDetail — the owning
 * conversation's created_at is used as a proxy, consistent with how latency_ms is already
 * ticket-level rather than per-call. */
function flattenToolCalls(conversations: ConversationDetail[], toolFilter: string[]): FlatToolCall[] {
  const calls: FlatToolCall[] = []
  for (const conv of conversations) {
    for (const call of conv.tool_calls_made) {
      if (toolFilter.length > 0 && !toolFilter.includes(call.tool_name)) continue
      calls.push({
        ticket_id: conv.ticket_id,
        tool_name: call.tool_name,
        success: call.success,
        failure_type: call.failure_type,
        duration_ms: call.duration_ms,
        timestamp: conv.created_at,
      })
    }
  }
  return calls
}

interface RawMetrics {
  total: number
  resolved: number
  escalated: number
  resolutionRate: number
  avgResolutionTimeMs: number
  avgToolCalls: number
  avgMemoryHitRate: number
  avgRetries: number
  avgLatencyMs: number
  avgConfidence: number
}

function computeRawMetrics(conversations: ConversationDetail[]): RawMetrics {
  const total = conversations.length
  const resolvedList = conversations.filter((conv) => conv.status === "resolved")
  const escalatedList = conversations.filter((conv) => conv.status === "escalated")
  const resolutionTimes = resolvedList
    .filter((conv): conv is ConversationDetail & { resolved_at: string } => conv.resolved_at !== null)
    .map((conv) => new Date(conv.resolved_at).getTime() - new Date(conv.created_at).getTime())

  return {
    total,
    resolved: resolvedList.length,
    escalated: escalatedList.length,
    resolutionRate: total > 0 ? resolvedList.length / total : 0,
    avgResolutionTimeMs: mean(resolutionTimes),
    avgToolCalls: mean(conversations.map((conv) => conv.tool_calls_made.length)),
    avgMemoryHitRate: mean(conversations.map((conv) => (conv.memory_hit ? 1 : 0))),
    avgRetries: mean(conversations.map((conv) => conv.replanning_count)),
    avgLatencyMs: mean(conversations.map((conv) => conv.latency_ms)),
    avgConfidence: mean(conversations.map((conv) => augment(conv.ticket_id, conv.status).confidence)),
  }
}

function avgLatencyByTool(calls: FlatToolCall[], tool: string): number | null {
  const durations = calls.filter((call) => call.tool_name === tool).map((call) => call.duration_ms)
  return durations.length > 0 ? mean(durations) : null
}

function computeInsights(currentSet: ConversationDetail[], previousSet: ConversationDetail[], summary: AnalyticsSummary): InsightItem[] {
  if (currentSet.length === 0) {
    return [
      {
        id: "empty",
        tone: "neutral",
        title: "No conversations match the current filters",
        description: "Widen the date range or clear a filter to see insights.",
      },
    ]
  }

  const insights: InsightItem[] = []

  // The comparison-based insights below only make sense when the immediately-preceding period
  // actually has data — for the "All time" preset, the previous window falls entirely before the
  // fixture's earliest ticket, so previousSet is always empty and any "vs previous period" framing
  // would be comparing against zero rather than a real absence of change.
  const hasPreviousPeriod = previousSet.length > 0

  if (hasPreviousPeriod) {
    const resolutionDeltaPts = summary.resolution_rate.delta * 100
    if (Math.abs(resolutionDeltaPts) >= 1) {
      insights.push({
        id: "resolution-rate",
        tone: resolutionDeltaPts > 0 ? "positive" : "negative",
        title: `Resolution rate ${resolutionDeltaPts > 0 ? "increased" : "decreased"} ${Math.abs(resolutionDeltaPts).toFixed(1)} pts`,
        description: `Now at ${(summary.resolution_rate.value * 100).toFixed(1)}%, versus ${(summary.resolution_rate.previous_value * 100).toFixed(1)}% in the prior period.`,
      })
    }

    const escalationDelta = summary.escalated.delta
    if (escalationDelta !== 0) {
      insights.push({
        id: "escalations",
        tone: escalationDelta < 0 ? "positive" : "warning",
        title: `Escalations ${escalationDelta < 0 ? "decreasing" : "increasing"}`,
        description: `${summary.escalated.value} escalated this period, versus ${summary.escalated.previous_value} previously.`,
      })
    }
  }

  const currentCalls = flattenToolCalls(currentSet, [])
  const previousCalls = flattenToolCalls(previousSet, [])

  if (hasPreviousPeriod) {
    const refundCurrent = avgLatencyByTool(currentCalls, "refund")
    const refundPrevious = avgLatencyByTool(previousCalls, "refund")
    if (refundCurrent !== null && refundPrevious !== null && refundPrevious > 0) {
      const pctChange = (refundCurrent - refundPrevious) / refundPrevious
      if (Math.abs(pctChange) >= 0.05) {
        insights.push({
          id: "refund-latency",
          tone: pctChange < 0 ? "positive" : "negative",
          title: `Refund API latency ${pctChange < 0 ? "improving" : "degrading"}`,
          description: `Averaging ${Math.round(refundCurrent)}ms this period, ${pctChange < 0 ? "down" : "up"} ${Math.abs(pctChange * 100).toFixed(0)}% from ${Math.round(refundPrevious)}ms.`,
        })
      }
    }

    const kbCurrent = avgLatencyByTool(currentCalls, "kb_search")
    const kbPrevious = avgLatencyByTool(previousCalls, "kb_search")
    if (kbCurrent !== null) {
      const highestOfAll = TOOL_NAMES.every((tool) => (avgLatencyByTool(currentCalls, tool) ?? 0) <= kbCurrent)
      const rising = kbPrevious !== null && kbCurrent > kbPrevious
      if (highestOfAll && rising && kbPrevious !== null) {
        insights.push({
          id: "kb-bottleneck",
          tone: "warning",
          title: "Knowledge Base becoming a bottleneck",
          description: `Averaging ${Math.round(kbCurrent)}ms — the slowest tool this period, up from ${Math.round(kbPrevious)}ms.`,
        })
      }
    }
  }

  const intentCounts = new Map<string, number>()
  for (const conv of currentSet) {
    intentCounts.set(conv.intent_label, (intentCounts.get(conv.intent_label) ?? 0) + 1)
  }
  const topIntent = Array.from(intentCounts.entries()).sort((a, b) => b[1] - a[1])[0]
  if (topIntent) {
    const [label, count] = topIntent
    insights.push({
      id: "top-intent",
      tone: "neutral",
      title: `Most common intent: ${formatIntentLabel(label)}`,
      description: `${count} conversations (${((count / currentSet.length) * 100).toFixed(0)}% of this period).`,
    })
  }

  const retryByIntent = new Map<string, { sum: number; count: number }>()
  for (const conv of currentSet) {
    const entry = retryByIntent.get(conv.intent_label) ?? { sum: 0, count: 0 }
    entry.sum += conv.replanning_count
    entry.count += 1
    retryByIntent.set(conv.intent_label, entry)
  }
  const topRetry = Array.from(retryByIntent.entries())
    .filter(([, stat]) => stat.count >= 3)
    .map(([label, stat]) => ({ label, avg: stat.sum / stat.count }))
    .sort((a, b) => b.avg - a.avg)[0]
  if (topRetry && topRetry.avg >= 0.5) {
    insights.push({
      id: "top-retry",
      tone: "warning",
      title: `Highest retry workflow: ${formatIntentLabel(topRetry.label)}`,
      description: `Averaging ${topRetry.avg.toFixed(1)} replans per ticket this period.`,
    })
  }

  return insights.slice(0, 6)
}

export function computeAnalyticsSummary(params: AnalyticsQueryFilters): AnalyticsSummaryResponse {
  const { currentSet, previousSet } = currentAndPrevious(params)
  const current = computeRawMetrics(currentSet)
  const previous = computeRawMetrics(previousSet)

  const summary: AnalyticsSummary = {
    total_conversations: kpi(current.total, previous.total),
    resolved: kpi(current.resolved, previous.resolved),
    escalated: kpi(current.escalated, previous.escalated),
    resolution_rate: kpi(current.resolutionRate, previous.resolutionRate),
    avg_resolution_time_ms: kpi(current.avgResolutionTimeMs, previous.avgResolutionTimeMs),
    avg_tool_calls: kpi(current.avgToolCalls, previous.avgToolCalls),
    avg_memory_hit_rate: kpi(current.avgMemoryHitRate, previous.avgMemoryHitRate),
    avg_retries: kpi(current.avgRetries, previous.avgRetries),
    avg_latency_ms: kpi(current.avgLatencyMs, previous.avgLatencyMs),
    avg_confidence: kpi(current.avgConfidence, previous.avgConfidence),
  }

  return { summary, insights: computeInsights(currentSet, previousSet, summary) }
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

function buildDayRange(fromMs: number, toMs: number): string[] {
  const days: string[] = []
  let cursor = new Date(fromMs)
  cursor.setUTCHours(0, 0, 0, 0)
  const end = new Date(toMs)
  end.setUTCHours(0, 0, 0, 0)
  while (cursor.getTime() <= end.getTime()) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor = new Date(cursor.getTime() + 86_400_000)
  }
  return days
}

export function computeAnalyticsCharts(params: AnalyticsQueryFilters): AnalyticsChartsResponse {
  const { currentSet, current } = currentAndPrevious(params)
  const days = buildDayRange(current.from, current.to)

  const byDay = new Map<string, ConversationDetail[]>()
  for (const day of days) byDay.set(day, [])
  for (const conv of currentSet) {
    byDay.get(dayKey(conv.created_at))?.push(conv)
  }

  const conversation_volume: AnalyticsTrendPoint[] = days.map((day) => ({
    date: day,
    value: (byDay.get(day) ?? []).length,
  }))
  const resolution_trend: AnalyticsTrendPoint[] = days.map((day) => {
    const list = byDay.get(day) ?? []
    const resolved = list.filter((conv) => conv.status === "resolved").length
    return { date: day, value: list.length > 0 ? Number(((resolved / list.length) * 100).toFixed(1)) : 0 }
  })
  const escalation_trend: AnalyticsTrendPoint[] = days.map((day) => {
    const list = byDay.get(day) ?? []
    const escalated = list.filter((conv) => conv.status === "escalated").length
    return { date: day, value: list.length > 0 ? Number(((escalated / list.length) * 100).toFixed(1)) : 0 }
  })
  const latency_trend: AnalyticsTrendPoint[] = days.map((day) => ({
    date: day,
    value: Math.round(mean((byDay.get(day) ?? []).map((conv) => conv.latency_ms))),
  }))
  const retry_trend: AnalyticsTrendPoint[] = days.map((day) => ({
    date: day,
    value: Number(mean((byDay.get(day) ?? []).map((conv) => conv.replanning_count)).toFixed(2)),
  }))

  const currentCalls = flattenToolCalls(currentSet, params.tool)
  const toolCounts = new Map<string, number>()
  const toolFailureCounts = new Map<string, number>()
  for (const call of currentCalls) {
    toolCounts.set(call.tool_name, (toolCounts.get(call.tool_name) ?? 0) + 1)
    if (!call.success && call.failure_type) {
      toolFailureCounts.set(call.failure_type, (toolFailureCounts.get(call.failure_type) ?? 0) + 1)
    }
  }
  const tool_usage: AnalyticsCategoryPoint[] = TOOL_NAMES.filter(
    (tool) => params.tool.length === 0 || params.tool.includes(tool),
  ).map((tool) => ({ label: toolLabel(tool), value: toolCounts.get(tool) ?? 0 }))

  const tool_failure_distribution: AnalyticsCategoryPoint[] = Array.from(toolFailureCounts.entries())
    .map(([failureType, count]) => ({ label: failureType, value: count }))
    .sort((a, b) => b.value - a.value)

  const filteredMemory = filterMemoryEntries(params)
  const memoryUsageByType = new Map<string, number>()
  for (const entry of filteredMemory) {
    memoryUsageByType.set(entry.memory_type, (memoryUsageByType.get(entry.memory_type) ?? 0) + entry.usage_count)
  }
  const memory_usage: AnalyticsCategoryPoint[] = MEMORY_TYPES.filter(
    (type) => params.memoryType.length === 0 || params.memoryType.includes(type),
  ).map((type) => ({ label: MEMORY_TYPE_LABELS[type], value: memoryUsageByType.get(type) ?? 0 }))

  const intentCounts = new Map<string, number>()
  for (const conv of currentSet) {
    intentCounts.set(conv.intent_label, (intentCounts.get(conv.intent_label) ?? 0) + 1)
  }
  const intent_distribution: AnalyticsCategoryPoint[] = Array.from(intentCounts.entries())
    .map(([label, value]) => ({ label: formatIntentLabel(label), value }))
    .sort((a, b) => b.value - a.value)

  const intentResolution = new Map<string, { resolved: number; total: number }>()
  for (const conv of currentSet) {
    const entry = intentResolution.get(conv.intent_label) ?? { resolved: 0, total: 0 }
    entry.total += 1
    if (conv.status === "resolved") entry.resolved += 1
    intentResolution.set(conv.intent_label, entry)
  }
  const resolution_success_by_intent: AnalyticsCategoryPoint[] = Array.from(intentResolution.entries())
    .map(([label, stat]) => ({
      label: formatIntentLabel(label),
      value: stat.total > 0 ? Number(((stat.resolved / stat.total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.value - a.value)

  return {
    conversation_volume,
    resolution_trend,
    escalation_trend,
    latency_trend,
    tool_usage,
    memory_usage,
    retry_trend,
    intent_distribution,
    tool_failure_distribution,
    resolution_success_by_intent,
  }
}

export function computeAnalyticsTables(params: AnalyticsQueryFilters): AnalyticsTablesResponse {
  const { currentSet } = currentAndPrevious(params)

  const byCustomer = new Map<string, { name: string; tickets: ConversationDetail[] }>()
  for (const conv of currentSet) {
    const entry = byCustomer.get(conv.customer_id) ?? { name: conv.customer_name, tickets: [] }
    entry.tickets.push(conv)
    byCustomer.set(conv.customer_id, entry)
  }
  const top_customers: TopCustomerRow[] = Array.from(byCustomer.entries())
    .map(([customerId, entry]) => ({
      customer_id: customerId,
      customer_name: entry.name,
      ticket_count: entry.tickets.length,
      resolution_rate: entry.tickets.filter((ticket) => ticket.status === "resolved").length / entry.tickets.length,
      avg_latency_ms: Math.round(mean(entry.tickets.map((ticket) => ticket.latency_ms))),
    }))
    .sort((a, b) => b.ticket_count - a.ticket_count)
    .slice(0, 10)

  const currentCalls = flattenToolCalls(currentSet, params.tool)
  const failureMap = new Map<
    string,
    { tool_name: string; failure_type: string; count: number; lastSeen: string }
  >()
  for (const call of currentCalls) {
    if (call.success || !call.failure_type) continue
    const key = `${call.tool_name}::${call.failure_type}`
    const entry = failureMap.get(key) ?? {
      tool_name: call.tool_name,
      failure_type: call.failure_type,
      count: 0,
      lastSeen: call.timestamp,
    }
    entry.count += 1
    if (new Date(call.timestamp).getTime() > new Date(entry.lastSeen).getTime()) entry.lastSeen = call.timestamp
    failureMap.set(key, entry)
  }
  const top_tool_failures: TopToolFailureRow[] = Array.from(failureMap.values())
    .map((entry) => ({
      tool_name: entry.tool_name,
      failure_type: entry.failure_type,
      count: entry.count,
      last_seen: entry.lastSeen,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const highest_retry_conversations: HighRetryConversationRow[] = [...currentSet]
    .sort((a, b) => b.replanning_count - a.replanning_count)
    .slice(0, 10)
    .map((conv) => ({
      ticket_id: conv.ticket_id,
      customer_name: conv.customer_name,
      intent_label: conv.intent_label,
      status: conv.status,
      replanning_count: conv.replanning_count,
    }))

  const longest_resolution_times: LongResolutionRow[] = currentSet
    .filter((conv): conv is ConversationDetail & { resolved_at: string } => conv.status === "resolved" && conv.resolved_at !== null)
    .map((conv) => ({
      ticket_id: conv.ticket_id,
      customer_name: conv.customer_name,
      intent_label: conv.intent_label,
      resolution_time_ms: new Date(conv.resolved_at).getTime() - new Date(conv.created_at).getTime(),
      resolved_at: conv.resolved_at,
    }))
    .sort((a, b) => b.resolution_time_ms - a.resolution_time_ms)
    .slice(0, 10)

  const filteredMemory = filterMemoryEntries(params)
  const most_frequent_memories: FrequentMemoryRow[] = [...filteredMemory]
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, 10)
    .map((entry) => ({
      id: entry.id,
      memory_type: entry.memory_type,
      summary: entry.summary,
      usage_count: entry.usage_count,
      last_retrieved_at: entry.last_retrieved_at,
      confidence: entry.confidence,
    }))

  return {
    top_customers,
    top_tool_failures,
    highest_retry_conversations,
    longest_resolution_times,
    most_frequent_memories,
  }
}
