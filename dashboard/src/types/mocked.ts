/**
 * Domain types for every endpoint that does NOT exist on the real backend yet.
 * These are the single source of truth for: the MSW mock handlers, the fixtures they serve,
 * and API_CONTRACT.md (documented as the implementation target for a real backend). Never mix
 * with `types/api.ts`, which mirrors the two endpoints that ARE real.
 */

export type TicketStatus = "resolved" | "escalated" | "pending" | "in_progress" | "failed"

export interface ConversationSummary {
  ticket_id: string
  customer_id: string
  customer_name: string
  customer_message: string
  status: TicketStatus
  intent_label: string
  created_at: string
  resolved_at: string | null
  replanning_count: number
  memory_hit: boolean
  latency_ms: number
}

export interface ConversationDetail extends ConversationSummary {
  response_message: string
  tool_calls_made: Array<{
    tool_name: string
    params: Record<string, unknown>
    success: boolean
    failure_type: string | null
    data: Record<string, unknown> | null
    iteration: number
    duration_ms: number
  }>
  escalation_summary: string | null
}

export type AgentNodeId =
  | "start"
  | "intake"
  | "planner"
  | "executor"
  | "critic"
  | "executor_retry"
  | "response"
  | "memory_write"
  | "end"

export type AgentNodeStatus = "pending" | "active" | "done" | "failed" | "skipped"

export interface AgentNodeExecution {
  node_id: AgentNodeId
  status: AgentNodeStatus
  started_at: string | null
  duration_ms: number | null
  input_summary: string | null
  output_summary: string | null
  retrieved_memories: Array<{ type: string; summary: string; similarity: number }>
  tool_calls: Array<{ tool_name: string; success: boolean; duration_ms: number }>
  reasoning_summary: string | null
  confidence: number | null
  retry_count: number
}

export interface LiveExecutionState {
  ticket_id: string
  current_node: AgentNodeId
  nodes: AgentNodeExecution[]
  completed: boolean
}

export interface ExecutionMetrics {
  total_duration_ms: number
  tool_call_count: number
  retry_count: number
  memory_retrieval_count: number
  tokens_used: number
  estimated_cost_usd: number
}

/** GET /v1/conversations/:ticketId/execution — the graph-state contract plus rollup metrics. */
export interface ExecutionTrace extends LiveExecutionState {
  metrics: ExecutionMetrics
}

export type ExecutionEventStatus = "success" | "failed" | "retry"

/** GET /v1/conversations/:ticketId/timeline — flat, chronological view of the same execution. */
export interface ExecutionTimelineEvent {
  id: string
  timestamp: string
  node_id: AgentNodeId
  label: string
  detail: string | null
  duration_ms: number | null
  status: ExecutionEventStatus
}

/** GET /v1/conversations/:ticketId/tool-calls — richer than AgentNodeExecution.tool_calls, since
 * the Tool Calls table needs per-call arguments/output/retries the node-level summary omits. */
export interface ExecutionToolCallRecord {
  id: string
  tool_name: string
  arguments: Record<string, unknown>
  duration_ms: number
  status: "success" | "failed"
  retries: number
  output_summary: string
  output: Record<string, unknown> | null
  failure_type: string | null
  iteration: number
}

export type MemoryType =
  | "episodic"
  | "plan_success"
  | "tool_failure"
  | "escalation"
  | "policy"

export type MemoryStatus = "active" | "stale" | "archived"

export interface MemoryEntryBase {
  id: string
  memory_type: MemoryType
  client_id: string
  timestamp: string
  last_retrieved_at: string | null
  similarity_score: number | null
  retrieved: boolean
  usage_count: number
  confidence: number
  status: MemoryStatus
  tags: string[]
  summary: string
  source: string
  related_ticket_id: string | null
  explanation: string
  raw: Record<string, unknown>
}

export interface MemoryTypeBreakdown {
  memory_type: MemoryType
  count: number
}

