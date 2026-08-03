import { conversationsFixture } from "@/services/mock/fixtures/conversations"
import { TOOL_DESCRIPTIONS, TOOL_NAMES, TOOL_PURPOSES, type ToolName } from "@/lib/tools"
import type {
  CircuitBreakerState,
  ToolDetail,
  ToolEventStatus,
  ToolHealth,
  ToolHistoryPoint,
  ToolHistoryResponse,
  ToolRequestRecord,
  ToolStats,
  ToolStatus,
  ToolTimelineEvent,
} from "@/types/mocked"

/** Deterministic per-tool PRNG (mulberry32) — same approach as fixtures/execution.ts, kept
 * independent of the shared faker singleton so generation order never matters. */
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

interface ToolProfile {
  status: ToolStatus
  circuitState: CircuitBreakerState
  baseLatencyMs: number
  successRate: number
}

/** Hand-tuned per-tool health so the dashboard tells a coherent operational story — mirrors the
 * "kb_search degraded, refund circuit open" scenario already referenced in the approved frontend
 * plan's user journeys, rather than uniformly random health across all 4 tools. */
const TOOL_PROFILES: Record<ToolName, ToolProfile> = {
  crm: { status: "healthy", circuitState: "closed", baseLatencyMs: 220, successRate: 0.98 },
  order_lookup: { status: "healthy", circuitState: "closed", baseLatencyMs: 340, successRate: 0.97 },
  kb_search: { status: "degraded", circuitState: "half_open", baseLatencyMs: 890, successRate: 0.87 },
  refund: { status: "offline", circuitState: "open", baseLatencyMs: 610, successRate: 0.79 },
}

const FAILURE_TYPES = ["timeout", "ambiguous_data", "wrong_result"]
const REQUEST_HISTORY_DAYS = 14
const REQUESTS_PER_TOOL = 90

function pickTicketId(rng: () => number): string {
  const index = Math.floor(rng() * conversationsFixture.length)
  return conversationsFixture[index]!.ticket_id
}

