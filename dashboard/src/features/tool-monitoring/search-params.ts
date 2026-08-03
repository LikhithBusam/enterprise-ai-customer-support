import { z } from "zod"

export const TOOL_SORT_FIELDS = [
  "tool_name",
  "status",
  "availability",
  "avg_latency_ms",
  "success_rate",
  "failure_rate",
  "retry_count_24h",
  "last_used_at",
] as const

export const toolSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(20),
  search: z.string().catch(""),
  status: z.array(z.string()).catch([]),
  latencyMin: z.coerce.number().min(0).catch(0),
  latencyMax: z.coerce.number().min(0).catch(5000),
  successMin: z.coerce.number().min(0).max(100).catch(0),
  failureMax: z.coerce.number().min(0).max(100).catch(100),
  dateFrom: z.string().catch(""),
  dateTo: z.string().catch(""),
  sortBy: z.enum(TOOL_SORT_FIELDS).catch("tool_name"),
  sortDir: z.enum(["asc", "desc"]).catch("asc"),
})

export type ToolSearchParams = z.infer<typeof toolSearchSchema>

const DEFAULTS: ToolSearchParams = {
  page: 1,
  pageSize: 20,
  search: "",
  status: [],
  latencyMin: 0,
  latencyMax: 5000,
  successMin: 0,
  failureMax: 100,
  dateFrom: "",
  dateTo: "",
  sortBy: "tool_name",
  sortDir: "asc",
}

export function parseToolSearchParams(params: URLSearchParams): ToolSearchParams {
  const raw = {
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
    search: params.get("search") ?? undefined,
    status: params.get("status")?.split(",").filter(Boolean) ?? [],
    latencyMin: params.get("latencyMin") ?? undefined,
    latencyMax: params.get("latencyMax") ?? undefined,
    successMin: params.get("successMin") ?? undefined,
    failureMax: params.get("failureMax") ?? undefined,
    dateFrom: params.get("dateFrom") ?? undefined,
    dateTo: params.get("dateTo") ?? undefined,
    sortBy: params.get("sortBy") ?? undefined,
    sortDir: params.get("sortDir") ?? undefined,
  }
  return toolSearchSchema.parse(raw)
}

export function buildToolSearchParams(value: ToolSearchParams): URLSearchParams {
  const params = new URLSearchParams()
  if (value.page !== DEFAULTS.page) params.set("page", String(value.page))
  if (value.pageSize !== DEFAULTS.pageSize) params.set("pageSize", String(value.pageSize))
  if (value.search !== DEFAULTS.search) params.set("search", value.search)
  if (value.status.length > 0) params.set("status", value.status.join(","))
  if (value.latencyMin !== DEFAULTS.latencyMin) params.set("latencyMin", String(value.latencyMin))
  if (value.latencyMax !== DEFAULTS.latencyMax) params.set("latencyMax", String(value.latencyMax))
  if (value.successMin !== DEFAULTS.successMin) params.set("successMin", String(value.successMin))
  if (value.failureMax !== DEFAULTS.failureMax) params.set("failureMax", String(value.failureMax))
  if (value.dateFrom !== DEFAULTS.dateFrom) params.set("dateFrom", value.dateFrom)
  if (value.dateTo !== DEFAULTS.dateTo) params.set("dateTo", value.dateTo)
  if (value.sortBy !== DEFAULTS.sortBy) params.set("sortBy", value.sortBy)
  if (value.sortDir !== DEFAULTS.sortDir) params.set("sortDir", value.sortDir)
  return params
}