export interface MemoryTrendPoint {
  date: string
  count: number
}

export interface MemorySimilarityBucket {
  bucket: string
  count: number
}

/** GET /v1/memory/stats */
export interface MemoryStats {
  total_count: number
  active_count: number
  retrieved_rate: number
  avg_confidence: number
  avg_similarity: number | null
  by_type: MemoryTypeBreakdown[]
  usage_trend: MemoryTrendPoint[]
  retrieval_frequency: MemoryTrendPoint[]
  similarity_histogram: MemorySimilarityBucket[]
}

export type ToolStatus = "healthy" | "degraded" | "offline" | "maintenance" | "unknown"
export type CircuitBreakerState = "closed" | "open" | "half_open"

export interface ToolHealth {
  tool_name: string
  description: string
  purpose: string
  status: ToolStatus
  availability: number
  avg_latency_ms: number
  p95_latency_ms: number
  p99_latency_ms: number
  success_rate: number
  failure_rate: number
  retry_rate: number
  retry_count_24h: number
  circuit_breaker_state: CircuitBreakerState
  last_used_at: string | null
  last_error: { timestamp: string; message: string; failure_type: string } | null
}

export interface ToolRequestRecord {
  id: string
  timestamp: string
  ticket_id: string
  duration_ms: number
  status: "success" | "failed"
  failure_type: string | null
}

export type ToolEventStatus = "success" | "failed" | "retry" | "circuit_open" | "circuit_half_open" | "circuit_closed"

export interface ToolTimelineEvent {
  id: string
  timestamp: string
  label: string
  detail: string | null
  status: ToolEventStatus
}

/** GET /v1/tools/:id */
export interface ToolDetail extends ToolHealth {
  recent_requests: ToolRequestRecord[]
  recent_errors: Array<{ timestamp: string; message: string; failure_type: string }>
  timeline: ToolTimelineEvent[]
}

export interface ToolHistoryPoint {
  timestamp: string
  latency_ms: number
  success: boolean
}

/** GET /v1/tools/:id/history */
export interface ToolHistoryResponse {
  tool_name: string
  points: ToolHistoryPoint[]
}

export interface ToolUsagePoint {
  tool_name: string
  count: number
}

export interface ToolErrorBucket {
  failure_type: string
  count: number
}

export interface ToolLatencyBucket {
  bucket: string
  count: number
}

export interface ToolLatencyTrendPoint {
  date: string
  avg_latency_ms: number
}

/** GET /v1/tools/stats */
export interface ToolStats {
  total_tools: number
  healthy_count: number
  degraded_count: number
  offline_count: number
  avg_latency_ms: number
  success_rate: number
  retry_rate: number
  circuit_breakers_open: number
  latency_trend: ToolLatencyTrendPoint[]
  success_trend: MemoryTrendPoint[]
  failure_trend: MemoryTrendPoint[]
  retry_trend: MemoryTrendPoint[]
  usage_frequency: ToolUsagePoint[]
  error_distribution: ToolErrorBucket[]
  response_time_histogram: ToolLatencyBucket[]
}

export interface AnalyticsSeriesPoint {
  timestamp: string
  value: number
}

export interface AnalyticsSeries {
  metric: string
  label: string
  unit: string
  points: AnalyticsSeriesPoint[]
}

/** Mirrors CLAUDE.md's 5 experiment conditions — `scripts/run_experiment.py`'s BASELINES keys,
 * literally the filename stems under experiments/results/*.jsonl. */
export type ExperimentArm = "memoryless" | "static_react" | "memory_augmented" | "v2_full" | "policy_memory"
export type ExperimentFailureRate = "0.0" | "0.3" | "0.7"

export interface ExperimentArmMeta {
  arm: ExperimentArm
  label: string
  description: string
  /** Literal provenance — which real file this arm's numbers were transcribed from. */
  source_files: string[]
}

