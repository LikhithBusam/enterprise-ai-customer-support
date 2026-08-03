# API Contract

This documents every HTTP endpoint the dashboard calls — which ones are **real** (hit the actual
FastAPI backend in `src/api/`) and which are **mocked** via MSW (`src/services/mock/handlers/`),
serving as the implementation target for a real backend later. Every mocked endpoint's shape is
generated from the TypeScript types in `src/types/mocked.ts` — that file is the single source of
truth; keep this document and that file in sync as new endpoints are added.

See the approved frontend architecture plan for the full rationale (zero backend code changes;
service-layer swap is additive only).

## Real Endpoints (backend already implements these — `src/api/main.py`)

### `GET /health`

No auth. Response:

```json
{ "status": "ok" }
```

### `POST /v1/tickets`

Auth: `X-API-Key` header → `client_id`. Request:

```json
{
  "ticket_id": "string",
  "customer_id": "string",
  "customer_message": "string",
  "intent_label": "string (optional, empty = classify automatically)"
}
```

Response:

```json
{
  "ticket_id": "string",
  "resolved": "boolean",
  "escalate": "boolean",
  "response_message": "string",
  "replanning_count": "number",
  "memory_hit": "boolean",
  "iteration": "number",
  "tool_calls_made": "array",
  "replayed": "boolean"
}
```

---

## Mocked Endpoints (MSW today — future real-backend targets)

### `GET /v1/dashboard/summary`

Auth: `X-API-Key` header (mocked — not yet enforced by the handler). Response: `DashboardSummary`
(`src/types/mocked.ts`) — ticket counts, success/escalation/memory-hit/policy-retrieval/tool-success
rates, latency, token usage, agent health.

### `GET /v1/dashboard/activity`

Response: `ActivityFeedItem[]` — recent ticket activity for the live feed.

### `GET /v1/conversations`

Query params (all optional):

| Param | Type | Notes |
|---|---|---|
| `page` | number | 1-indexed, default 1 |
| `pageSize` | number | default 20, min 10, max 100 |
| `search` | string | matches ticket_id, customer_name, or customer_message (case-insensitive substring) |
| `status` | comma-separated string | filters to any of `resolved,escalated,pending,in_progress,failed` |
| `intent` | comma-separated string | filters to any of the 6 intent clusters (see below) |
| `sortBy` | `created_at \| ticket_id \| status \| replanning_count` | default `created_at` |
| `sortDir` | `asc \| desc` | default `desc` |

Response:

```json
{ "data": "ConversationSummary[]", "total": "number" }
```

`ConversationSummary` (`src/types/mocked.ts`): `ticket_id`, `customer_id`, `customer_name`,
`customer_message`, `status`, `intent_label`, `created_at`, `resolved_at`, `replanning_count`,
`memory_hit`, `latency_ms`.

Intent clusters (mirrors the research dataset's taxonomy — `data/synthetic_tickets_v2.jsonl`):
`refund_request`, `order_status`, `billing_dispute`, `account_issue`, `complaint_escalation`,
`general_inquiry`.

### `GET /v1/conversations/:ticketId`

Response: `ConversationDetail` (`ConversationSummary` + `response_message`, `tool_calls_made`
(array of `{tool_name, params, success, failure_type, data, iteration, duration_ms}`),
`escalation_summary`). 404 with `{"detail": "Conversation not found"}` if the ticket doesn't
exist in the fixture set.

### `GET /v1/conversations/:ticketId/execution`

The LangGraph pipeline's node-by-node execution state for this ticket (`src/graph/pipeline.py`'s
9-node chain: `start → intake → planner → executor → critic → executor_retry (conditional) →
response → memory_write → end` — `executor_retry` is omitted entirely when the ticket's
`replanning_count` is 0). Response: `ExecutionTrace` (`src/types/mocked.ts`):

```json
{
  "ticket_id": "string",
  "current_node": "AgentNodeId",
  "completed": "boolean",
  "nodes": "AgentNodeExecution[]",
  "metrics": {
    "total_duration_ms": "number",
    "tool_call_count": "number",
    "retry_count": "number",
    "memory_retrieval_count": "number",
    "tokens_used": "number",
    "estimated_cost_usd": "number"
  }
}
```

