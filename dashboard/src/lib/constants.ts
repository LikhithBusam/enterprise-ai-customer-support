export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000"

export const APP_NAME = "Support Console"

/** Query key roots — one per resource, namespaced consistently across features. */
export const QUERY_KEYS = {
  dashboardSummary: ["dashboard", "summary"] as const,
  activityFeed: ["dashboard", "activity"] as const,
  conversations: ["conversations", "list"] as const,
  conversation: (ticketId: string) => ["conversations", "detail", ticketId] as const,
  liveExecution: (ticketId: string) => ["conversations", "live", ticketId] as const,
  memoryList: ["memory", "list"] as const,
  memoryDetail: (id: string) => ["memory", "detail", id] as const,
  memoryStats: (type: string) => ["memory", "stats", type] as const,
  tools: ["tools", "list"] as const,
  toolDetail: (toolName: string) => ["tools", "detail", toolName] as const,
  toolStats: ["tools", "stats"] as const,
  toolHistory: (toolName: string) => ["tools", "history", toolName] as const,
  analyticsSummary: ["analytics", "summary"] as const,
  analyticsCharts: ["analytics", "charts"] as const,
  analyticsTables: ["analytics", "tables"] as const,
  experiments: ["experiments", "list"] as const,
  experimentCompare: ["experiments", "compare"] as const,
  experimentCharts: ["experiments", "charts"] as const,
  clients: ["clients", "list"] as const,
  client: (clientId: string) => ["clients", "detail", clientId] as const,
  clientStats: ["clients", "stats"] as const,
  settings: ["settings"] as const,
  settingsModels: ["settings", "models"] as const,
  auditLogs: ["audit-logs", "list"] as const,
  auditLogDetail: (id: string) => ["audit-logs", "detail", id] as const,
  auditLogStats: ["audit-logs", "stats"] as const,
  profile: ["profile"] as const,
  help: ["help"] as const,
} as const