function buildRequests(toolName: ToolName, profile: ToolProfile, rng: () => number): ToolRequestRecord[] {
  const requests: ToolRequestRecord[] = []
  const now = Date.now()
  for (let index = 0; index < REQUESTS_PER_TOOL; index++) {
    const ageMs = rng() * REQUEST_HISTORY_DAYS * 86_400_000
    const timestamp = new Date(now - ageMs).toISOString()
    const success = rng() < profile.successRate
    const jitter = 0.6 + rng() * 0.9
    requests.push({
      id: `${toolName}-req-${index + 1}`,
      timestamp,
      ticket_id: pickTicketId(rng),
      duration_ms: Math.max(40, Math.round(profile.baseLatencyMs * jitter)),
      status: success ? "success" : "failed",
      failure_type: success ? null : FAILURE_TYPES[Math.floor(rng() * FAILURE_TYPES.length)]!,
    })
  }
  return requests.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

function buildTimeline(toolName: ToolName, profile: ToolProfile, requests: ToolRequestRecord[]): ToolTimelineEvent[] {
  const events: ToolTimelineEvent[] = []
  const recent = requests.slice(0, 12)
  recent.forEach((request) => {
    const status: ToolEventStatus = request.status === "success" ? "success" : "failed"
    events.push({
      id: `${request.id}-event`,
      timestamp: request.timestamp,
      label: request.status === "success" ? `${toolName} lookup succeeded` : `${toolName} lookup failed`,
      detail:
        request.status === "success"
          ? `Completed in ${request.duration_ms}ms for ticket ${request.ticket_id}.`
          : `Failed (${request.failure_type}) for ticket ${request.ticket_id}.`,
      status,
    })
  })

  if (profile.circuitState === "open" || profile.circuitState === "half_open") {
    const openedAt = recent[3]?.timestamp ?? new Date().toISOString()
    events.push({
      id: `${toolName}-circuit-open`,
      timestamp: openedAt,
      label: "Circuit breaker opened",
      detail: "3 consecutive failures — requests now fail fast for a 60s cooldown.",
      status: "circuit_open",
    })
    if (profile.circuitState === "half_open") {
      const closedAt = recent[1]?.timestamp ?? new Date().toISOString()
      events.push({
        id: `${toolName}-circuit-half-open`,
        timestamp: closedAt,
        label: "Circuit breaker half-open",
        detail: "Cooldown elapsed — a trial request will decide whether to close or re-open.",
        status: "circuit_half_open",
      })
    }
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

function buildToolDetail(toolName: ToolName): ToolDetail {
  const profile = TOOL_PROFILES[toolName]
  const rng = mulberry32(hashSeed(toolName))
  const requests = buildRequests(toolName, profile, rng)
  const failedRequests = requests.filter((request) => request.status === "failed")
  const retryCount24h = requests.filter(
    (request) => Date.now() - new Date(request.timestamp).getTime() < 86_400_000 && request.status === "failed",
  ).length
  const durations = requests.map((request) => request.duration_ms).sort((a, b) => a - b)
  const percentile = (p: number): number => {
    if (durations.length === 0) return 0
    const index = Math.min(durations.length - 1, Math.floor(durations.length * p))
    return durations[index]!
  }
  const lastRequest = requests[0] ?? null
  const lastFailed = failedRequests[0] ?? null

  const health: ToolHealth = {
    tool_name: toolName,
    description: TOOL_DESCRIPTIONS[toolName]!,
    purpose: TOOL_PURPOSES[toolName]!,
    status: profile.status,
    availability: Number((profile.successRate * 100).toFixed(1)),
    avg_latency_ms: Math.round(durations.reduce((sum, d) => sum + d, 0) / Math.max(durations.length, 1)),
    p95_latency_ms: percentile(0.95),
    p99_latency_ms: percentile(0.99),
    success_rate: Number((requests.filter((r) => r.status === "success").length / requests.length).toFixed(3)),
    failure_rate: Number((failedRequests.length / requests.length).toFixed(3)),
    retry_rate: Number((retryCount24h / Math.max(requests.length, 1)).toFixed(3)),
    retry_count_24h: retryCount24h,
    circuit_breaker_state: profile.circuitState,
    last_used_at: lastRequest?.timestamp ?? null,
    last_error: lastFailed
      ? { timestamp: lastFailed.timestamp, message: `Request failed: ${lastFailed.failure_type}`, failure_type: lastFailed.failure_type! }
      : null,
  }

  return {
    ...health,
    recent_requests: requests.slice(0, 15),
    recent_errors: failedRequests
      .slice(0, 10)
      .map((request) => ({
        timestamp: request.timestamp,
        message: `Request failed for ticket ${request.ticket_id}: ${request.failure_type}`,
        failure_type: request.failure_type!,
      })),
    timeline: buildTimeline(toolName, profile, requests),
  }
}

const toolDetailCache = new Map<string, ToolDetail>()

function getToolDetail(toolName: string): ToolDetail | null {
  if (!TOOL_NAMES.includes(toolName as ToolName)) return null
  const cached = toolDetailCache.get(toolName)
  if (cached) return cached
  const detail = buildToolDetail(toolName as ToolName)
  toolDetailCache.set(toolName, detail)
  return detail
}

export function listToolHealth(): ToolHealth[] {
  return TOOL_NAMES.map((toolName) => {
    const { recent_requests: _requests, recent_errors: _errors, timeline: _timeline, ...health } = getToolDetail(toolName)!
    return health
  })
}

export function getToolDetailById(toolName: string): ToolDetail | null {
  return getToolDetail(toolName)
}

export function getToolHistory(toolName: string): ToolHistoryResponse | null {
  const detail = getToolDetail(toolName)
  if (!detail) return null
  const points: ToolHistoryPoint[] = [...detail.recent_requests]
    .reverse()
    .map((request) => ({
      timestamp: request.timestamp,
      latency_ms: request.duration_ms,
      success: request.status === "success",
    }))
  return { tool_name: toolName, points }
}

const TREND_DAYS = 21

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function computeToolStats(): ToolStats {
  const allDetails = TOOL_NAMES.map((toolName) => getToolDetail(toolName)!)
  // recent_requests on ToolDetail is capped at 15 for the inspector — stats need the full
  // per-tool history, so rebuild it here (same seed, so deterministic and identical to what
  // buildToolDetail generated).
  const fullRequests = TOOL_NAMES.flatMap((toolName) => {
    const rng = mulberry32(hashSeed(toolName))
    return buildRequests(toolName, TOOL_PROFILES[toolName], rng)
  })

  const healthyCount = allDetails.filter((d) => d.status === "healthy").length
  const degradedCount = allDetails.filter((d) => d.status === "degraded").length
  const offlineCount = allDetails.filter((d) => d.status === "offline").length
  const circuitBreakersOpen = allDetails.filter((d) => d.circuit_breaker_state === "open").length

  const latencyByDay = new Map<string, number[]>()
  const successByDay = new Map<string, number>()
  const failureByDay = new Map<string, number>()
  const retryByDay = new Map<string, number>()
  const usageByTool = new Map<string, number>()
  const errorsByType = new Map<string, number>()
  const latencyBuckets = [
    { label: "0–200ms", max: 200 },
    { label: "200–500ms", max: 500 },
    { label: "500–1000ms", max: 1000 },
    { label: "1000–2000ms", max: 2000 },
    { label: "2000ms+", max: Infinity },
  ]
  const histogramCounts = latencyBuckets.map(() => 0)

  for (const request of fullRequests) {
    const key = dayKey(new Date(request.timestamp))
    if (!latencyByDay.has(key)) latencyByDay.set(key, [])
    latencyByDay.get(key)!.push(request.duration_ms)
    if (request.status === "success") {
      successByDay.set(key, (successByDay.get(key) ?? 0) + 1)
    } else {
      failureByDay.set(key, (failureByDay.get(key) ?? 0) + 1)
      retryByDay.set(key, (retryByDay.get(key) ?? 0) + 1)
      errorsByType.set(request.failure_type!, (errorsByType.get(request.failure_type!) ?? 0) + 1)
    }
    const bucketIndex = latencyBuckets.findIndex((bucket) => request.duration_ms <= bucket.max)
    histogramCounts[bucketIndex >= 0 ? bucketIndex : histogramCounts.length - 1]!++
  }

  for (const toolName of TOOL_NAMES) {
    usageByTool.set(toolName, fullRequests.filter((r) => r.id.startsWith(`${toolName}-req-`)).length)
  }

  const latencyTrend = Array.from({ length: TREND_DAYS }, (_, offset) => {
    const date = new Date(Date.now() - (TREND_DAYS - 1 - offset) * 86_400_000)
    const key = dayKey(date)
    const values = latencyByDay.get(key) ?? []
    const avg = values.length > 0 ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : 0
    return { date: key, avg_latency_ms: avg }
  })
  const successTrend = Array.from({ length: TREND_DAYS }, (_, offset) => {
    const date = new Date(Date.now() - (TREND_DAYS - 1 - offset) * 86_400_000)
    const key = dayKey(date)
    return { date: key, count: successByDay.get(key) ?? 0 }
  })
  const failureTrend = Array.from({ length: TREND_DAYS }, (_, offset) => {
    const date = new Date(Date.now() - (TREND_DAYS - 1 - offset) * 86_400_000)
    const key = dayKey(date)
    return { date: key, count: failureByDay.get(key) ?? 0 }
  })
  const retryTrend = Array.from({ length: TREND_DAYS }, (_, offset) => {
    const date = new Date(Date.now() - (TREND_DAYS - 1 - offset) * 86_400_000)
    const key = dayKey(date)
    return { date: key, count: retryByDay.get(key) ?? 0 }
  })

  return {
    total_tools: TOOL_NAMES.length,
    healthy_count: healthyCount,
    degraded_count: degradedCount,
    offline_count: offlineCount,
    avg_latency_ms: Math.round(
      allDetails.reduce((sum, d) => sum + d.avg_latency_ms, 0) / allDetails.length,
    ),
    success_rate: Number(
      (allDetails.reduce((sum, d) => sum + d.success_rate, 0) / allDetails.length).toFixed(3),
    ),
    retry_rate: Number(
      (allDetails.reduce((sum, d) => sum + d.retry_rate, 0) / allDetails.length).toFixed(3),
    ),
    circuit_breakers_open: circuitBreakersOpen,
    latency_trend: latencyTrend,
    success_trend: successTrend,
    failure_trend: failureTrend,
    retry_trend: retryTrend,
    usage_frequency: TOOL_NAMES.map((toolName) => ({
      tool_name: toolName,
      count: usageByTool.get(toolName) ?? 0,
    })),
    error_distribution: Array.from(errorsByType.entries()).map(([failure_type, count]) => ({
      failure_type,
      count,
    })),
    response_time_histogram: latencyBuckets.map((bucket, index) => ({
      bucket: bucket.label,
      count: histogramCounts[index]!,
    })),
  }
}
