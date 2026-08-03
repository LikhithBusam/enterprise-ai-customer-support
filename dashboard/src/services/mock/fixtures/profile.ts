import type { ProfileActivityEntry, ProfileResponse, UpdateProfileRequest } from "@/types/mocked"

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR_MS).toISOString()
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

/** Grounds the displayed email in whatever the user actually signed in with (auth-context.tsx
 * stores this on login) rather than a value disconnected from the current session. */
function loadSessionEmail(): string {
  return localStorage.getItem("user_email") ?? "jordan.avery@acmeretail.com"
}

function buildRecentActivity(): ProfileActivityEntry[] {
  return [
    { id: "act-1", action: "Signed in", timestamp: hoursAgo(0.2), ip_address: "203.0.113.42" },
    { id: "act-2", action: "Updated notification preferences", timestamp: hoursAgo(6), ip_address: "203.0.113.42" },
    { id: "act-3", action: "Viewed Audit Logs", timestamp: hoursAgo(9), ip_address: "203.0.113.42" },
    { id: "act-4", action: "Rotated API key", timestamp: daysAgo(2), ip_address: "198.51.100.17" },
    { id: "act-5", action: "Signed in", timestamp: daysAgo(2), ip_address: "198.51.100.17" },
    { id: "act-6", action: "Changed password", timestamp: daysAgo(6), ip_address: "198.51.100.17" },
    { id: "act-7", action: "Updated memory retention settings", timestamp: daysAgo(11), ip_address: "203.0.113.42" },
    { id: "act-8", action: "Signed in", timestamp: daysAgo(11), ip_address: "203.0.113.42" },
  ]
}

/** Module-level mutable state — same rationale as services/mock/fixtures/settings.ts: Profile is
 * a resource this dashboard actually writes to via PUT /v1/profile, so it needs somewhere to
 * persist across GETs within the session. Built lazily (not at module scope) so `loadSessionEmail`
 * reads localStorage after login has actually happened. */
let profile: ProfileResponse | null = null

function buildInitialProfile(): ProfileResponse {
  return {
    name: "Jordan Avery",
    email: loadSessionEmail(),
    avatar_url: null,
    role: "admin",
    organization: "Acme Retail",
    // Matches Settings' seeded "Production" API key (key-1, last4 "8f21") — both surfaces
    // display the same underlying session credential, so they stay grounded to one another.
    api_key_last4: "8f21",
    preferences: {
      theme: "dark",
      language: "en",
      timezone: "America/New_York",
    },
    security: {
      mfa_enabled: false,
      last_login_at: hoursAgo(0.2),
      last_password_change_at: daysAgo(78),
      active_sessions: 2,
    },
    recent_activity: buildRecentActivity(),
    updated_at: daysAgo(3),
  }
}

export function getProfile(): ProfileResponse {
  if (!profile) profile = buildInitialProfile()
  return profile
}

export function updateProfile(request: UpdateProfileRequest): ProfileResponse {
  const current = getProfile()
  if (request.section === "info") {
    profile = { ...current, ...request.data, updated_at: new Date().toISOString() }
    return profile
  }
  profile = { ...current, preferences: request.data, updated_at: new Date().toISOString() }
  return profile
}
