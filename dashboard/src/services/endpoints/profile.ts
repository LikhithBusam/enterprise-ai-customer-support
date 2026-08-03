/** Mocked today (MSW) — documented in API_CONTRACT.md as the future real-backend contract. */
import { apiRequest } from "@/services/client"
import type { ProfileResponse, UpdateProfileRequest } from "@/types/mocked"

export function getProfile(signal?: AbortSignal): Promise<ProfileResponse> {
  return apiRequest<ProfileResponse>("/v1/profile", { signal })
}

export function updateProfile(
  request: UpdateProfileRequest,
  signal?: AbortSignal,
): Promise<ProfileResponse> {
  return apiRequest<ProfileResponse>("/v1/profile", {
    method: "PUT",
    body: request,
    signal,
  })
}