Each `AgentNodeExecution` carries `node_id`, `status` (`pending | active | done | failed |
skipped`), `started_at`, `duration_ms`, `input_summary`, `output_summary`, `retrieved_memories`,
`tool_calls`, `reasoning_summary`, `confidence`, `retry_count`. For `pending`/`in_progress`
tickets, nodes past the current point are `pending` (no timestamp/duration yet) — this is what
lets the graph show a live "current node" pulse instead of a fully-resolved trace.

404 with `{"detail": "Conversation not found"}` if the ticket doesn't exist.

### `GET /v1/conversations/:ticketId/timeline`

The same execution flattened into a chronological event list — one row per node plus one row per
tool call within that node, for the timeline view below the graph. Response: `ExecutionTimelineEvent[]`:

```json
{ "id": "string", "timestamp": "string", "node_id": "AgentNodeId", "label": "string", "detail": "string | null", "duration_ms": "number | null", "status": "success | failed | retry" }
```

### `GET /v1/conversations/:ticketId/tool-calls`

Every tool call made during the execution (across both the initial pass and any retry pass),
richer than `AgentNodeExecution.tool_calls` since the Tool Calls table needs per-call arguments,
full output, and a retry count. Response: `ExecutionToolCallRecord[]`:

```json
{ "id": "string", "tool_name": "string", "arguments": "object", "duration_ms": "number", "status": "success | failed", "retries": "number", "output_summary": "string", "output": "object | null", "failure_type": "string | null", "iteration": "number" }
```

### `GET /v1/memory`