/** One (arm, failure_rate) cell of Table 1 / Table 2 / Table A1 / Table A2 from the real
 * experiments/results/{policy_memory_validation,v2_full_ablation}/report.md files — every
 * non-null number here is transcribed verbatim from those reports, never recomputed or
 * simulated. Fields that report says "n/a" for a given arm (e.g. memory_hit_rate for
 * memoryless/static_react) are `null`. */
export interface ExperimentArmResult {
  arm: ExperimentArm
  failure_rate: ExperimentFailureRate
  resolution_rate: number
  resolved: number
  total: number
  ci_low: number | null
  ci_high: number | null
  avg_tool_calls: number
  avg_replans: number
  memory_hit_rate: number | null
  policy_retrieval_rate: number | null
  policy_reuse_rate: number | null
  resolution_rate_policy_hit: number | null
  resolution_rate_no_hit: number | null
  distinct_policies_used: number | null
  retrieval_distance: number | null
  avg_latency_ms: number | null
}

/** One row of Table 3 / Table A4 — a real chi-square significance test the research scripts
 * already computed (scripts/policy_memory_validation.py / scripts/v2_full_ablation.py), not
 * something this dashboard recomputes. Every comparison in the mocked data is anchored on
 * `policy_memory` (as `arm_b`) since that's the only pairing the real reports actually ran. */
export interface ExperimentSignificance {
  arm_a: ExperimentArm
  arm_b: ExperimentArm
  failure_rate: ExperimentFailureRate
  p_value: number | null
  significant: boolean
}

/** GET /v1/experiments */
export interface ExperimentListResponse {
  arms: ExperimentArmMeta[]
  results: ExperimentArmResult[]
}

/** GET /v1/experiments/compare */
export interface ExperimentCompareResponse {
  results: ExperimentArmResult[]
  significance: ExperimentSignificance[]
  insights: InsightItem[]
}

export interface ExperimentSeriesPoint {
  arm: ExperimentArm
  failure_rate: ExperimentFailureRate
  value: number | null
}

export interface ExperimentCiPoint {
  arm: ExperimentArm
  failure_rate: ExperimentFailureRate
  value: number
  ci_low: number
  ci_high: number
}

/** GET /v1/experiments/charts */
export interface ExperimentChartsResponse {
  resolution_rate: ExperimentSeriesPoint[]
  latency: ExperimentSeriesPoint[]
  memory_hit: ExperimentSeriesPoint[]
  tool_calls: ExperimentSeriesPoint[]
  retries: ExperimentSeriesPoint[]
  policy_retrieval: ExperimentSeriesPoint[]
  retrieval_distance: ExperimentSeriesPoint[]
  confidence_interval: ExperimentCiPoint[]
}

export type ClientPlan = "starter" | "growth" | "enterprise"
export type ClientStatus = "active" | "suspended" | "trial"

export interface ClientRateLimits {
  requests_per_minute: number
  requests_per_minute_limit: number
  burst_limit: number
}

export interface ClientFeatureFlag {
  key: string
  label: string
  enabled: boolean
}

export interface ClientActivityEntry {
  id: string
  action: string
  actor: string
  timestamp: string
}

/** GET /v1/clients — list row shape. Also backs app/client-context.tsx's topbar switcher once
 * that placeholder swaps to a real query (see that file's comment). */
export interface ClientRecord {
  client_id: string
  name: string
  plan: ClientPlan
  status: ClientStatus
  api_key_last4: string
  active_users: number
  monthly_ticket_usage: number
  monthly_ticket_limit: number
  memory_retention_days: number
  rate_limit_per_minute: number
  created_at: string
}

/** GET /v1/clients/:id — adds configuration/inspector-only fields the list view doesn't need,
 * same split as ToolHealth/ToolDetail above. */
