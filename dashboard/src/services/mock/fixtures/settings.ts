import type { AvailableModelsResponse, SettingsResponse, UpdateSettingsRequest } from "@/types/mocked"

const AVAILABLE_MODELS: AvailableModelsResponse = {
  llms: [
    "gpt-4o",
    "gpt-4o-mini",
    "claude-sonnet-5",
    "claude-haiku-4.5",
    "gemini-2.5-flash",
    "nvidia/nemotron-4-340b",
    "llama-3.1-70b",
  ],
  embedding_models: ["text-embedding-3-large", "text-embedding-3-small", "voyage-3"],
}

/** Module-level mutable state (unlike every other fixture in this file's siblings) — Settings is
 * the one resource this dashboard actually writes to, so PUT /v1/settings needs somewhere to
 * persist the change across subsequent GETs within the session. Resets on a full page reload,
 * same limitation as every other MSW-mocked resource here (no real backend). */
let settings: SettingsResponse = {
  general: {
    organization_name: "Acme Retail",
    organization_slug: "acme-retail",
    time_zone: "America/New_York",
    default_language: "en",
  },
  ai_models: {
    default_llm: "claude-sonnet-5",
    temperature: 0.7,
    max_tokens: 4096,
    embedding_model: "text-embedding-3-large",
    tool_timeout_seconds: 30,
  },
  memory: {
    memory_enabled: true,
    memory_retention_days: 90,
    similarity_threshold: 0.75,
    max_memories: 5000,
    auto_cleanup: true,
  },
  security: {
    api_keys: [
      {
        id: "key-1",
        label: "Production",
        key_last4: "8f21",
        created_at: "2025-11-02T14:00:00.000Z",
        last_used_at: "2026-07-30T09:12:00.000Z",
      },
    ],
    session_timeout_minutes: 60,
    mfa_enabled: false,
    ip_allow_list: [],
    audit_logging_enabled: true,
  },
  notifications: {
    email_alerts: true,
    slack_notifications: false,
    failure_alerts: true,
    weekly_reports: true,
  },
  appearance: {
    theme: "dark",
    density: "comfortable",
    date_format: "MM/DD/YYYY",
    number_format: "1,234.56",
  },
  updated_at: "2026-07-28T10:00:00.000Z",
}

export function getSettings(): SettingsResponse {
  return settings
}

export function updateSettingsSection(request: UpdateSettingsRequest): SettingsResponse {
  if (request.section === "security") {
    settings = {
      ...settings,
      security: { ...request.data, api_keys: settings.security.api_keys },
      updated_at: new Date().toISOString(),
    }
    return settings
  }
  settings = { ...settings, [request.section]: request.data, updated_at: new Date().toISOString() }
  return settings
}

export function getAvailableModels(): AvailableModelsResponse {
  return AVAILABLE_MODELS
}
