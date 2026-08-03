/** Mocked today (MSW) — documented in API_CONTRACT.md as the future real-backend contract. */
import { apiRequest } from "@/services/client"
import type { MemorySearchParams } from "@/features/memory-explorer/search-params"
import type { MemoryEntryBase, MemoryStats } from "@/types/mocked"

export interface ListMemoryResponse {
  data: MemoryEntryBase[]
  total: number
}

export function listMemory(params: MemorySearchParams, signal?: AbortSignal): Promise<ListMemoryResponse> {
  const query = new URLSearchParams()
  query.set("page", String(params.page))
  query.set("pageSize", String(params.pageSize))
  if (params.search) query.set("search", params.search)
  if (params.types.length > 0) query.set("types", params.types.join(","))
  if (params.status.length > 0) query.set("status", params.status.join(","))
  if (params.simMin > 0) query.set("simMin", String(params.simMin))
  if (params.simMax < 1) query.set("simMax", String(params.simMax))
  if (params.usageMin > 0) query.set("usageMin", String(params.usageMin))
  if (params.usageMax < 100) query.set("usageMax", String(params.usageMax))
  if (params.dateFrom) query.set("dateFrom", params.dateFrom)
  if (params.dateTo) query.set("dateTo", params.dateTo)
  query.set("sortBy", params.sortBy)
  query.set("sortDir", params.sortDir)

  return apiRequest<ListMemoryResponse>(`/v1/memory?${query.toString()}`, { signal })
}

export function getMemoryEntry(id: string, signal?: AbortSignal): Promise<MemoryEntryBase> {
  return apiRequest<MemoryEntryBase>(`/v1/memory/${id}`, { signal })
}

export function getMemoryStats(type: string | undefined, signal?: AbortSignal): Promise<MemoryStats> {
  const query = type ? `?type=${type}` : ""
  return apiRequest<MemoryStats>(`/v1/memory/stats${query}`, { signal })
}
