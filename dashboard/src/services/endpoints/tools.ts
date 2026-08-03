/** Mocked today (MSW) — documented in API_CONTRACT.md as the future real-backend contract. */
import { apiRequest } from "@/services/client"
import type { ToolSearchParams } from "@/features/tool-monitoring/search-params"
import type { ToolDetail, ToolHealth, ToolHistoryResponse, ToolStats } from "@/types/mocked"

export interface ListToolsResponse {
  data: ToolHealth[]
  total: number
}

export function listTools(params: ToolSearchParams, signal?: AbortSignal): Promise<ListToolsResponse> {
  const query = new URLSearchParams()
  query.set("page", String(params.page))
  query.set("pageSize", String(params.pageSize))
  if (params.search) query.set("search", params.search)
  if (params.status.length > 0) query.set("status", params.status.join(","))
  if (params.latencyMin > 0) query.set("latencyMin", String(params.latencyMin))
  if (params.latencyMax < 5000) query.set("latencyMax", String(params.latencyMax))
  if (params.successMin > 0) query.set("successMin", String(params.successMin))
  if (params.failureMax < 100) query.set("failureMax", String(params.failureMax))
  if (params.dateFrom) query.set("dateFrom", params.dateFrom)
  if (params.dateTo) query.set("dateTo", params.dateTo)
  query.set("sortBy", params.sortBy)
  query.set("sortDir", params.sortDir)

  return apiRequest<ListToolsResponse>(`/v1/tools?${query.toString()}`, { signal })
}

export function getTool(toolName: string, signal?: AbortSignal): Promise<ToolDetail> {
  return apiRequest<ToolDetail>(`/v1/tools/${toolName}`, { signal })
}

export function getToolStats(signal?: AbortSignal): Promise<ToolStats> {
  return apiRequest<ToolStats>("/v1/tools/stats", { signal })
}

export function getToolHistory(toolName: string, signal?: AbortSignal): Promise<ToolHistoryResponse> {
  return apiRequest<ToolHistoryResponse>(`/v1/tools/${toolName}/history`, { signal })
}
