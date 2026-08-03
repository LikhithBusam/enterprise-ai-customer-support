import { faker } from "@faker-js/faker"
import type {
  ClientActivityEntry,
  ClientDetail,
  ClientFeatureFlag,
  ClientPlan,
  ClientRecord,
  ClientStats,
  ClientStatus,
} from "@/types/mocked"

faker.seed(90210)

const TOTAL_CLIENTS = 21

const MODEL_POOL = ["gpt-4o-mini", "gpt-4o", "claude-haiku-4.5", "claude-sonnet-5", "llama-3.1-70b"]

const FEATURE_FLAG_DEFS: Array<{ key: string; label: string }> = [
  { key: "policy_memory", label: "Policy memory" },
  { key: "template_abstraction", label: "Template abstraction" },
  { key: "reliability_scoring", label: "Tool reliability scoring" },
  { key: "real_tool_adapter", label: "Real tool adapter" },
  { key: "telemetry_export", label: "Telemetry export" },
]

const ACTIVITY_ACTIONS = [
  "API key rotated",
  "Plan upgraded",
  "Plan downgraded",
  "Rate limit increased",
  "Memory retention updated",
  "Feature flag toggled",
  "Ticket volume spike detected",
  "Support ticket opened",
  "Contact information updated",
]

interface PlanProfile {
  ticketLimit: number
  retentionDays: number
  rateLimitPerMinute: number
  memoryLimitMb: number
  modelCount: number
  flagOnChance: number
  activeUsers: [number, number]
}

const PLAN_PROFILES: Record<ClientPlan, PlanProfile> = {
  starter: { ticketLimit: 500, retentionDays: 30, rateLimitPerMinute: 30, memoryLimitMb: 256, modelCount: 1, flagOnChance: 0.15, activeUsers: [1, 8] },
  growth: { ticketLimit: 5000, retentionDays: 90, rateLimitPerMinute: 120, memoryLimitMb: 2048, modelCount: 3, flagOnChance: 0.45, activeUsers: [5, 40] },
  enterprise: { ticketLimit: 50000, retentionDays: 365, rateLimitPerMinute: 600, memoryLimitMb: 16384, modelCount: 5, flagOnChance: 0.8, activeUsers: [20, 300] },
}

/** Weighted single-pick roll — same technique fixtures/conversations.ts's pickIntent() uses,
 * kept inline per this codebase's convention of not sharing small generator helpers across
 * fixture files (see CLAUDE.md on _call_llm() duplication). */
