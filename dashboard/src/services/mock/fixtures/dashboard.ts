import { conversationsFixture } from "@/services/mock/fixtures/conversations"
import type { ActivityFeedItem, DashboardSummary, TicketStatus } from "@/types/mocked"

/** Deterministic fixture — grounded in realistic ranges, not randomized per request, so the UI
 * doesn't visibly jitter between refetches during development. */
export const dashboardSummaryFixture: DashboardSummary = {
  tickets_today: 342,
  tickets_open: 18,
  tickets_resolved: 324,
  success_rate: 0.947,
  avg_latency_ms: 4820,
  avg_resolution_time_ms: 9400,
  escalation_rate: 0.061,
  memory_hit_rate: 0.882,
  policy_retrieval_rate: 0.734,
  tool_success_rate: 0.958,
  llm_tokens_today: 1284500,
  agent_health: "healthy",
}

/** Real ticket_id pulled from the conversations fixture (matching the activity item's own status)
 * so every Dashboard "Live activity" link resolves to an actual conversation — and, since
 * execution.ts derives its trace from conversationsFixture.find() for any valid ticket_id, an
 * actual execution trace too — instead of a disconnected placeholder ID. */
function ticketIdWithStatus(status: TicketStatus, offset: number): string {
  const matches = conversationsFixture.filter((conversation) => conversation.status === status)
  return matches[offset % matches.length]!.ticket_id
}

export const activityFeedFixture: ActivityFeedItem[] = [
  {
    id: "act-1",
    ticket_id: ticketIdWithStatus("resolved", 0),
    message: "Refund request resolved via policy memory",
    status: "resolved",
    timestamp: new Date(Date.now() - 2 * 60_000).toISOString(),
  },
  {
    id: "act-2",
    ticket_id: ticketIdWithStatus("escalated", 0),
    message: "Escalated after 3 replanning attempts — kb_search timeout",
    status: "escalated",
    timestamp: new Date(Date.now() - 6 * 60_000).toISOString(),
  },
  {
    id: "act-3",
    ticket_id: ticketIdWithStatus("resolved", 1),
    message: "Order status lookup resolved",
    status: "resolved",
    timestamp: new Date(Date.now() - 11 * 60_000).toISOString(),
  },
  {
    id: "act-4",
    ticket_id: ticketIdWithStatus("in_progress", 0),
    message: "Billing dispute in progress — critic replanning",
    status: "in_progress",
    timestamp: new Date(Date.now() - 14 * 60_000).toISOString(),
  },
  {
    id: "act-5",
    ticket_id: ticketIdWithStatus("resolved", 2),
    message: "Account issue resolved via cached policy",
    status: "resolved",
    timestamp: new Date(Date.now() - 22 * 60_000).toISOString(),
  },
]
