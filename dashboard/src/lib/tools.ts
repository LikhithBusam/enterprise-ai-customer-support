import { Database, LifeBuoy, Search, Undo2, type LucideIcon } from "lucide-react"

/** The 4 real tools in the ToolRegistry (src/tools/registry.py) — mirrors the same set every
 * other mocked feature (Conversations, Live Execution) already grounds itself in. Deliberately
 * not the larger example list (Email, Payment, Inventory, ...) from the spec, since those don't
 * exist in the real tool registry and inventing them would violate "do not invent backend
 * functionality." */
export const TOOL_NAMES = ["crm", "order_lookup", "kb_search", "refund"] as const
export type ToolName = (typeof TOOL_NAMES)[number]

export const TOOL_LABELS: Record<string, string> = {
  crm: "CRM Lookup",
  order_lookup: "Order Lookup",
  kb_search: "Knowledge Base",
  refund: "Refund API",
}

export const TOOL_DESCRIPTIONS: Record<string, string> = {
  crm: "Looks up customer account and contact records in the CRM system.",
  order_lookup: "Retrieves order status, line items, and fulfillment details.",
  kb_search: "Searches the knowledge base for policy and troubleshooting articles.",
  refund: "Issues refunds against a prior order (requires a successful order_lookup first).",
}

export const TOOL_PURPOSES: Record<string, string> = {
  crm: "Gives the Planner customer context (tier, history, prior contacts) before drafting a response.",
  order_lookup: "Establishes ground truth on an order so downstream steps (refund, response) act on real data.",
  kb_search: "Supplies policy-grounded language for the Response agent instead of free-form generation.",
  refund: "Executes the financial action a refund_request ticket ultimately needs — gated on a prior order_lookup.",
}

export const TOOL_ICONS: Record<string, LucideIcon> = {
  crm: Database,
  order_lookup: Search,
  kb_search: LifeBuoy,
  refund: Undo2,
}

export function toolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName
}