export interface ClientDetail extends ClientRecord {
  updated_at: string
  allowed_models: string[]
  feature_flags: ClientFeatureFlag[]
  rate_limits: ClientRateLimits
  memory_usage_mb: number
  memory_usage_limit_mb: number
  recent_activity: ClientActivityEntry[]
}

/** GET /v1/clients/stats */
export interface ClientStats {
  total_clients: number
  active_clients: number
  enterprise_clients: number
  api_requests_24h: number
  memory_usage_mb: number
  avg_response_time_ms: number
}

export type AuditCategory = "security" | "configuration" | "authentication" | "api_key" | "data" | "system"
export type AuditStatus = "success" | "failure" | "warning"
export type AuditSeverity = "info" | "low" | "medium" | "high" | "critical"

/** GET /v1/audit — list row shape. */
export interface AuditLogEntry {
  id: string
  timestamp: string
  actor: string
  actor_email: string
  client_id: string
  client_name: string
  action: string
  category: AuditCategory
  resource: string
  status: AuditStatus
  severity: AuditSeverity
  ip_address: string
  request_id: string
}

export interface AuditTimelineEvent {
  id: string
  timestamp: string
  actor: string
  action: string
  status: AuditStatus
}

/** GET /v1/audit/:id — adds inspector-only fields the list view doesn't need, same list/detail
 * split as ToolHealth/ToolDetail and ClientRecord/ClientDetail. */
export interface AuditLogDetail extends AuditLogEntry {
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  user_agent: string
  correlation_id: string
  metadata: Record<string, unknown>
  /** Other events sharing this entry's correlation_id, chronologically ordered — powers the Log
   * Inspector's timeline. */
  timeline: AuditTimelineEvent[]
}

/** GET /v1/audit/stats */
export interface AuditStats {
  total_events: number
  security_events: number
  configuration_changes: number
  authentication_events: number
  api_key_changes: number
  events_last_24h: number
}

export interface DashboardSummary {
  tickets_today: number
  tickets_open: number
  tickets_resolved: number
  success_rate: number
  avg_latency_ms: number
  avg_resolution_time_ms: number
  escalation_rate: number
  memory_hit_rate: number
  policy_retrieval_rate: number
  tool_success_rate: number
  llm_tokens_today: number
  agent_health: "healthy" | "degraded" | "down"
}

export interface ActivityFeedItem {
  id: string
  ticket_id: string
  message: string
  status: TicketStatus
  timestamp: string
}

/** A single KPI value paired with its immediately-preceding-period comparison, so every
 * Analytics KPI card can render a TrendBadge without a second round trip. */
export interface AnalyticsKpi {
  value: number
  previous_value: number
  delta: number
  delta_pct: number | null
}

export interface AnalyticsSummary {
  total_conversations: AnalyticsKpi
  resolved: AnalyticsKpi
  escalated: AnalyticsKpi
  resolution_rate: AnalyticsKpi
  avg_resolution_time_ms: AnalyticsKpi
  avg_tool_calls: AnalyticsKpi
  avg_memory_hit_rate: AnalyticsKpi
  avg_retries: AnalyticsKpi
  avg_latency_ms: AnalyticsKpi
  avg_confidence: AnalyticsKpi
}

export type InsightTone = "positive" | "negative" | "neutral" | "warning"

export interface InsightItem {
  id: string
  tone: InsightTone
  title: string
  description: string
}

/** GET /v1/analytics/summary */
export interface AnalyticsSummaryResponse {
  summary: AnalyticsSummary
  insights: InsightItem[]
}

export interface AnalyticsTrendPoint {
  date: string
  value: number
}

export interface AnalyticsCategoryPoint {
  label: string
  value: number
}

