import { z } from "zod"

export const analyticsFilterSchema = z.object({
  dateFrom: z.string().catch(""),
  dateTo: z.string().catch(""),
  intent: z.array(z.string()).catch([]),
  status: z.array(z.string()).catch([]),
  tool: z.array(z.string()).catch([]),
  memoryType: z.array(z.string()).catch([]),
  resolution: z.enum(["all", "resolved", "unresolved"]).catch("all"),
  client: z.string().catch("all"),
})

export type AnalyticsFilterParams = z.infer<typeof analyticsFilterSchema>

const DEFAULTS: AnalyticsFilterParams = {
  dateFrom: "",
  dateTo: "",
  intent: [],
  status: [],
  tool: [],
  memoryType: [],
  resolution: "all",
  client: "all",
}

export function parseAnalyticsSearchParams(params: URLSearchParams): AnalyticsFilterParams {
  const raw = {
    dateFrom: params.get("dateFrom") ?? undefined,
    dateTo: params.get("dateTo") ?? undefined,
    intent: params.get("intent")?.split(",").filter(Boolean) ?? [],
    status: params.get("status")?.split(",").filter(Boolean) ?? [],
    tool: params.get("tool")?.split(",").filter(Boolean) ?? [],
    memoryType: params.get("memoryType")?.split(",").filter(Boolean) ?? [],
    resolution: params.get("resolution") ?? undefined,
    client: params.get("client") ?? undefined,
  }
  return analyticsFilterSchema.parse(raw)
}

/** Serializes typed filters back into a URLSearchParams, omitting anything at its default value. */
export function buildAnalyticsSearchParams(value: AnalyticsFilterParams): URLSearchParams {
  const params = new URLSearchParams()
  if (value.dateFrom !== DEFAULTS.dateFrom) params.set("dateFrom", value.dateFrom)
  if (value.dateTo !== DEFAULTS.dateTo) params.set("dateTo", value.dateTo)
  if (value.intent.length > 0) params.set("intent", value.intent.join(","))
  if (value.status.length > 0) params.set("status", value.status.join(","))
  if (value.tool.length > 0) params.set("tool", value.tool.join(","))
  if (value.memoryType.length > 0) params.set("memoryType", value.memoryType.join(","))
  if (value.resolution !== DEFAULTS.resolution) params.set("resolution", value.resolution)
  if (value.client !== DEFAULTS.client) params.set("client", value.client)
  return params
}

export function hasActiveAnalyticsFilters(value: AnalyticsFilterParams): boolean {
  return (
    value.dateFrom.length > 0 ||
    value.dateTo.length > 0 ||
    value.intent.length > 0 ||
    value.status.length > 0 ||
    value.tool.length > 0 ||
    value.memoryType.length > 0 ||
    value.resolution !== DEFAULTS.resolution ||
    value.client !== DEFAULTS.client
  )
}
