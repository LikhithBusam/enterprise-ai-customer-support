import { http, HttpResponse } from "msw"
import { API_BASE_URL } from "@/lib/constants"
import { activityFeedFixture, dashboardSummaryFixture } from "@/services/mock/fixtures/dashboard"

export const dashboardHandlers = [
  http.get(`${API_BASE_URL}/v1/dashboard/summary`, () => {
    return HttpResponse.json(dashboardSummaryFixture)
  }),
  http.get(`${API_BASE_URL}/v1/dashboard/activity`, () => {
    return HttpResponse.json(activityFeedFixture)
  }),
]
