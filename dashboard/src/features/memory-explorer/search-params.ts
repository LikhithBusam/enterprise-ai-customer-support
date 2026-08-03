import { z } from "zod"

export const MEMORY_SORT_FIELDS = [
  "id",
  "memory_type",
  "timestamp",
  "similarity_score",
  "confidence",
  "usage_count",
  "last_retrieved_at",
  "status",
] as const

export const memorySearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(20),
  search: z.string().catch(""),
  types: z.array(z.string()).catch([]),
  status: z.array(z.string()).catch([]),
  simMin: z.coerce.number().min(0).max(1).catch(0),
  simMax: z.coerce.number().min(0).max(1).catch(1),
  usageMin: z.coerce.number().int().min(0).catch(0),
  usageMax: z.coerce.number().int().min(0).catch(100),
  dateFrom: z.string().catch(""),
  dateTo: z.string().catch(""),
  sortBy: z.enum(MEMORY_SORT_FIELDS).catch("timestamp"),
  sortDir: z.enum(["asc", "desc"]).catch("desc"),
})

export type MemorySearchParams = z.infer<typeof memorySearchSchema>

const DEFAULTS: MemorySearchParams = {
  page: 1,
  pageSize: 20,
  search: "",
  types: [],
  status: [],
  simMin: 0,
  simMax: 1,
  usageMin: 0,
  usageMax: 100,
  dateFrom: "",
  dateTo: "",
  sortBy: "timestamp",
  sortDir: "desc",
}

/** Parses a URLSearchParams into typed, defaulted memory list params. Array-valued params are
 * comma-joined in the URL (e.g. `?types=episodic,policy`), mirroring the Conversations pattern. */
export function parseMemorySearchParams(params: URLSearchParams): MemorySearchParams {
  const raw = {
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
    search: params.get("search") ?? undefined,
    types: params.get("types")?.split(",").filter(Boolean) ?? [],
    status: params.get("status")?.split(",").filter(Boolean) ?? [],
    simMin: params.get("simMin") ?? undefined,
    simMax: params.get("simMax") ?? undefined,
    usageMin: params.get("usageMin") ?? undefined,
    usageMax: params.get("usageMax") ?? undefined,
    dateFrom: params.get("dateFrom") ?? undefined,
    dateTo: params.get("dateTo") ?? undefined,
    sortBy: params.get("sortBy") ?? undefined,
    sortDir: params.get("sortDir") ?? undefined,
  }
  return memorySearchSchema.parse(raw)
}

/** Serializes typed params back into a URLSearchParams, omitting anything at its default value. */
export function buildMemorySearchParams(value: MemorySearchParams): URLSearchParams {
  const params = new URLSearchParams()
  if (value.page !== DEFAULTS.page) params.set("page", String(value.page))
  if (value.pageSize !== DEFAULTS.pageSize) params.set("pageSize", String(value.pageSize))
  if (value.search !== DEFAULTS.search) params.set("search", value.search)
  if (value.types.length > 0) params.set("types", value.types.join(","))
  if (value.status.length > 0) params.set("status", value.status.join(","))
  if (value.simMin !== DEFAULTS.simMin) params.set("simMin", String(value.simMin))
  if (value.simMax !== DEFAULTS.simMax) params.set("simMax", String(value.simMax))
  if (value.usageMin !== DEFAULTS.usageMin) params.set("usageMin", String(value.usageMin))
  if (value.usageMax !== DEFAULTS.usageMax) params.set("usageMax", String(value.usageMax))
  if (value.dateFrom !== DEFAULTS.dateFrom) params.set("dateFrom", value.dateFrom)
  if (value.dateTo !== DEFAULTS.dateTo) params.set("dateTo", value.dateTo)
  if (value.sortBy !== DEFAULTS.sortBy) params.set("sortBy", value.sortBy)
  if (value.sortDir !== DEFAULTS.sortDir) params.set("sortDir", value.sortDir)
  return params
}
