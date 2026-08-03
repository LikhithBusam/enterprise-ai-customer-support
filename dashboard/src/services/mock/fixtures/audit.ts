import { faker } from "@faker-js/faker"
import type {
  AuditCategory,
  AuditLogDetail,
  AuditLogEntry,
  AuditSeverity,
  AuditStats,
  AuditStatus,
  AuditTimelineEvent,
} from "@/types/mocked"

faker.seed(51423)

const TOTAL_EVENTS = 160
const HISTORY_DAYS = 30

/** Same 3 seeded clients Client Management's fixture uses, so audit events reference clients that
 * actually exist elsewhere in the app rather than arbitrary ids. */
const CLIENTS: Array<{ id: string; name: string }> = [
  { id: "acme-retail", name: "Acme Retail" },
  { id: "nova-goods", name: "Nova Goods" },
  { id: "brightpath", name: "BrightPath Inc." },
]

const ACTORS: Array<{ name: string; email: string }> = [
  { name: "System", email: "system@internal" },
  { name: "Avery Chen", email: "avery.chen@acme-retail.com" },
  { name: "Priya Nair", email: "priya.nair@nova-goods.com" },
  { name: "Jordan Blake", email: "jordan.blake@brightpath.io" },
  { name: "Morgan Ellis", email: "morgan.ellis@acme-retail.com" },
  { name: "Sam Okafor", email: "sam.okafor@nova-goods.com" },
]

interface CategoryProfile {
  category: AuditCategory
  weight: number
  actions: Array<{ label: string; resourcePrefix: string; hasDiff: boolean }>
  severities: Array<[AuditSeverity, number]>
}

const CATEGORY_PROFILES: CategoryProfile[] = [
  {
    category: "configuration",
    weight: 26,
    actions: [
      { label: "Updated memory retention", resourcePrefix: "settings/memory", hasDiff: true },
      { label: "Changed default LLM", resourcePrefix: "settings/ai_models", hasDiff: true },
      { label: "Modified rate limit", resourcePrefix: "settings/security", hasDiff: true },
      { label: "Updated notification preferences", resourcePrefix: "settings/notifications", hasDiff: true },
      { label: "Changed appearance theme", resourcePrefix: "settings/appearance", hasDiff: true },
    ],
    severities: [
      ["info", 40],
      ["low", 35],
      ["medium", 20],
      ["high", 5],
    ],
  },
  {
    category: "authentication",
    weight: 26,
    actions: [
      { label: "User signed in", resourcePrefix: "session", hasDiff: false },
      { label: "User signed out", resourcePrefix: "session", hasDiff: false },
      { label: "MFA challenge succeeded", resourcePrefix: "session", hasDiff: false },
      { label: "MFA challenge failed", resourcePrefix: "session", hasDiff: false },
      { label: "Session expired", resourcePrefix: "session", hasDiff: false },
      { label: "Password reset requested", resourcePrefix: "account", hasDiff: false },
    ],
    severities: [
      ["info", 55],
      ["low", 25],
      ["medium", 12],
      ["high", 8],
    ],
  },
  {
    category: "security",
    weight: 15,
    actions: [
      { label: "IP allow list updated", resourcePrefix: "settings/security", hasDiff: true },
      { label: "Suspicious login blocked", resourcePrefix: "session", hasDiff: false },
      { label: "MFA enforcement enabled", resourcePrefix: "settings/security", hasDiff: true },
      { label: "Audit logging toggled", resourcePrefix: "settings/security", hasDiff: true },
    ],
    severities: [
      ["medium", 25],
      ["high", 45],
      ["critical", 30],
    ],
  },
  {
    category: "api_key",
    weight: 11,
    actions: [
      { label: "API key created", resourcePrefix: "api_key", hasDiff: false },
      { label: "API key rotated", resourcePrefix: "api_key", hasDiff: false },
      { label: "API key revoked", resourcePrefix: "api_key", hasDiff: false },
    ],
    severities: [
      ["medium", 30],
      ["high", 55],
      ["critical", 15],
    ],
  },
  {
    category: "data",
    weight: 12,
    actions: [
      { label: "Exported client data", resourcePrefix: "client", hasDiff: false },
      { label: "Memory entries pruned", resourcePrefix: "memory", hasDiff: false },
      { label: "Conversation transcript accessed", resourcePrefix: "conversation", hasDiff: false },
    ],
    severities: [
      ["low", 30],
      ["medium", 45],
      ["high", 25],
    ],
  },
  {
    category: "system",
    weight: 10,
    actions: [
      { label: "Retention job completed", resourcePrefix: "job/retention", hasDiff: false },
      { label: "Telemetry export configured", resourcePrefix: "settings/telemetry", hasDiff: false },
      { label: "Scheduled backup completed", resourcePrefix: "job/backup", hasDiff: false },
    ],
    severities: [
      ["info", 70],
      ["low", 25],
      ["medium", 5],
    ],
  },
]

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/129.0.0.0 Safari/537.36",
  "curl/8.7.1",
]

function pickWeighted<T>(items: Array<[T, number]>): T {
  const totalWeight = items.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = faker.number.int({ min: 1, max: totalWeight })
  for (const [value, weight] of items) {
    roll -= weight
    if (roll <= 0) return value
  }
  return items[0]![0]
}

function pickCategoryProfile(): CategoryProfile {
  return pickWeighted(CATEGORY_PROFILES.map((profile) => [profile, profile.weight] as [CategoryProfile, number]))
}

