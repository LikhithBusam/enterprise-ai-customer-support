/** Mocked today (MSW) — documented in API_CONTRACT.md as the future real-backend contract. */
import { apiRequest } from "@/services/client"
import type { AvailableModelsResponse, SettingsResponse, UpdateSettingsRequest } from "@/types/mocked"

export function getSettings(signal?: AbortSignal): Promise<SettingsResponse> {
  return apiRequest<SettingsResponse>("/v1/settings", { signal })
}

export function getAvailableModels(signal?: AbortSignal): Promise<AvailableModelsResponse> {
  return apiRequest<AvailableModelsResponse>("/v1/settings/models", { signal })
}

export function updateSettingsSection(
  request: UpdateSettingsRequest,
  signal?: AbortSignal,
): Promise<SettingsResponse> {
  return apiRequest<SettingsResponse>("/v1/settings", {
    method: "PUT",
    body: request,
    signal,
  })
}
