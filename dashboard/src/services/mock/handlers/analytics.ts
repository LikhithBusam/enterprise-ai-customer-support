import { http, HttpResponse } from "msw"
import { API_BASE_URL } from "@/lib/constants"
import {
  computeAnalyticsCharts,
  computeAnalyticsSummary,
  computeAnalyticsTables,
  type AnalyticsQueryFilters,
} from "@/services/mock/fixtures/analytics"

function parseFilterParams(url: URL): AnalyticsQueryFilters {
  const resolution = url.searchParams.get("resolution")
  return {
    dateFrom: url.searchParams.get("dateFrom") ?? "",
    dateTo: url.searchParams.get("dateTo") ?? "",
    intent: url.searchParams.get("intent")?.split(",").filter(Boolean) ?? [],
    status: url.searchParams.get("status")?.split(",").filter(Boolean) ?? [],
    tool: url.searchParams.get("tool")?.split(",").filter(Boolean) ?? [],
    memoryType: url.searchParams.get("memoryType")?.split(",").filter(Boolean) ?? [],
    resolution: resolution === "resolved" || resolution === "unresolved" ? resolution : "all",
    client: url.searchParams.get("client") ?? "all",
  }
}

export const analyticsHandlers = [
  http.get(`${API_BASE_URL}/v1/analytics/summary`, ({ request }) => {
    const params = parseFilterParams(new URL(request.url))
    return HttpResponse.json(computeAnalyticsSummary(params))
  }),

  http.get(`${API_BASE_URL}/v1/analytics/charts`, ({ request }) => {
    const params = parseFilterParams(new URL(request.url))
    return HttpResponse.json(computeAnalyticsCharts(params))
  }),

  http.get(`${API_BASE_URL}/v1/analytics/tables`, ({ request }) => {
    const params = parseFilterParams(new URL(request.url))
    return HttpResponse.json(computeAnalyticsTables(params))
  }),
]
