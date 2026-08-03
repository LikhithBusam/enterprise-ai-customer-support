/** Mirrors the real research dataset's 6 intent clusters (data/synthetic_tickets_v2.jsonl) —
 * shared across Conversations columns, Conversation Detail, and Live Agent Execution. */
export const INTENT_LABELS: Record<string, string> = {
  refund_request: "Refund request",
  order_status: "Order status",
  billing_dispute: "Billing dispute",
  account_issue: "Account issue",
  complaint_escalation: "Complaint escalation",
  general_inquiry: "General inquiry",
}

export function formatIntentLabel(intentLabel: string): string {
  return INTENT_LABELS[intentLabel] ?? intentLabel
}
