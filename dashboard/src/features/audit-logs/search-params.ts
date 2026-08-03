import { z } from "zod"

export const AUDIT_SORT_FIELDS = [
  "timestamp",
  "actor",
  "client_name",
  "action",
  "category",
  "status",
  "severity",
] as const

export const auditSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(20),
  search: z.string().catch(""),
  category: z.array(z.string()).catch([]),
  actor: z.array(z.string()).catch([]),
  client: z.array(z.string()).catch([]),
  status: z.array(z.string()).catch([]),
  severity: z.array(z.string()).catch([]),
  dateFrom: z.string().catch(""),
  dateTo: z.string().catch(""),
  sortBy: z.enum(AUDIT_SORT_FIELDS).catch("timestamp"),
  sortDir: z.enum(["asc", "desc"]).catch("desc"),
})

export type AuditSearchParams = z.infer<typeof auditSearchSchema>

const DEFAULTS: AuditSearchParams = {
  page: 1,
  pageSize: 20,
  search: "",
  category: [],
  actor: [],
  client: [],
  status: [],
  severity: [],
  dateFrom: "",
  dateTo: "",
  sortBy: "timestamp",
  sortDir: "desc",
}

/** Parses a URLSearchParams into typed, defaulted audit list params. Array-valued params are
 * comma-joined in the URL — same convention as every other list feature's search-params.ts. */
export function parseAuditSearchParams(params: URLSearchParams): AuditSearchParams {
  const raw = {
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
    search: params.get("search") ?? undefined,
    category: params.get("category")?.split(",").filter(Boolean) ?? [],
    actor: params.get("actor")?.split(",").filter(Boolean) ?? [],
    client: params.get("client")?.split(",").filter(Boolean) ?? [],
    status: params.get("status")?.split(",").filter(Boolean) ?? [],
    severity: params.get("severity")?.split(",").filter(Boolean) ?? [],
    dateFrom: params.get("dateFrom") ?? undefined,
    dateTo: params.get("dateTo") ?? undefined,
    sortBy: params.get("sortBy") ?? undefined,
    sortDir: params.get("sortDir") ?? undefined,
  }
  return auditSearchSchema.parse(raw)
}

export function buildAuditSearchParams(value: AuditSearchParams): URLSearchParams {
  const params = new URLSearchParams()
  if (value.page !== DEFAULTS.page) params.set("page", String(value.page))
  if (value.pageSize !== DEFAULTS.pageSize) params.set("pageSize", String(value.pageSize))
  if (value.search !== DEFAULTS.search) params.set("search", value.search)
  if (value.category.length > 0) params.set("category", value.category.join(","))
  if (value.actor.length > 0) params.set("actor", value.actor.join(","))
  if (value.client.length > 0) params.set("client", value.client.join(","))
  if (value.status.length > 0) params.set("status", value.status.join(","))
  if (value.severity.length > 0) params.set("severity", value.severity.join(","))
  if (value.dateFrom !== DEFAULTS.dateFrom) params.set("dateFrom", value.dateFrom)
  if (value.dateTo !== DEFAULTS.dateTo) params.set("dateTo", value.dateTo)
  if (value.sortBy !== DEFAULTS.sortBy) params.set("sortBy", value.sortBy)
  if (value.sortDir !== DEFAULTS.sortDir) params.set("sortDir", value.sortDir)
  return params
}
