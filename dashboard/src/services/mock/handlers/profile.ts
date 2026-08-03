import { http, HttpResponse } from "msw"
import { API_BASE_URL } from "@/lib/constants"
import { getProfile, updateProfile } from "@/services/mock/fixtures/profile"
import type { UpdateProfileRequest } from "@/types/mocked"

export const profileHandlers = [
  http.get(`${API_BASE_URL}/v1/profile`, () => {
    return HttpResponse.json(getProfile())
  }),

  http.put(`${API_BASE_URL}/v1/profile`, async ({ request }) => {
    const body = (await request.json()) as UpdateProfileRequest
    if (body.section !== "info" && body.section !== "preferences") {
      return HttpResponse.json({ detail: "Unknown profile section" }, { status: 400 })
    }
    return HttpResponse.json(updateProfile(body))
  }),
]
