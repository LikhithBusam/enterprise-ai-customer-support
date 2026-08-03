/** Mocked today (MSW) — documented in API_CONTRACT.md as the future real-backend contract. */
import { apiRequest } from "@/services/client"
import type { HelpResponse } from "@/types/mocked"

export function getHelp(signal?: AbortSignal): Promise<HelpResponse> {
  return apiRequest<HelpResponse>("/v1/help", { signal })
}
