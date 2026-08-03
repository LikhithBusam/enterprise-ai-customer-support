/** Mocked today (MSW) — documented in API_CONTRACT.md as the future real-backend contract. */
import { apiRequest } from "@/services/client"
import type { AnalyticsFilterParams } from "@/features/analytics/search-params"
import type { AnalyticsChartsResponse, AnalyticsSummaryResponse, AnalyticsTablesResponse } from "@/types/mocked"

function buildQuery(params: AnalyticsFilterParams): URLSearchParams {
  const query = new URLSearchParams()
  if (params.dateFrom) query.set("dateFrom", params.dateFrom)
  if (params.dateTo) query.set("dateTo", params.dateTo)
  if (params.intent.length > 0) query.set("intent", params.intent.join(","))
  if (params.status.length > 0) query.set("status", params.status.join(","))
  if (params.tool.length > 0) query.set("tool", params.tool.join(","))
  if (params.memoryType.length > 0) query.set("memoryType", params.memoryType.join(","))
  if (params.resolution !== "all") query.set("resolution", params.resolution)
  if (params.client !== "all") query.set("client", params.client)
  return query
}

export function getAnalyticsSummary(
  params: AnalyticsFilterParams,
  signal?: AbortSignal,
): Promise<AnalyticsSummaryResponse> {
  return apiRequest<AnalyticsSummaryResponse>(`/v1/analytics/summary?${buildQuery(params).toString()}`, { signal })
}

export function getAnalyticsCharts(
  params: AnalyticsFilterParams,
  signal?: AbortSignal,
): Promise<AnalyticsChartsResponse> {
  return apiRequest<AnalyticsChartsResponse>(`/v1/analytics/charts?${buildQuery(params).toString()}`, { signal })
}

export function getAnalyticsTables(
  params: AnalyticsFilterParams,
  signal?: AbortSignal,
): Promise<AnalyticsTablesResponse> {
  return apiRequest<AnalyticsTablesResponse>(`/v1/analytics/tables?${buildQuery(params).toString()}`, { signal })
}