Lists memory entries across all 5 types (`src/memory/{episodic,plan_success,tool_failure,
escalation}.py` plus the research-only `memory/policy_memory.py` — see `CLAUDE.md`'s "Policy
Memory (Contribution 2)" section). Query params (all optional):

| Param | Type | Notes |
|---|---|---|
| `page` | number | 1-indexed, default 1 |
| `pageSize` | number | default 20, min 10, max 100 |
| `search` | string | substring match on id, summary, tags (case-insensitive) |
| `types` | comma-separated string | any of `episodic,plan_success,tool_failure,escalation,policy` |
| `status` | comma-separated string | any of `active,stale,archived` |
| `simMin` / `simMax` | number (0–1) | filters `similarity_score`; entries with no score are excluded once either bound is set |
| `usageMin` / `usageMax` | number | filters `usage_count` |
| `dateFrom` / `dateTo` | ISO date string | filters `timestamp`, inclusive |
| `sortBy` | `id \| memory_type \| timestamp \| similarity_score \| confidence \| usage_count \| last_retrieved_at \| status` | default `timestamp` |
| `sortDir` | `asc \| desc` | default `desc` |

Response: `{ "data": "MemoryEntryBase[]", "total": "number" }`. `MemoryEntryBase`
(`src/types/mocked.ts`): `id`, `memory_type`, `client_id`, `timestamp`, `last_retrieved_at`,
`similarity_score`, `retrieved`, `usage_count`, `confidence`, `status`, `tags`, `summary`,
`source`, `related_ticket_id`, `explanation`, `raw`.

### `GET /v1/memory/:id`

Response: `MemoryEntryBase`. 404 with `{"detail": "Memory entry not found"}` if the id doesn't
exist.

### `GET /v1/memory/stats`

Optional `type` query param scopes every figure to one memory type; omitted, it covers all
types. Response: `MemoryStats`:

```json
{
  "total_count": "number",
  "active_count": "number",
  "retrieved_rate": "number",
  "avg_confidence": "number",
  "avg_similarity": "number | null",
  "by_type": [{ "memory_type": "MemoryType", "count": "number" }],
  "usage_trend": [{ "date": "string", "count": "number" }],
  "retrieval_frequency": [{ "date": "string", "count": "number" }],
  "similarity_histogram": [{ "bucket": "string", "count": "number" }]
}
```

`usage_trend` counts entries by `timestamp` day (new memories written per day); `retrieval_frequency`
counts entries by `last_retrieved_at` day; `similarity_histogram` buckets `similarity_score` into
`0.6–0.7 / 0.7–0.8 / 0.8–0.9 / 0.9–1.0` (the mocked data's scores never fall below ~0.6).

### `GET /v1/tools`

Lists operational health for every tool in the real `ToolRegistry` (`src/tools/registry.py`) —
deliberately just the 4 real tools (`crm`, `order_lookup`, `kb_search`, `refund`), not the larger
example list (Email, Payment, Inventory, ...) from the original feature brief, since those don't
exist in the backend and inventing them would violate "do not invent backend functionality."
Query params (all optional):

| Param | Type | Notes |
|---|---|---|
| `page` / `pageSize` | number | pagination (moot at 4 tools today, kept for parity with other lists) |
| `search` | string | substring match on tool name or description |
| `status` | comma-separated string | any of `healthy,degraded,offline,maintenance,unknown` |
| `latencyMin` / `latencyMax` | number (ms) | filters `avg_latency_ms` |
| `successMin` | number (0–100) | filters `success_rate * 100 >= successMin` |
| `failureMax` | number (0–100) | filters `failure_rate * 100 <= failureMax` |
| `dateFrom` / `dateTo` | ISO date string | filters `last_used_at`, inclusive |
| `sortBy` | `tool_name \| status \| availability \| avg_latency_ms \| success_rate \| failure_rate \| retry_count_24h \| last_used_at` | default `tool_name` |
| `sortDir` | `asc \| desc` | default `asc` |

Response: `{ "data": "ToolHealth[]", "total": "number" }`. `ToolHealth` (`src/types/mocked.ts`):
`tool_name`, `description`, `purpose`, `status`, `availability`, `avg_latency_ms`,
`p95_latency_ms`, `p99_latency_ms`, `success_rate`, `failure_rate`, `retry_rate`,
`retry_count_24h`, `circuit_breaker_state`, `last_used_at`, `last_error`.

### `GET /v1/tools/:id`

Response: `ToolDetail` (`ToolHealth` plus `recent_requests: ToolRequestRecord[]`,
`recent_errors`, `timeline: ToolTimelineEvent[]`). 404 with `{"detail": "Tool not found"}` if the
tool name doesn't match one of the 4 real tools.

### `GET /v1/tools/stats`

Response: `ToolStats` — `total_tools`, `healthy_count`, `degraded_count`, `offline_count`,
`avg_latency_ms`, `success_rate`, `retry_rate`, `circuit_breakers_open`, plus 6 chart series:
`latency_trend`, `success_trend`, `failure_trend`, `retry_trend`, `usage_frequency`,
`error_distribution`, `response_time_histogram`.

### `GET /v1/tools/:id/history`

Response: `{ "tool_name": "string", "points": [{ "timestamp": "string", "latency_ms": "number", "success": "boolean" }] }`
— per-request latency/outcome points for that one tool, the same underlying data `recent_requests`
on `ToolDetail` draws from, exposed separately for a future longer-range history view.

### `GET /v1/analytics/summary`

Executive KPIs plus deterministic insight callouts, both computed over the same filtered
conversation set. Query params (all optional, all can combine):

| Param | Type | Notes |
|---|---|---|
| `dateFrom` / `dateTo` | ISO date string | filters `created_at`; omitted defaults to the full mocked dataset's span |
| `intent` | comma-separated string | any of the 6 intent clusters (see Conversations) |
| `status` | comma-separated string | any of `resolved,escalated,pending,in_progress,failed` |
| `tool` | comma-separated string | any of `crm,order_lookup,kb_search,refund` — scopes both the conversation set (must have called at least one selected tool) and every tool-derived chart/table |
| `memoryType` | comma-separated string | any of `episodic,plan_success,tool_failure,escalation,policy` — scopes only the Memory Usage chart and Most Frequently Retrieved Memories table, not ticket-level KPIs |
| `resolution` | `all \| resolved \| unresolved` | coarse lens layered on top of `status` |
| `client` | string | one of `acme-retail`, `nova-goods`, `brightpath` (see grounding note below), or omitted for all |

Response: `AnalyticsSummaryResponse` (`src/types/mocked.ts`):

```json
{
  "summary": {
    "total_conversations": { "value": 60, "previous_value": 84, "delta": -24, "delta_pct": -0.286 },
    "resolved": "AnalyticsKpi",
    "escalated": "AnalyticsKpi",
    "resolution_rate": "AnalyticsKpi",
    "avg_resolution_time_ms": "AnalyticsKpi",
    "avg_tool_calls": "AnalyticsKpi",
    "avg_memory_hit_rate": "AnalyticsKpi",
    "avg_retries": "AnalyticsKpi",
    "avg_latency_ms": "AnalyticsKpi",
    "avg_confidence": "AnalyticsKpi"
  },
  "insights": [{ "id": "string", "tone": "positive | negative | neutral | warning", "title": "string", "description": "string" }]
}
```

Every KPI is compared against the immediately-preceding period of equal length (e.g. filtering to
the last 7 days compares against the 7 days before that). `delta_pct` is `null` when the prior
period has no comparable value (division by zero) — the frontend renders that as "Flat" rather
than a misleading percentage. The 6 possible insights (resolution rate change, escalation count
change, Refund API latency change, Knowledge Base bottleneck detection, most common intent,
highest-retry workflow) are deterministic rules over the same current-vs-previous comparison, not
LLM-generated; the first 4 are suppressed entirely when the previous period has zero data (e.g.
the "All time" preset, whose "previous period" falls before the dataset's earliest ticket).

### `GET /v1/analytics/charts`

Same query params as `/summary`. Response: `AnalyticsChartsResponse` — 10 series, one per
requested chart: `conversation_volume`, `resolution_trend`, `escalation_trend`, `latency_trend`,
`retry_trend` (all `{date, value}[]`, one point per day in the effective range), `tool_usage`,
`memory_usage`, `intent_distribution`, `tool_failure_distribution`, `resolution_success_by_intent`
(all `{label, value}[]`, categorical).

### `GET /v1/analytics/tables`

Same query params as `/summary`. Response: `AnalyticsTablesResponse` — 5 top-10 lists:
`top_customers`, `top_tool_failures`, `highest_retry_conversations`, `longest_resolution_times`
(resolved tickets only), `most_frequent_memories`. Each list is pre-sorted by its primary metric;
the frontend re-sorts client-side on column click since these are always small, fully-fetched
sets rather than server-paginated ones.

**Grounding decisions:** (1) `client_id` and a per-ticket `confidence` score don't exist anywhere
in the mocked data model — Conversations has never been multi-tenant-scoped, and confidence today
only lives per-node on `ExecutionTrace` (Live Execution), never rolled up per ticket. Both are
synthesized deterministically per `ticket_id` (`services/mock/fixtures/analytics.ts`'s `augment()`)
so the "Client" filter and "Average Confidence" KPI have something real and stable to filter/show,
grounded in the same 3 placeholder clients already visible in the topbar switcher
(`app/client-context.tsx`) rather than inventing a fourth. (2) Individual tool calls have no
timestamp of their own on `ConversationDetail` — the owning conversation's `created_at` is used as
a proxy, consistent with `latency_ms` already being ticket-level rather than per-call.

### `GET /v1/experiments`

No query params. Response: `ExperimentListResponse` — `arms` (`ExperimentArmMeta[]`: label,
description, and literal source-file provenance per arm) and `results` (every
`ExperimentArmResult` row, all 5 arms × 3 failure rates unfiltered) — powers the Experiment
Selector's per-card headline resolution rate without a second request per card.

### `GET /v1/experiments/compare`

Query params: `arms` (comma-separated, any of `memoryless,static_react,memory_augmented,v2_full,
policy_memory`) and `failureRates` (comma-separated, any of `0.0,0.3,0.7`) — both required in the
real contract (the frontend always sends the full set explicitly; there is no "all" default at
the HTTP layer, unlike Analytics/Tool Monitoring's optional filters).

Response: `ExperimentCompareResponse`:

```json
{
  "results": "ExperimentArmResult[]",
  "significance": "ExperimentSignificance[]",
  "insights": "InsightItem[]"
}
```

**`ExperimentArmResult`** — one row per (arm, failure_rate) pair actually requested. Every number
is transcribed verbatim from this repository's own `experiments/results/policy_memory_validation/
report.md` (Tables 1–3) and `experiments/results/v2_full_ablation/report.md` (Tables A1–A4) — see
`services/mock/fixtures/experiments.ts`'s file-level comment for the exact provenance and why nulls
appear where a report says "n/a" (e.g. `memory_hit_rate` for `memoryless`/`static_react`, which
have no memory subsystem to hit).

**`ExperimentSignificance`** — one row per real chi-square significance test the research scripts
already ran (`scripts/policy_memory_validation.py` / `scripts/v2_full_ablation.py`), not
recomputed here. Every comparison is anchored on `policy_memory` as `arm_b`, since that's the only
pairing the real reports actually contain — `memoryless`/`static_react`/`memory_augmented` vs.
`policy_memory` come from Table 3; `v2_full` vs. `policy_memory` comes from Table A4.

**`insights`** — deterministic, data-gated `InsightItem[]` (same shape Analytics already defines
and reuses `InsightCard` for). Every rule only fires when the underlying numbers at the
currently-selected arms/failure rates actually support the claim — see
`computeExperimentInsights` in the fixture for the exact conditions (e.g. the "statistically
similar" insight only appears for a pair whose real p-value is ≥ 0.05).

### `GET /v1/experiments/charts`

Same `arms`/`failureRates` query params as `/compare`. Response: `ExperimentChartsResponse` — 7
named series (`resolution_rate`, `latency`, `memory_hit`, `tool_calls`, `retries`,
`policy_retrieval`, `retrieval_distance`, each `ExperimentSeriesPoint[]` = `{arm, failure_rate,
value}`) plus `confidence_interval` (`ExperimentCiPoint[]` = `{arm, failure_rate, value, ci_low,
ci_high}`, populated only for `v2_full`/`policy_memory`, the only two arms the real reports give a
95% Wilson CI for). The frontend's "Performance by Failure Rate" chart reuses the `resolution_rate`
series rendered as a line instead of requesting a second, duplicate series — the two visualizations
differ in chart type (bar vs. line), not in underlying data.

**Grounding decision:** unlike every other feature's mocked data, nothing here is generated by a
seeded PRNG — `services/mock/fixtures/experiments.ts` is a literal, hand-transcribed copy of two
real markdown reports already checked into this repository. If those reports are regenerated from
a new experiment run, this file needs a matching manual update; there is no automated import
pipeline (the original architecture plan's "one-time import script" was scoped out in favor of a
direct, auditable transcription for this phase — small enough dataset, and diffable against the
source reports in code review).

### `GET /v1/clients`

Lists every client tenant. Query params (all optional):

| Param | Type | Notes |
|---|---|---|
| `page` / `pageSize` | number | pagination, default 1 / 20 |
| `search` | string | substring match on name or client_id (case-insensitive) |
| `plan` | comma-separated string | any of `starter,growth,enterprise` |
| `status` | comma-separated string | any of `active,trial,suspended` |
| `usageMin` / `usageMax` | number (0–120) | filters `monthly_ticket_usage / monthly_ticket_limit * 100` |
| `retentionMin` / `retentionMax` | number (days) | filters `memory_retention_days` |
| `dateFrom` / `dateTo` | ISO date string | filters `created_at`, inclusive |
| `sortBy` | `name \| client_id \| plan \| status \| active_users \| monthly_ticket_usage \| memory_retention_days \| rate_limit_per_minute \| created_at` | default `created_at` |
| `sortDir` | `asc \| desc` | default `desc` |

Response: `{ "data": "ClientRecord[]", "total": "number" }`. `ClientRecord` (`src/types/mocked.ts`):
`client_id`, `name`, `plan`, `status`, `api_key_last4`, `active_users`, `monthly_ticket_usage`,
`monthly_ticket_limit`, `memory_retention_days`, `rate_limit_per_minute`, `created_at`. Only the
last 4 characters of the API key are ever returned — the full key is never sent to the frontend
past initial generation, mirroring real API key management UIs.

### `GET /v1/clients/:id`

Response: `ClientDetail` (`ClientRecord` plus `updated_at`, `allowed_models: string[]`,
`feature_flags: ClientFeatureFlag[]`, `rate_limits: {requests_per_minute, requests_per_minute_limit,
burst_limit}`, `memory_usage_mb`, `memory_usage_limit_mb`, `recent_activity:
ClientActivityEntry[]`) — the same list/detail split as `ToolHealth`/`ToolDetail`. 404 with
`{"detail": "Client not found"}` if the id doesn't exist.

### `GET /v1/clients/stats`

Response: `ClientStats` — `total_clients`, `active_clients`, `enterprise_clients`,
`api_requests_24h`, `memory_usage_mb`, `avg_response_time_ms`, computed over every client
regardless of the current list filters (same convention as `GET /v1/tools/stats`).

**Grounding decision:** the 3 clients `app/client-context.tsx`'s topbar switcher already
hardcodes (`acme-retail`, `nova-goods`, `brightpath`) are seeded into this fixture with the same
id/name, so the switcher and Client Management never show contradictory data; ~18 additional
clients are generated deterministically (`@faker-js/faker`, fixed seed) to make list/filter/sort
behavior meaningful. The topbar switcher itself still reads its static placeholder list, not this
endpoint — wiring it to `GET /v1/clients` is a follow-up, not part of this feature.

### `GET /v1/settings`

No query params — one settings document per client (scoped by `X-API-Key` in the real contract;
the mock serves a single shared document since there is no per-client store here). Response:
`SettingsResponse` (`src/types/mocked.ts`): `general`, `ai_models`, `memory`, `security`,
`notifications`, `appearance` (one object per Settings page section) plus `updated_at`.

### `PUT /v1/settings`

Saves exactly one section at a time — the frontend's Edit/Cancel/Save/Reset cycle is per-section,
not a single whole-page form, so this endpoint never needs a partial merge across sections.
Request body: `UpdateSettingsRequest`, a discriminated union on `section`:

```json
{ "section": "general", "data": { "organization_name": "...", "organization_slug": "...", "time_zone": "...", "default_language": "..." } }
```

`section` is one of `general | ai_models | memory | security | notifications | appearance`; `data`
must match that section's full shape (`GeneralSettings`, `AiModelSettings`, `MemorySettings`,
`SecuritySettings`, `NotificationSettings`, or `AppearanceSettings` respectively — see
`src/types/mocked.ts`). Response: the full updated `SettingsResponse`. 400 with
`{"detail": "Unknown settings section"}` if `section` isn't one of the 6 keys.

**Grounding decisions:** (1) `SecuritySettings.api_keys` (`ApiKeyRecord[]`) is read-only through
this endpoint — API keys are provisioned/rotated through a separate key-management flow this
dashboard doesn't yet implement, not edited as a form field, so only the last 4 characters of each
key are ever returned (same convention as Client Management's `api_key_last4`). (2)
`AvailableModelsResponse` (`GET /v1/settings/models`, below) is deliberately not embedded in
`SettingsResponse` — it's a catalog of options the AI Models section's selects render, not a
per-org saved value. (3) The mock fixture holds this document in a single mutable module-level
variable (`services/mock/fixtures/settings.ts`) — the one resource in this dashboard that MSW
actually mutates rather than just reads, since `PUT` needs somewhere to persist the change across
subsequent `GET`s within the session. Resets on a full page reload, same limitation as every other
mocked resource here (no real backend, no database).

### `GET /v1/settings/models`

Response: `AvailableModelsResponse` — `{ "llms": string[], "embedding_models": string[] }`, the
option lists for the AI Models section's Default LLM and Embedding Model selects.

### `GET /v1/audit`

Lists every audit log entry. Query params (all optional):

| Param | Type | Notes |
|---|---|---|
| `page` / `pageSize` | number | pagination, default 1 / 20 |
| `search` | string | substring match on actor, action, resource, or request_id (case-insensitive) |
| `category` | comma-separated string | any of `security,configuration,authentication,api_key,data,system` |
| `actor` | comma-separated string | matches `actor_email` |
| `client` | comma-separated string | matches `client_id` |
| `status` | comma-separated string | any of `success,failure,warning` |
| `severity` | comma-separated string | any of `info,low,medium,high,critical` |
| `dateFrom` / `dateTo` | ISO date string | filters `timestamp`, inclusive |
| `sortBy` | `timestamp \| actor \| client_name \| action \| category \| status \| severity` | default `timestamp` |
| `sortDir` | `asc \| desc` | default `desc` |

Response: `{ "data": "AuditLogEntry[]", "total": "number" }`. `AuditLogEntry` (`src/types/mocked.ts`):
`id`, `timestamp`, `actor`, `actor_email`, `client_id`, `client_name`, `action`, `category`,
`resource`, `status`, `severity`, `ip_address`, `request_id`.

### `GET /v1/audit/:id`

Response: `AuditLogDetail` (`AuditLogEntry` plus `old_value`/`new_value` — `Record<string,
unknown> | null`, populated only for configuration-changing actions — `user_agent`,
`correlation_id`, `metadata`, and `timeline: AuditTimelineEvent[]`, the other events sharing this
entry's `correlation_id` in chronological order) — the same list/detail split as `ToolHealth`/
`ToolDetail` and `ClientRecord`/`ClientDetail`. 404 with `{"detail": "Audit log entry not found"}`
if the id doesn't exist.

### `GET /v1/audit/stats`

Response: `AuditStats` — `total_events`, `security_events`, `configuration_changes`,
`authentication_events`, `api_key_changes`, `events_last_24h`, computed over every event
regardless of the current list filters (same convention as `GET /v1/tools/stats` and
`GET /v1/clients/stats`).

**Grounding decisions:** (1) the `client` filter and every audit event's `client_id`/`client_name`
reuse the same 3 seeded clients Client Management's fixture defines (`acme-retail`, `nova-goods`,
`brightpath`), so filtering audit logs by client and by the topbar switcher stay consistent. (2)
`actor`/`client` faceted-filter options come from a fixed, small generated cast (6 actors incl.
`system@internal`) rather than a live distinct-values endpoint — real audit tooling (Okta System
Log, GitHub's audit log) typically backs this with a dedicated facets/aggregation endpoint, which
is out of scope for the mock; `AUDIT_ACTOR_OPTIONS`/`AUDIT_CLIENT_OPTIONS` are exported directly
from the fixture module for the toolbar to consume.

### `GET /v1/profile`

Response: `ProfileResponse` (`src/types/mocked.ts`) — `name`, `email`, `avatar_url` (`string |
null`), `role` (`owner | admin | member | viewer`), `organization`, `api_key_last4`,
`preferences` (`{ theme: "light" | "dark" | "system", language, timezone }`), `security`
(`{ mfa_enabled, last_login_at, last_password_change_at, active_sessions }`), `recent_activity`
(`ProfileActivityEntry[]` — `id`, `action`, `timestamp`, `ip_address`), `updated_at`.

`role`, `organization`, `api_key_last4`, `security`, and `recent_activity` are read-only from this
endpoint's perspective — a real backend would derive them from the auth session, org membership,
and an audit trail respectively, not accept them via `PUT`.

### `PUT /v1/profile`

Request body is a discriminated union on `section`, same convention as `PUT /v1/settings`'s
`UpdateSettingsRequest`, so Profile Information and Preferences can save independently as two
separate Edit/Save/Cancel cards:

```
{ "section": "info", "data": { "name": string, "email": string, "avatar_url": string | null } }
{ "section": "preferences", "data": { "theme": "light" | "dark" | "system", "language": string, "timezone": string } }
```

Response: the full updated `ProfileResponse`. 400 with `{"detail": "Unknown profile section"}` for
an unrecognized `section`.

**Grounding decisions:** (1) `email` displayed on first load is read from the same
`localStorage["user_email"]` the (mocked) login flow already writes (`auth-context.tsx`), so the
Profile page reflects whichever account actually signed in, rather than a value disconnected from
the current session. (2) `api_key_last4` ("8f21") matches Settings → Security's seeded
`"Production"` API key — both surfaces display the masked form of the same underlying session
credential. (3) There is no file-upload backend, so `avatar_url` is a plain image-URL field
(validated as `http(s)://…`) rather than a real upload — consistent with not inventing backend
functionality this build can't honestly support. (4) Saving the `theme` preference also calls
`next-themes`' `setTheme()` directly, since that's a real, already-wired capability (the Topbar's
theme toggle uses the same hook) — unlike `language`/`timezone`, which are persisted but not wired
to any live formatter, matching the same-shape precedent already set by Settings → Appearance's
`date_format`/`number_format` fields.

### `GET /v1/help`

Response: `HelpResponse` (`src/types/mocked.ts`) — `categories` (`HelpCategory[]`: `key`, `label`,
`description`, `article_count`), `faqs` (`FaqEntry[]`: `id`, `category`, `question`, `answer`),
`quick_links` (`HelpQuickLink[]`: `id`, `label`, `description`, `path` — always an in-app route),
`api_docs` (`ApiDocLink[]`: `id`, `label`, `description`, `method`, `path`, `url`),
`troubleshooting` (`TroubleshootingEntry[]`: `id`, `category`, `issue`, `solution`),
`support_contacts` (`SupportContact[]`: `id`, `channel`, `label`, `value`, `url`), `about`
(`{ app_name, version, license, environment }`).

Unlike every other resource in this app, this is a single bundled `GET` with no list/detail split
and no server-side filtering — the Help Center page applies search and category filtering
client-side over this one fixed payload (`features/help/filter-help.ts`), since the content is
small, static, and not per-client.

**Grounding decisions:** (1) `quick_links[].path` only ever points to a real in-app route,
rendered via React Router `Link` — never a raw `<a>`, so this content can't silently 404. (2)
`api_docs[].url` is populated for exactly two entries — `{API_BASE_URL}/docs` and
`{API_BASE_URL}/redoc`, the standard auto-generated Swagger/ReDoc routes FastAPI serves for the
real backend (`src/api/main.py`) — every other `api_docs` entry either points at a real endpoint
by `method`/`path` (`POST /v1/tickets`, `GET /health`) with `url: null`, or references
`API_CONTRACT.md` itself; no external domain is fabricated. (3) `troubleshooting` entries are
transcribed from real, already-documented behavior in this repo's own `CLAUDE.md`/`AGENTS.md`
(the NIM rate-limit cap, circuit-breaker thresholds, per-client memory isolation, the mocked
sign-in flow) rather than invented scenarios. (4) `support_contacts`' email uses the reserved
`.example` TLD (RFC 2606) rather than a real-looking domain, consistent with this being a fictional
demo workspace. (5) `about.version`/`about.license` are read from `package.json`'s actual
`version` ("0.0.0") and `private: true` (no `LICENSE` file in this repo) rather than invented
values; `about.environment` reads the real `import.meta.env.MODE` Vite already provides.

---

## Documented, Not Yet Implemented

### `GET /v1/analytics`

A combined-view convenience endpoint (all of `/summary` + `/charts` + `/tables` in one response)
implied by the original feature brief's endpoint list. Not implemented — the frontend fetches the
three granular endpoints above as independent TanStack Query hooks instead, so the KPI cards,
charts, and tables each get their own loading/error state rather than one blocking request.

### `GET /v1/experiments/:id`

Implied by the original feature brief's endpoint list, but doesn't map cleanly onto this data
model — a single "experiment" here is really an (arm, failure_rate) pair, not an entity with its
own id, and `GET /v1/experiments` already returns every such pair unfiltered. `GET /v1/experiments/
compare?arms=<one arm>&failureRates=<one rate>` covers the same single-row use case with the
existing filtering contract instead of adding a parallel id-based route.

### `GET /v1/memory/search`

A distinct **semantic** search endpoint (embedding-similarity ranking against a free-text query),
as opposed to `GET /v1/memory`'s `search` param, which is substring matching only. Not mocked —
the real implementation would need to call the same embedding model the Planner's `retrieve_*`
functions use (`src/agents/memory_manager.py`), which has no client-facing equivalent yet. The
Memory Explorer's search bar currently calls `GET /v1/memory?search=...` for both cases; swapping
in true semantic search later is a service-layer change only.

---

## Endpoints Not Yet Added

Every planned page in the approved build order (Auth, Dashboard, Conversations, Live Agent
Execution, Memory Explorer, Tool Monitoring, Analytics, Experiment Dashboard, Client Management,
Settings, Audit Logs, Profile, Help Center) has been implemented. Nothing is reserved here.