/** GET /v1/analytics/charts */
export interface AnalyticsChartsResponse {
  conversation_volume: AnalyticsTrendPoint[]
  resolution_trend: AnalyticsTrendPoint[]
  escalation_trend: AnalyticsTrendPoint[]
  latency_trend: AnalyticsTrendPoint[]
  tool_usage: AnalyticsCategoryPoint[]
  memory_usage: AnalyticsCategoryPoint[]
  retry_trend: AnalyticsTrendPoint[]
  intent_distribution: AnalyticsCategoryPoint[]
  tool_failure_distribution: AnalyticsCategoryPoint[]
  resolution_success_by_intent: AnalyticsCategoryPoint[]
}

export interface TopCustomerRow {
  customer_id: string
  customer_name: string
  ticket_count: number
  resolution_rate: number
  avg_latency_ms: number
}

export interface TopToolFailureRow {
  tool_name: string
  failure_type: string
  count: number
  last_seen: string
}

export interface HighRetryConversationRow {
  ticket_id: string
  customer_name: string
  intent_label: string
  status: TicketStatus
  replanning_count: number
}

export interface LongResolutionRow {
  ticket_id: string
  customer_name: string
  intent_label: string
  resolution_time_ms: number
  resolved_at: string
}

export interface FrequentMemoryRow {
  id: string
  memory_type: MemoryType
  summary: string
  usage_count: number
  last_retrieved_at: string | null
  confidence: number
}

/** GET /v1/analytics/tables */
export interface AnalyticsTablesResponse {
  top_customers: TopCustomerRow[]
  top_tool_failures: TopToolFailureRow[]
  highest_retry_conversations: HighRetryConversationRow[]
  longest_resolution_times: LongResolutionRow[]
  most_frequent_memories: FrequentMemoryRow[]
}

export interface GeneralSettings {
  organization_name: string
  organization_slug: string
  time_zone: string
  default_language: string
}

export interface AiModelSettings {
  default_llm: string
  temperature: number
  max_tokens: number
  embedding_model: string
  tool_timeout_seconds: number
}

export interface MemorySettings {
  memory_enabled: boolean
  memory_retention_days: number
  similarity_threshold: number
  max_memories: number
  auto_cleanup: boolean
}

export interface ApiKeyRecord {
  id: string
  label: string
  key_last4: string
  created_at: string
  last_used_at: string | null
}

export interface SecuritySettings {
  api_keys: ApiKeyRecord[]
  session_timeout_minutes: number
  mfa_enabled: boolean
  ip_allow_list: string[]
  audit_logging_enabled: boolean
}

export interface NotificationSettings {
  email_alerts: boolean
  slack_notifications: boolean
  failure_alerts: boolean
  weekly_reports: boolean
}

export type SettingsTheme = "light" | "dark" | "system"
export type SettingsDensity = "comfortable" | "compact"

export interface AppearanceSettings {
  theme: SettingsTheme
  density: SettingsDensity
  date_format: string
  number_format: string
}

/** GET /v1/settings. Each top-level key is saved independently via PUT /v1/settings — see that
 * endpoint's doc comment in API_CONTRACT.md. */
export interface SettingsResponse {
  general: GeneralSettings
  ai_models: AiModelSettings
  memory: MemorySettings
  security: SecuritySettings
  notifications: NotificationSettings
  appearance: AppearanceSettings
  updated_at: string
}

export type SettingsSectionKey = keyof Omit<SettingsResponse, "updated_at">

/** PUT /v1/settings request body. A discriminated union (rather than a generic
 * `<K extends SettingsSectionKey>{section: K, data: SettingsResponse[K]}`) so `data`'s shape is
 * checked against the specific `section` literal everywhere this is consumed — destructuring a
 * generic pair loses that correlation in TypeScript. Shared by services/endpoints/settings.ts,
 * services/mock/fixtures/settings.ts, and services/mock/handlers/settings.ts so all three agree
 * on one shape. */
