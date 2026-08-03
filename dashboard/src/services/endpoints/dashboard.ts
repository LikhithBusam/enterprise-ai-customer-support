/** Mocked today (MSW) — documented in API_CONTRACT.md as the future real-backend contract. */
import { apiRequest } from "@/services/client"
import type { ActivityFeedItem, DashboardSummary } from "@/types/mocked"

export function getDashboardSummary(signal?: AbortSignal): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>("/v1/dashboard/summary", { signal })
}

export function getActivityFeed(signal?: AbortSignal): Promise<ActivityFeedItem[]> {
  return apiRequest<ActivityFeedItem[]>("/v1/dashboard/activity", { signal })
}
