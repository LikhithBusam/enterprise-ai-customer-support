import { faker } from "@faker-js/faker"
import { conversationsFixture } from "@/services/mock/fixtures/conversations"
import { INTENT_LABELS, formatIntentLabel } from "@/lib/intent-labels"
import { MEMORY_TYPES } from "@/lib/memory-types"
import type { MemoryEntryBase, MemoryStats, MemoryStatus, MemoryType } from "@/types/mocked"

faker.seed(7714)

const INTENT_KEYS = Object.keys(INTENT_LABELS)
const TOOL_NAMES = ["crm", "order_lookup", "kb_search", "refund"]
const FAILURE_TYPES = ["timeout", "ambiguous_data", "wrong_result"]

interface TypeConfig {
  type: MemoryType
  count: number
}

const TYPE_CONFIG: TypeConfig[] = [
  { type: "episodic", count: 70 },
  { type: "plan_success", count: 55 },
  { type: "tool_failure", count: 35 },
  { type: "escalation", count: 14 },
  { type: "policy", count: 18 },
]

function pickIntent(): string {
  return faker.helpers.arrayElement(INTENT_KEYS)
}

function pickTicketId(): string {
  return faker.helpers.arrayElement(conversationsFixture).ticket_id
}

function deriveStatus(timestamp: Date, lastRetrievedAt: Date | null, usageCount: number): MemoryStatus {
  const daysSinceCreated = (Date.now() - timestamp.getTime()) / 86_400_000
  if (usageCount === 0 && daysSinceCreated > 30) return "archived"
  const daysSinceRetrieved = lastRetrievedAt
    ? (Date.now() - lastRetrievedAt.getTime()) / 86_400_000
    : null
  if (daysSinceRetrieved === null || daysSinceRetrieved > 14) return "stale"
  return "active"
}

function buildCommonFields(type: MemoryType, index: number): Pick<
  MemoryEntryBase,
  "id" | "memory_type" | "client_id" | "timestamp" | "last_retrieved_at" | "similarity_score" | "retrieved" | "usage_count" | "confidence" | "status"
> {
  const timestamp = faker.date.recent({ days: 45 })
  const usageCount = faker.helpers.weightedArrayElement([
    { value: 0, weight: 35 },
    { value: faker.number.int({ min: 1, max: 3 }), weight: 35 },
    { value: faker.number.int({ min: 4, max: 12 }), weight: 22 },
    { value: faker.number.int({ min: 13, max: 40 }), weight: 8 },
  ])
  const retrieved = usageCount > 0
  const lastRetrievedAt = retrieved ? faker.date.between({ from: timestamp, to: new Date() }) : null
  const similarityScore = retrieved ? Number((0.62 + faker.number.float({ min: 0, max: 0.37 })).toFixed(3)) : null

  return {
    id: `${type}-${String(index + 1).padStart(4, "0")}`,
    memory_type: type,
    client_id: "acme_retail",
    timestamp: timestamp.toISOString(),
    last_retrieved_at: lastRetrievedAt ? lastRetrievedAt.toISOString() : null,
    similarity_score: similarityScore,
    retrieved,
    usage_count: usageCount,
    confidence: Number((0.55 + faker.number.float({ min: 0, max: 0.43 })).toFixed(2)),
    status: deriveStatus(timestamp, lastRetrievedAt, usageCount),
  }
}

function buildEpisodic(index: number): MemoryEntryBase {
  const common = buildCommonFields("episodic", index)
  const intent = pickIntent()
  const ticketId = pickTicketId()
  const resolved = faker.datatype.boolean({ probability: 0.85 })
  return {
    ...common,
    tags: [intent, resolved ? "resolved" : "escalated"],
    summary: `Ticket ${ticketId} (${formatIntentLabel(intent)}) — ${resolved ? "resolved automatically" : "escalated to a human agent"}.`,
    source: "memory_manager",
    related_ticket_id: ticketId,
    explanation:
      "Retrieved by the Planner when a new ticket's message embedding is similar, giving it a concrete precedent to reason from.",
    raw: {
      ticket_id: ticketId,
      intent_cluster: intent,
      resolved,
      created_at: common.timestamp,
    },
  }
}

function buildPlanSuccess(index: number): MemoryEntryBase {
  const common = buildCommonFields("plan_success", index)
  const intent = pickIntent()
  const toolSequence = faker.helpers.arrayElements(TOOL_NAMES, { min: 2, max: 4 })
  const ticketId = pickTicketId()
  return {
    ...common,
    tags: [intent, ...toolSequence],
    summary: `Successful plan for ${formatIntentLabel(intent)}: ${toolSequence.join(" → ")}.`,
    source: "planner_agent",
    related_ticket_id: ticketId,
    explanation:
      "Reused by the Planner as a template DAG for new tickets sharing this intent, instead of planning from scratch.",
    raw: {
      intent_cluster: intent,
      tool_sequence: toolSequence,
      parameterized_message: `I need help with my ${formatIntentLabel(intent).toLowerCase()}.`,
      usage_count: common.usage_count,
    },
  }
}

