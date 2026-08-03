import { faker } from "@faker-js/faker"
import type { ConversationDetail, ConversationSummary, TicketStatus } from "@/types/mocked"

faker.seed(4821)

/** Mirrors the real research dataset's 6 intent clusters (data/synthetic_tickets_v2.jsonl) so
 * mocked conversation data reads as plausible rather than arbitrary. */
const INTENT_CLUSTERS: Array<{ label: string; tools: string[]; weight: number }> = [
  { label: "refund_request", tools: ["crm", "order_lookup", "refund"], weight: 21 },
  { label: "order_status", tools: ["crm", "order_lookup"], weight: 21 },
  { label: "billing_dispute", tools: ["crm", "order_lookup", "kb_search", "refund"], weight: 17 },
  { label: "account_issue", tools: ["crm", "kb_search"], weight: 16 },
  { label: "complaint_escalation", tools: ["crm", "order_lookup", "kb_search"], weight: 15 },
  { label: "general_inquiry", tools: ["kb_search"], weight: 9 },
]

const MESSAGE_TEMPLATES: Record<string, (orderId: string, amount: string) => string> = {
  refund_request: (orderId, amount) =>
    `I need a refund of ${amount} for order ${orderId}, it arrived damaged.`,
  order_status: (orderId) => `Order ${orderId} still says "processing" — where is it?`,
  billing_dispute: (orderId, amount) =>
    `I'm disputing the charge of ${amount} for order ${orderId}. I didn't authorize this.`,
  account_issue: () => `I can't log into my account, it says my password is invalid.`,
  complaint_escalation: (orderId) =>
    `This is unacceptable — order ${orderId} is the third mistake this month. I want to speak to a manager.`,
  general_inquiry: () => `What are your business hours for support?`,
}

function pickIntent(): (typeof INTENT_CLUSTERS)[number] {
  const totalWeight = INTENT_CLUSTERS.reduce((sum, cluster) => sum + cluster.weight, 0)
  let roll = faker.number.int({ min: 1, max: totalWeight })
  for (const cluster of INTENT_CLUSTERS) {
    roll -= cluster.weight
    if (roll <= 0) return cluster
  }
  return INTENT_CLUSTERS[0]!
}

function pickStatus(): TicketStatus {
  // Roughly mirrors the Dashboard fixture's overall success/escalation rates.
  const roll = faker.number.int({ min: 1, max: 100 })
  if (roll <= 82) return "resolved"
  if (roll <= 88) return "in_progress"
  if (roll <= 94) return "pending"
  if (roll <= 98) return "escalated"
  return "failed"
}

const TOTAL_CONVERSATIONS = 194

function buildConversation(index: number): ConversationDetail {
  const cluster = pickIntent()
  const status = pickStatus()
  const orderId = `ORD-${1000 + faker.number.int({ min: 1, max: 60 })}`
  const amount = `$${faker.commerce.price({ min: 12, max: 350 })}`
  const createdAt = faker.date.recent({ days: 21 })
  const resolved = status === "resolved"
  const escalated = status === "escalated"
  const replanningCount = escalated
    ? faker.number.int({ min: 2, max: 3 })
    : status === "failed"
      ? faker.number.int({ min: 1, max: 3 })
      : faker.number.int({ min: 0, max: 1 })
  const memoryHit = faker.datatype.boolean({ probability: 0.82 })
  const customerName = faker.person.fullName()

  const toolCalls = cluster.tools.map((toolName, toolIndex) => {
    const success = escalated && toolIndex === cluster.tools.length - 1 ? false : faker.datatype.boolean({ probability: 0.9 })
    return {
      tool_name: toolName,
      params: toolName === "order_lookup" || toolName === "refund" ? { order_id: orderId } : {},
      success,
      failure_type: success ? null : (faker.helpers.arrayElement(["timeout", "ambiguous_data", "wrong_result"]) as string),
      data: success ? { status: "ok" } : null,
      iteration: 1,
      duration_ms: faker.number.int({ min: 180, max: 4200 }),
    }
  })

  return {
    ticket_id: `TKT-${5000 + index}`,
    customer_id: `CUST-${faker.number.int({ min: 1, max: 200 }).toString().padStart(4, "0")}`,
    customer_name: customerName,
    customer_message: MESSAGE_TEMPLATES[cluster.label]!(orderId, amount),
    status,
    intent_label: cluster.label,
    created_at: createdAt.toISOString(),
    resolved_at: resolved ? faker.date.soon({ days: 1, refDate: createdAt }).toISOString() : null,
    replanning_count: replanningCount,
    memory_hit: memoryHit,
    latency_ms: faker.number.int({ min: 1800, max: 22000 }),
    response_message: resolved
      ? `Resolved via DAG plan. Used: ${cluster.tools.join(", ")}.`
      : escalated
        ? "Unable to fully resolve after replanning. Escalating to human agent."
        : "In progress.",
    tool_calls_made: toolCalls,
    escalation_summary: escalated
      ? `Ticket could not be auto-resolved after ${replanningCount} replanning attempts. Failed tool: ${cluster.tools[cluster.tools.length - 1]}.`
      : null,
  }
}

export const conversationsFixture: ConversationDetail[] = Array.from(
  { length: TOTAL_CONVERSATIONS },
  (_, index) => buildConversation(index),
).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

export function toSummary(detail: ConversationDetail): ConversationSummary {
  const { response_message: _response, tool_calls_made: _toolCalls, escalation_summary: _escalation, ...summary } = detail
  return summary
}
