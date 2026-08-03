import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/constants"
import { getActivityFeed, getDashboardSummary } from "@/services/endpoints/dashboard"

export function useDashboardSummary() {
  return useQuery({
    queryKey: QUERY_KEYS.dashboardSummary,
    queryFn: ({ signal }) => getDashboardSummary(signal),
    refetchInterval: 30_000,
  })
}

export function useActivityFeed() {
  return useQuery({
    queryKey: QUERY_KEYS.activityFeed,
    queryFn: ({ signal }) => getActivityFeed(signal),
    refetchInterval: 30_000,
  })
}