export type UpdateSettingsRequest =
  | { section: "general"; data: GeneralSettings }
  | { section: "ai_models"; data: AiModelSettings }
  | { section: "memory"; data: MemorySettings }
  // api_keys is never part of the editable form — keys are provisioned/rotated through a
  // separate flow this dashboard doesn't implement yet, not saved alongside the rest of Security.
  // The mock handler preserves the existing api_keys when applying this update.
  | { section: "security"; data: Omit<SecuritySettings, "api_keys"> }
  | { section: "notifications"; data: NotificationSettings }
  | { section: "appearance"; data: AppearanceSettings }

/** GET /v1/settings/models — populates the AI Models section's Default LLM / Embedding Model
 * selects. A separate endpoint (rather than bundling into SettingsResponse) since this is a
 * catalog of available options, not a per-org saved value. */
export interface AvailableModelsResponse {
  llms: string[]
  embedding_models: string[]
}

export type ProfileRole = "owner" | "admin" | "member" | "viewer"

export interface ProfilePreferences {
  theme: SettingsTheme
  language: string
  timezone: string
}

export interface ProfileSecuritySummary {
  mfa_enabled: boolean
  last_login_at: string
  last_password_change_at: string
  active_sessions: number
}

export interface ProfileActivityEntry {
  id: string
  action: string
  timestamp: string
  ip_address: string
}

/** GET /v1/profile. `role`, `organization`, `api_key_last4`, `security`, and `recent_activity`
 * are read-only on this page — provisioned through Client Management / a future auth flow, not
 * edited here. */
export interface ProfileResponse {
  name: string
  email: string
  avatar_url: string | null
  role: ProfileRole
  organization: string
  api_key_last4: string
  preferences: ProfilePreferences
  security: ProfileSecuritySummary
  recent_activity: ProfileActivityEntry[]
  updated_at: string
}

/** PUT /v1/profile request body. A discriminated union — same rationale as
 * `UpdateSettingsRequest` above — so Profile Information and Preferences can save independently
 * (each is its own Edit/Save/Cancel card) while `data`'s shape still type-checks against its
 * specific `section` literal. */
export type UpdateProfileRequest =
  | { section: "info"; data: { name: string; email: string; avatar_url: string | null } }
  | { section: "preferences"; data: ProfilePreferences }

export type HelpCategoryKey =
  | "getting_started"
  | "conversations"
  | "memory"
  | "tools"
  | "analytics"
  | "experiments"
  | "clients"
  | "audit_security"
  | "settings"
  | "api_integrations"

export interface HelpCategory {
  key: HelpCategoryKey
  label: string
  description: string
  article_count: number
}

export interface FaqEntry {
  id: string
  category: HelpCategoryKey
  question: string
  answer: string
}

/** Always an in-app route — rendered via React Router `Link`, never an external anchor. */
export interface HelpQuickLink {
  id: string
  label: string
  description: string
  path: string
}

/** `url` is set only for a real, standard route this project's own FastAPI backend exposes
 * (`/docs`, `/redoc`) — never a fabricated external domain. Entries describing a mocked or
 * in-repo-only reference (`method`/`path`, or a plain file pointer) leave `url` null. */
export interface ApiDocLink {
  id: string
  label: string
  description: string
  method: string | null
  path: string | null
  url: string | null
}

export interface TroubleshootingEntry {
  id: string
  category: HelpCategoryKey
  issue: string
  solution: string
}

export interface SupportContact {
  id: string
  channel: string
  label: string
  value: string
  url: string | null
}

export interface AboutInfo {
  app_name: string
  version: string
  license: string
  environment: string
}

/** GET /v1/help — the entire Help Center is served by this one bundled endpoint (search and
 * category filtering are applied client-side over the fixed set below, per the approved spec —
 * there's no separate list/detail split like every other resource in this app, since help
 * content isn't a paginated, per-client dataset). */
export interface HelpResponse {
  categories: HelpCategory[]
  faqs: FaqEntry[]
  quick_links: HelpQuickLink[]
  api_docs: ApiDocLink[]
  troubleshooting: TroubleshootingEntry[]
  support_contacts: SupportContact[]
  about: AboutInfo
}
