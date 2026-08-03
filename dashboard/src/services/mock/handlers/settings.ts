import { http, HttpResponse } from "msw"
import { API_BASE_URL } from "@/lib/constants"
import { getAvailableModels, getSettings, updateSettingsSection } from "@/services/mock/fixtures/settings"
import type { SettingsSectionKey, UpdateSettingsRequest } from "@/types/mocked"

const SECTION_KEYS: SettingsSectionKey[] = [
  "general",
  "ai_models",
  "memory",
  "security",
  "notifications",
  "appearance",
]

export const settingsHandlers = [
  http.get(`${API_BASE_URL}/v1/settings/models`, () => {
    return HttpResponse.json(getAvailableModels())
  }),

  http.get(`${API_BASE_URL}/v1/settings`, () => {
    return HttpResponse.json(getSettings())
  }),

  http.put(`${API_BASE_URL}/v1/settings`, async ({ request }) => {
    const body = (await request.json()) as UpdateSettingsRequest
    if (!SECTION_KEYS.includes(body.section)) {
      return HttpResponse.json({ detail: "Unknown settings section" }, { status: 400 })
    }
    return HttpResponse.json(updateSettingsSection(body))
  }),
]