function buildToolFailure(index: number): MemoryEntryBase {
  const common = buildCommonFields("tool_failure", index)
  const toolName = faker.helpers.arrayElement(TOOL_NAMES)
  const failureType = faker.helpers.arrayElement(FAILURE_TYPES)
  const intent = pickIntent()
  const ticketId = pickTicketId()
  return {
    ...common,
    tags: [toolName, failureType],
    summary: `"${toolName}" failed with ${failureType} on ${formatIntentLabel(intent)} tickets.`,
    source: "critic_agent",
    related_ticket_id: ticketId,
    explanation:
      "Used to adjust tool-reliability scoring during replanning — a tool with recent failures is deprioritized in favor of an alternative path.",
    raw: {
      tool_name: toolName,
      failure_type: failureType,
      context: `Observed during ${formatIntentLabel(intent).toLowerCase()} handling.`,
      occurred_at: common.timestamp,
    },
  }
}

function buildEscalation(index: number): MemoryEntryBase {
  const common = buildCommonFields("escalation", index)
  const intent = pickIntent()
  const ticketId = pickTicketId()
  const attempts = faker.number.int({ min: 2, max: 3 })
  return {
    ...common,
    tags: [intent, "escalated"],
    summary: `Ticket ${ticketId} escalated after ${attempts} replanning attempts.`,
    source: "escalation_agent",
    related_ticket_id: ticketId,
    explanation:
      "Flags a pattern the automated pipeline couldn't resolve — surfaced so a human correction can eventually be captured and fed back in.",
    raw: {
      ticket_id: ticketId,
      intent_cluster: intent,
      replanning_attempts: attempts,
      human_correction: null,
    },
  }
}

function buildPolicy(index: number): MemoryEntryBase {
  const common = buildCommonFields("policy", index)
  const intent = pickIntent()
  const toolSequence = faker.helpers.arrayElements(TOOL_NAMES, { min: 2, max: 4 })
  return {
    ...common,
    tags: [intent, "policy", "research"],
    summary: `Workflow template for ${formatIntentLabel(intent)}: ${toolSequence.join(" → ")}.`,
    source: "policy_memory_writer",
    related_ticket_id: null,
    explanation:
      "Contribution 2 research feature — a reusable workflow template keyed by intent cluster, upserted (not appended) as usage reinforces it. Not wired into production.",
    raw: {
      policy_id: `${intent}::${toolSequence.join("-")}`,
      intent_cluster: intent,
      workflow_template: toolSequence,
      dependency_graph: toolSequence.map((tool, i) => ({ tool, depends_on: i === 0 ? [] : [toolSequence[i - 1]] })),
      usage_count: common.usage_count,
    },
  }
}

const BUILDERS: Record<MemoryType, (index: number) => MemoryEntryBase> = {
  episodic: buildEpisodic,
  plan_success: buildPlanSuccess,
  tool_failure: buildToolFailure,
  escalation: buildEscalation,
  policy: buildPolicy,
}

export const memoryFixture: MemoryEntryBase[] = TYPE_CONFIG.flatMap(({ type, count }) =>
  Array.from({ length: count }, (_, index) => BUILDERS[type](index)),
).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

const TREND_DAYS = 21
const SIMILARITY_BUCKETS = ["0.6–0.7", "0.7–0.8", "0.8–0.9", "0.9–1.0"]

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function buildDailyTrend(dates: Date[]): { date: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const date of dates) {
    const key = dayKey(date)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const points: { date: string; count: number }[] = []
  for (let offset = TREND_DAYS - 1; offset >= 0; offset--) {
    const date = new Date(Date.now() - offset * 86_400_000)
    const key = dayKey(date)
    points.push({ date: key, count: counts.get(key) ?? 0 })
  }
  return points
}

export function computeMemoryStats(entries: MemoryEntryBase[]): MemoryStats {
  const total = entries.length
  const activeCount = entries.filter((entry) => entry.status === "active").length
  const retrievedCount = entries.filter((entry) => entry.retrieved).length
  const similarities = entries
    .map((entry) => entry.similarity_score)
    .filter((score): score is number => score !== null)

  const byType = MEMORY_TYPES.map((type) => ({
    memory_type: type,
    count: entries.filter((entry) => entry.memory_type === type).length,
  }))

  const histogram = SIMILARITY_BUCKETS.map((bucket, index) => {
    const low = 0.6 + index * 0.1
    const high = low + 0.1
    return {
      bucket,
      count: similarities.filter((score) => score >= low && (index === SIMILARITY_BUCKETS.length - 1 ? score <= high : score < high)).length,
    }
  })

  return {
    total_count: total,
    active_count: activeCount,
    retrieved_rate: total > 0 ? retrievedCount / total : 0,
    avg_confidence: total > 0 ? entries.reduce((sum, entry) => sum + entry.confidence, 0) / total : 0,
    avg_similarity:
      similarities.length > 0 ? similarities.reduce((sum, score) => sum + score, 0) / similarities.length : null,
    by_type: byType,
    usage_trend: buildDailyTrend(entries.map((entry) => new Date(entry.timestamp))),
    retrieval_frequency: buildDailyTrend(
      entries.filter((entry) => entry.last_retrieved_at).map((entry) => new Date(entry.last_retrieved_at!)),
    ),
    similarity_histogram: histogram,
  }
}
