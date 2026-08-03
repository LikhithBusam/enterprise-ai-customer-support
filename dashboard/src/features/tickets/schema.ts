import { z } from "zod"

/** A convenience shortlist, not an enum — the real backend's `intent_label` (src/api/schemas.py)
 * accepts any string, and an empty string means "classify it automatically" rather than "no
 * intent" (see TicketRequest's own doc comment there). */
export const TICKET_INTENT_OPTIONS = [
  { value: "", label: "Auto-detect" },
  { value: "refund_request", label: "Refund request" },
  { value: "order_status", label: "Order status" },
  { value: "billing_dispute", label: "Billing dispute" },
  { value: "account_issue", label: "Account issue" },
  { value: "complaint_escalation", label: "Complaint escalation" },
  { value: "general_inquiry", label: "General inquiry" },
]

export const ticketFormSchema = z.object({
  customer_id: z.string().trim().min(1, "Customer ID is required").max(100, "Must be at most 100 characters"),
  customer_message: z
    .string()
    .trim()
    .min(10, "Describe the issue in at least 10 characters")
    .max(4000, "Must be at most 4000 characters"),
  intent_label: z.string(),
})
export type TicketFormValues = z.infer<typeof ticketFormSchema>