function pickStatus(category: AuditCategory): AuditStatus {
  const roll = faker.number.int({ min: 1, max: 100 })
  if (category === "authentication") {
    if (roll <= 78) return "success"
    if (roll <= 94) return "failure"
    return "warning"
  }
  if (roll <= 88) return "success"
  if (roll <= 96) return "failure"
  return "warning"
}

function buildDiff(actionLabel: string): { oldValue: Record<string, unknown>; newValue: Record<string, unknown> } {
  if (actionLabel === "Updated memory retention") {
    return { oldValue: { memory_retention_days: 60 }, newValue: { memory_retention_days: 90 } }
  }
  if (actionLabel === "Changed default LLM") {
    return { oldValue: { default_llm: "gpt-4o-mini" }, newValue: { default_llm: "claude-sonnet-5" } }
  }
  if (actionLabel === "Modified rate limit") {
    return { oldValue: { rate_limit_per_minute: 60 }, newValue: { rate_limit_per_minute: 120 } }
  }
  if (actionLabel === "Updated notification preferences") {
    return { oldValue: { slack_notifications: false }, newValue: { slack_notifications: true } }
  }
  if (actionLabel === "Changed appearance theme") {
    return { oldValue: { theme: "system" }, newValue: { theme: "dark" } }
  }
  if (actionLabel === "IP allow list updated") {
    return { oldValue: { ip_allow_list: [] }, newValue: { ip_allow_list: ["203.0.113.0/24"] } }
  }
  if (actionLabel === "MFA enforcement enabled") {
    return { oldValue: { mfa_enabled: false }, newValue: { mfa_enabled: true } }
  }
  return { oldValue: { audit_logging_enabled: false }, newValue: { audit_logging_enabled: true } }
}

const TIMELINE_STEPS = ["Request received", "Authorization checked", "Change applied", "Notification dispatched"]

function buildTimeline(entry: AuditLogEntry): AuditTimelineEvent[] {
  const stepCount = faker.number.int({ min: 2, max: TIMELINE_STEPS.length })
  const baseTime = new Date(entry.timestamp).getTime()
  return TIMELINE_STEPS.slice(0, stepCount).map((step, index) => ({
    id: `${entry.id}-step-${index + 1}`,
    timestamp: new Date(baseTime + index * 350).toISOString(),
    actor: index === 0 ? entry.actor : "System",
    action: step,
    status: index === stepCount - 1 && entry.status !== "success" ? entry.status : "success",
  }))
}

interface BuiltAuditLog {
  entry: AuditLogEntry
  detail: AuditLogDetail
}

function buildAuditLog(index: number): BuiltAuditLog {
  const profile = pickCategoryProfile()
  const actionDef = faker.helpers.arrayElement(profile.actions)
  const status = pickStatus(profile.category)
  const severity = pickWeighted(profile.severities)
  const actor = faker.helpers.arrayElement(ACTORS)
  const client = faker.helpers.arrayElement(CLIENTS)
  const timestamp = faker.date.recent({ days: HISTORY_DAYS }).toISOString()
  const resource = `${actionDef.resourcePrefix}/${faker.string.alphanumeric({ length: 6, casing: "lower" })}`

  const entry: AuditLogEntry = {
    id: `audit-${String(index + 1).padStart(4, "0")}`,
    timestamp,
    actor: actor.name,
    actor_email: actor.email,
    client_id: client.id,
    client_name: client.name,
    action: actionDef.label,
    category: profile.category,
    resource,
    status,
    severity,
    ip_address: faker.internet.ipv4(),
    request_id: faker.string.uuid(),
  }

  const diff = actionDef.hasDiff ? buildDiff(actionDef.label) : null

  const detail: AuditLogDetail = {
    ...entry,
    old_value: diff?.oldValue ?? null,
    new_value: diff?.newValue ?? null,
    user_agent: faker.helpers.arrayElement(USER_AGENTS),
    correlation_id: faker.string.uuid(),
    metadata: { source: "dashboard", api_version: "v1" },
    timeline: [],
  }
  detail.timeline = buildTimeline(entry)

  return { entry, detail }
}

const auditLogFixture: BuiltAuditLog[] = Array.from({ length: TOTAL_EVENTS }, (_, index) => buildAuditLog(index)).sort(
  (a, b) => new Date(b.entry.timestamp).getTime() - new Date(a.entry.timestamp).getTime(),
)

export const AUDIT_ACTOR_OPTIONS = ACTORS.map((actor) => ({ value: actor.email, label: actor.name }))
export const AUDIT_CLIENT_OPTIONS = CLIENTS.map((client) => ({ value: client.id, label: client.name }))

export function listAuditLogEntries(): AuditLogEntry[] {
  return auditLogFixture.map((log) => log.entry)
}

export function getAuditLogDetailById(id: string): AuditLogDetail | null {
  return auditLogFixture.find((log) => log.entry.id === id)?.detail ?? null
}

export function computeAuditStats(): AuditStats {
  const entries = listAuditLogEntries()
  const dayAgo = Date.now() - 86_400_000
  return {
    total_events: entries.length,
    security_events: entries.filter((entry) => entry.category === "security").length,
    configuration_changes: entries.filter((entry) => entry.category === "configuration").length,
    authentication_events: entries.filter((entry) => entry.category === "authentication").length,
    api_key_changes: entries.filter((entry) => entry.category === "api_key").length,
    events_last_24h: entries.filter((entry) => new Date(entry.timestamp).getTime() >= dayAgo).length,
  }
}
