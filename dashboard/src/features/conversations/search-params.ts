import { z } from "zod"

export const CONVERSATION_SORT_FIELDS = [
  "created_at",
  "ticket_id",
  "status",
  "replanning_count",
] as const

export const conversationsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(20),
  search: z.string().catch(""),
  status: z.array(z.string()).catch([]),
  intent: z.array(z.string()).catch([]),
  sortBy: z.enum(CONVERSATION_SORT_FIELDS).catch("created_at"),
  sortDir: z.enum(["asc", "desc"]).catch("desc"),
})

export type ConversationsSearchParams = z.infer<typeof conversationsSearchSchema>

const DEFAULTS: ConversationsSearchParams = {
  page: 1,
  pageSize: 20,
  search: "",
  status: [],
  intent: [],
  sortBy: "created_at",
  sortDir: "desc",
}

/** Parses a URLSearchParams into typed, defaulted conversation list params. Array-valued params
 * are comma-joined in the URL (e.g. `?status=resolved,escalated`). */
export function parseConversationsSearchParams(params: URLSearchParams): ConversationsSearchParams {
  const raw = {
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
    search: params.get("search") ?? undefined,
    status: params.get("status")?.split(",").filter(Boolean) ?? [],
    intent: params.get("intent")?.split(",").filter(Boolean) ?? [],
    sortBy: params.get("sortBy") ?? undefined,
    sortDir: params.get("sortDir") ?? undefined,
  }
  return conversationsSearchSchema.parse(raw)
}

/** Serializes typed params back into a URLSearchParams, omitting anything at its default value
 * so the URL stays clean (e.g. a first-page, unfiltered view has no query string at all). */
export function buildConversationsSearchParams(
  value: ConversationsSearchParams,
): URLSearchParams {
  const params = new URLSearchParams()
  if (value.page !== DEFAULTS.page) params.set("page", String(value.page))
  if (value.pageSize !== DEFAULTS.pageSize) params.set("pageSize", String(value.pageSize))
  if (value.search !== DEFAULTS.search) params.set("search", value.search)
  if (value.status.length > 0) params.set("status", value.status.join(","))
  if (value.intent.length > 0) params.set("intent", value.intent.join(","))
  if (value.sortBy !== DEFAULTS.sortBy) params.set("sortBy", value.sortBy)
  if (value.sortDir !== DEFAULTS.sortDir) params.set("sortDir", value.sortDir)
  return params
}