function pickWeighted<T>(items: Array<[T, number]>): T {
  const totalWeight = items.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = faker.number.int({ min: 1, max: totalWeight })
  for (const [value, weight] of items) {
    roll -= weight
    if (roll <= 0) return value
  }
  return items[0]![0]
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function buildFeatureFlags(profile: PlanProfile): ClientFeatureFlag[] {
  return FEATURE_FLAG_DEFS.map((def) => ({
    ...def,
    enabled: faker.number.float({ min: 0, max: 1 }) < profile.flagOnChance,
  }))
}

function buildActivity(createdAt: Date): ClientActivityEntry[] {
  const count = faker.number.int({ min: 4, max: 8 })
  const entries: ClientActivityEntry[] = Array.from({ length: count }, (_, index) => {
    const timestamp = faker.date.between({ from: createdAt, to: new Date() })
    return {
      id: `activity-${index + 1}-${timestamp.getTime()}`,
      action: faker.helpers.arrayElement(ACTIVITY_ACTIONS),
      actor: faker.number.float({ min: 0, max: 1 }) < 0.4 ? "system" : faker.internet.email(),
      timestamp: timestamp.toISOString(),
    }
  })
  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

function buildClient(clientId: string, name: string): ClientDetail {
  const plan = pickWeighted<ClientPlan>([
    ["starter", 45],
    ["growth", 35],
    ["enterprise", 20],
  ])
  const status = pickWeighted<ClientStatus>([
    ["active", 80],
    ["trial", 12],
    ["suspended", 8],
  ])
  const profile = PLAN_PROFILES[plan]
  const createdAt = faker.date.past({ years: 2 })
  const updatedAt = faker.date.between({ from: createdAt, to: new Date() })
  const usageFraction = faker.number.float({ min: 0.05, max: 1.08 })
  const monthlyTicketUsage = Math.min(
    Math.round(profile.ticketLimit * usageFraction),
    Math.round(profile.ticketLimit * 1.15),
  )
  const retentionJitter = faker.number.int({ min: -5, max: 5 })
  const currentRpm = Math.round(profile.rateLimitPerMinute * faker.number.float({ min: 0.1, max: 0.95 }))

  return {
    client_id: clientId,
    name,
    plan,
    status,
    api_key_last4: faker.string.numeric(4),
    active_users: faker.number.int({ min: profile.activeUsers[0], max: profile.activeUsers[1] }),
    monthly_ticket_usage: Math.max(0, monthlyTicketUsage),
    monthly_ticket_limit: profile.ticketLimit,
    memory_retention_days: Math.max(7, profile.retentionDays + retentionJitter),
    rate_limit_per_minute: profile.rateLimitPerMinute,
    created_at: createdAt.toISOString(),
    updated_at: updatedAt.toISOString(),
    allowed_models: faker.helpers.arrayElements(MODEL_POOL, profile.modelCount),
    feature_flags: buildFeatureFlags(profile),
    rate_limits: {
      requests_per_minute: currentRpm,
      requests_per_minute_limit: profile.rateLimitPerMinute,
      burst_limit: profile.rateLimitPerMinute * 2,
    },
    memory_usage_mb: Math.round(profile.memoryLimitMb * faker.number.float({ min: 0.1, max: 0.95 })),
    memory_usage_limit_mb: profile.memoryLimitMb,
    recent_activity: buildActivity(createdAt),
  }
}

/** The 3 placeholder clients app/client-context.tsx's topbar switcher already hardcodes — kept
 * identical here (same id/name) so the two never drift once this feature swaps that context to a
 * real query, per this file's ClientRecord doc comment. */
const SEEDED_CLIENTS: Array<[string, string]> = [
  ["acme-retail", "Acme Retail"],
  ["nova-goods", "Nova Goods"],
  ["brightpath", "BrightPath Inc."],
]

function buildClients(): ClientDetail[] {
  const clients: ClientDetail[] = SEEDED_CLIENTS.map(([id, name]) => buildClient(id, name))
  const usedIds = new Set(clients.map((client) => client.client_id))

  while (clients.length < TOTAL_CLIENTS) {
    const name = `${faker.company.name()}`
    let id = slugify(name)
    let suffix = 2
    while (usedIds.has(id)) {
      id = `${slugify(name)}-${suffix}`
      suffix += 1
    }
    usedIds.add(id)
    clients.push(buildClient(id, name))
  }

  return clients.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

const clientsFixture: ClientDetail[] = buildClients()

export function listClientRecords(): ClientRecord[] {
  return clientsFixture.map(({ updated_at: _updatedAt, allowed_models: _models, feature_flags: _flags, rate_limits: _limits, memory_usage_mb: _usageMb, memory_usage_limit_mb: _limitMb, recent_activity: _activity, ...record }) => record)
}

export function getClientDetailById(clientId: string): ClientDetail | null {
  return clientsFixture.find((client) => client.client_id === clientId) ?? null
}

export function computeClientStats(): ClientStats {
  const totalClients = clientsFixture.length
  const activeClients = clientsFixture.filter((client) => client.status === "active").length
  const enterpriseClients = clientsFixture.filter((client) => client.plan === "enterprise").length
  const apiRequests24h = clientsFixture.reduce(
    (sum, client) => sum + Math.round((client.monthly_ticket_usage / 30) * faker.number.float({ min: 8, max: 14 })),
    0,
  )
  const memoryUsageMb = clientsFixture.reduce((sum, client) => sum + client.memory_usage_mb, 0)
  const avgResponseTimeMs = Math.round(
    clientsFixture.reduce((sum, client) => {
      const base = client.plan === "enterprise" ? 210 : client.plan === "growth" ? 340 : 480
      return sum + base + faker.number.int({ min: -40, max: 60 })
    }, 0) / totalClients,
  )

  return {
    total_clients: totalClients,
    active_clients: activeClients,
    enterprise_clients: enterpriseClients,
    api_requests_24h: apiRequests24h,
    memory_usage_mb: memoryUsageMb,
    avg_response_time_ms: avgResponseTimeMs,
  }
}
