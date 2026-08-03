import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/constants"
import { getAnalyticsCharts, getAnalyticsSummary, getAnalyticsTables } from "@/services/endpoints/analytics"
import type { AnalyticsFilterParams } from "@/features/analytics/search-params"

export function useAnalyticsSummary(params: AnalyticsFilterParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.analyticsSummary, params],
    queryFn: ({ signal }) => getAnalyticsSummary(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useAnalyticsCharts(params: AnalyticsFilterParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.analyticsCharts, params],
    queryFn: ({ signal }) => getAnalyticsCharts(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useAnalyticsTables(params: AnalyticsFilterParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.analyticsTables, params],
    queryFn: ({ signal }) => getAnalyticsTables(params, signal),
    placeholderData: keepPreviousData,
  })
}
