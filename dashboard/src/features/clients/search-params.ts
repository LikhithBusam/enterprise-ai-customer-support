import { z } from "zod"

export const CLIENT_SORT_FIELDS = [
  "name",
  "client_id",
  "plan",
  "status",
  "active_users",
  "monthly_ticket_usage",
  "memory_retention_days",
  "rate_limit_per_minute",
  "created_at",
] as const

export const clientsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(20),
  search: z.string().catch(""),
  plan: z.array(z.string()).catch([]),
  status: z.array(z.string()).catch([]),
  usageMin: z.coerce.number().min(0).catch(0),
  usageMax: z.coerce.number().min(0).catch(120),
  retentionMin: z.coerce.number().min(0).catch(0),
  retentionMax: z.coerce.number().min(0).catch(400),
  dateFrom: z.string().catch(""),
  dateTo: z.string().catch(""),
  sortBy: z.enum(CLIENT_SORT_FIELDS).catch("created_at"),
  sortDir: z.enum(["asc", "desc"]).catch("desc"),
})

export type ClientsSearchParams = z.infer<typeof clientsSearchSchema>

const DEFAULTS: ClientsSearchParams = {
  page: 1,
  pageSize: 20,
  search: "",
  plan: [],
  status: [],
  usageMin: 0,
  usageMax: 120,
  retentionMin: 0,
  retentionMax: 400,
  dateFrom: "",
  dateTo: "",
  sortBy: "created_at",
  sortDir: "desc",
}

/** Parses a URLSearchParams into typed, defaulted client list params. Array-valued params are
 * comma-joined in the URL (e.g. `?plan=growth,enterprise`) — same convention as
 * features/conversations/search-params.ts and features/tool-monitoring/search-params.ts. */
export function parseClientsSearchParams(params: URLSearchParams): ClientsSearchParams {
  const raw = {
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
    search: params.get("search") ?? undefined,
    plan: params.get("plan")?.split(",").filter(Boolean) ?? [],
    status: params.get("status")?.split(",").filter(Boolean) ?? [],
    usageMin: params.get("usageMin") ?? undefined,
    usageMax: params.get("usageMax") ?? undefined,
    retentionMin: params.get("retentionMin") ?? undefined,
    retentionMax: params.get("retentionMax") ?? undefined,
    dateFrom: params.get("dateFrom") ?? undefined,
    dateTo: params.get("dateTo") ?? undefined,
    sortBy: params.get("sortBy") ?? undefined,
    sortDir: params.get("sortDir") ?? undefined,
  }
  return clientsSearchSchema.parse(raw)
}

export function buildClientsSearchParams(value: ClientsSearchParams): URLSearchParams {
  const params = new URLSearchParams()
  if (value.page !== DEFAULTS.page) params.set("page", String(value.page))
  if (value.pageSize !== DEFAULTS.pageSize) params.set("pageSize", String(value.pageSize))
  if (value.search !== DEFAULTS.search) params.set("search", value.search)
  if (value.plan.length > 0) params.set("plan", value.plan.join(","))
  if (value.status.length > 0) params.set("status", value.status.join(","))
  if (value.usageMin !== DEFAULTS.usageMin) params.set("usageMin", String(value.usageMin))
  if (value.usageMax !== DEFAULTS.usageMax) params.set("usageMax", String(value.usageMax))
  if (value.retentionMin !== DEFAULTS.retentionMin) params.set("retentionMin", String(value.retentionMin))
  if (value.retentionMax !== DEFAULTS.retentionMax) params.set("retentionMax", String(value.retentionMax))
  if (value.dateFrom !== DEFAULTS.dateFrom) params.set("dateFrom", value.dateFrom)
  if (value.dateTo !== DEFAULTS.dateTo) params.set("dateTo", value.dateTo)
  if (value.sortBy !== DEFAULTS.sortBy) params.set("sortBy", value.sortBy)
  if (value.sortDir !== DEFAULTS.sortDir) params.set("sortDir", value.sortDir)
  return params
}
