import { API_BASE_URL, APP_NAME } from "@/lib/constants"
import type { HelpResponse } from "@/types/mocked"

/** Static, deterministic reference content — no faker/seed needed since this isn't a generated
 * dataset, it's hand-written documentation content (same rationale as `AUDIT_ACTOR_OPTIONS`
 * being a fixed cast rather than generated). */
const HELP_DATA: HelpResponse = {
  categories: [
    {
      key: "getting_started",
      label: "Getting Started",
      description: "Sign in, switch clients, and find your way around the console.",
      article_count: 3,
    },
    {
      key: "conversations",
      label: "Conversations",
      description: "The ticket list, detail view, and Live Agent Execution replay.",
      article_count: 4,
    },
    {
      key: "memory",
      label: "Memory Explorer",
      description: "Episodic, Plan Success, Tool Failure, Escalation, and Policy memory.",
      article_count: 3,
    },
    {
      key: "tools",
      label: "Tool Monitoring",
      description: "Health, circuit breakers, and latency for every tool the agents call.",
      article_count: 3,
    },
    {
      key: "analytics",
      label: "Analytics",
      description: "KPIs, trends, and top-N tables across the whole pipeline.",
      article_count: 2,
    },
    {
      key: "experiments",
      label: "Experiment Dashboard",
      description: "Comparing baselines against the Policy Memory research results.",
      article_count: 2,
    },
    {
      key: "clients",
      label: "Client Management",
      description: "Plans, rate limits, feature flags, and per-client usage.",
      article_count: 3,
    },
    {
      key: "audit_security",
      label: "Audit Logs & Security",
      description: "The compliance trail and your account's security settings.",
      article_count: 3,
    },
    {
      key: "settings",
      label: "Settings",
      description: "Organization-wide AI model, memory, and notification configuration.",
      article_count: 4,
    },
    {
      key: "api_integrations",
      label: "API & Integrations",
      description: "The real ticket-submission endpoint, API keys, and the mocked contract.",
      article_count: 3,
    },
  ],

  faqs: [
    {
      id: "faq-1",
      category: "getting_started",
      question: "How do I switch between clients?",
      answer:
        "Use the client switcher in the top-left of the topbar. Dashboard, Conversations, Memory, and Analytics all scope their data to the currently selected client.",
    },
    {
      id: "faq-2",
      category: "getting_started",
      question: "Where do I change the theme, language, or time zone?",
      answer:
        "Open your user menu (top-right) → Profile → Preferences. Theme changes apply immediately on save; the topbar's quick toggle controls the same setting.",
    },
    {
      id: "faq-3",
      category: "conversations",
      question: "Why does a ticket show multiple replanning attempts?",
      answer:
        "The Critic agent re-invokes the Planner whenever a tool call fails or its output doesn't satisfy the ticket, up to a configured iteration cap. Live Agent Execution shows exactly which node triggered each replan.",
    },
    {
      id: "faq-4",
      category: "conversations",
      question: "What does \"Memory hit\" mean on a ticket?",
      answer:
        "It means the Planner reused a stored plan template, past outcome, or policy from memory instead of asking the LLM to plan from scratch — see Memory Explorer for the underlying entry.",
    },
    {
      id: "faq-5",
      category: "memory",
      question: "What's the difference between Episodic and Policy memory?",
      answer:
        "Episodic memory replays a specific past ticket outcome. Policy memory stores a reusable, intent-clustered workflow template instead — this dashboard's research question is whether policy-based memory generalizes better than ticket-based replay.",
    },
    {
      id: "faq-6",
      category: "tools",
      question: "What triggers a circuit breaker to open?",
      answer:
        "Three consecutive failures on the same tool open its circuit breaker; it half-opens again after a 60-second cooldown. Tool Monitoring's Retry Trend and Error Distribution charts help identify whether a failure was transient.",
    },
    {
      id: "faq-7",
      category: "experiments",
      question: "What do the failure-rate tiers (0.0 / 0.3 / 0.7) mean?",
      answer:
        "Each tier is the synthetic failure rate injected into tool calls for that experiment run — 0.0 is a clean run, 0.7 stresses replanning and memory recovery heavily.",
    },
    {
      id: "faq-8",
      category: "clients",
      question: "How is client data isolated?",
      answer:
        "Memory is stored in a separate collection per client_id by design — this dashboard never merges memory across clients, and the retention window is configured per-client under Settings → Memory.",
    },
    {
      id: "faq-9",
      category: "audit_security",
      question: "Who can see the audit log?",
      answer:
        "Audit Logs is under the Admin navigation group alongside Client Management and Settings — the same access level as those pages in this build.",
    },
    {
      id: "faq-10",
      category: "settings",
      question: "Where do I rotate an API key?",
      answer: "Settings → Security lists your provisioned keys; rotation is initiated from there.",
    },
    {
      id: "faq-11",
      category: "api_integrations",
      question: "Is there a real backend endpoint I can call?",
      answer:
        "Yes — POST /v1/tickets and GET /health are wired to the actual FastAPI backend. Every other endpoint this dashboard calls (memory, tools, analytics, clients, audit, settings, profile, help) is served by a mock service worker; see API_CONTRACT.md for the full documented contract.",
    },
  ],

  quick_links: [
    { id: "ql-1", label: "Dashboard", description: "System health and activity at a glance.", path: "/" },
    { id: "ql-2", label: "Conversations", description: "Browse and filter every ticket.", path: "/conversations" },
    { id: "ql-3", label: "Memory Explorer", description: "Inspect stored memory by type.", path: "/memory" },
    { id: "ql-4", label: "Tool Monitoring", description: "Live tool health and circuit breakers.", path: "/tools" },
    { id: "ql-5", label: "Security Settings", description: "API keys, MFA, and session policy.", path: "/settings?section=security" },
    { id: "ql-6", label: "Audit Logs", description: "The full compliance event trail.", path: "/audit-logs" },
  ],

  api_docs: [
    {
      id: "doc-1",
      label: "Interactive API docs (Swagger UI)",
      description: "Auto-generated OpenAPI explorer for the real backend, if it's running locally.",
      method: null,
      path: null,
      url: `${API_BASE_URL}/docs`,
    },
    {
      id: "doc-2",
      label: "ReDoc reference",
      description: "Alternate auto-generated reference view of the same OpenAPI schema.",
      method: null,
      path: null,
      url: `${API_BASE_URL}/redoc`,
    },
    {
      id: "doc-3",
      label: "Submit a ticket",
      description: "The only real, non-mocked write endpoint this dashboard calls.",
      method: "POST",
      path: "/v1/tickets",
      url: null,
    },
    {
      id: "doc-4",
      label: "Health check",
      description: "Liveness probe for the production API.",
      method: "GET",
      path: "/health",
      url: null,
    },
    {
      id: "doc-5",
      label: "Full mocked API contract",
      description: "Every other endpoint (memory, tools, clients, audit, settings, profile, help, …) is documented in API_CONTRACT.md at the project root.",
      method: null,
      path: null,
      url: null,
    },
  ],

  troubleshooting: [
    {
      id: "ts-1",
      category: "tools",
      issue: "A tool shows \"Offline\" with its circuit breaker open",
      solution:
        "The breaker opens after 3 consecutive failures and half-opens after a 60s cooldown. Check Tool Monitoring's Retry Trend and Error Distribution charts — transient failures should recover within a minute on their own.",
    },
    {
      id: "ts-2",
      category: "experiments",
      issue: "An experiment run is very slow",
      solution:
        "The experiment driver makes real LLM calls and the free-tier provider caps at roughly 35 requests/minute — always run with a small ticket limit for iteration rather than a full pass.",
    },
    {
      id: "ts-3",
      category: "memory",
      issue: "Memory Explorer shows fewer results than expected",
      solution:
        "Memory is isolated per client — confirm the topbar's client switcher matches the client you expect, and check the retention window under Settings → Memory.",
    },
    {
      id: "ts-4",
      category: "getting_started",
      issue: "Signing in doesn't seem to validate the API key",
      solution:
        "This build's sign-in is a mocked frontend flow — it accepts any email and API key and stores them in localStorage. There is no real credential check against the backend yet.",
    },
    {
      id: "ts-5",
      category: "audit_security",
      issue: "A settings change doesn't appear in Audit Logs",
      solution:
        "Audit Logs' event feed is deterministic seeded mock data — it does not yet reflect live actions taken elsewhere in this dashboard session (see API_CONTRACT.md's grounding notes for that endpoint).",
    },
  ],

  support_contacts: [
    {
      id: "contact-1",
      channel: "Email",
      label: "Email Support",
      value: "support@supportconsole.example",
      url: "mailto:support@supportconsole.example",
    },
    {
      id: "contact-2",
      channel: "Documentation",
      label: "Project README",
      value: "See README.md in the repository",
      url: null,
    },
    {
      id: "contact-3",
      channel: "Escalation",
      label: "Escalation Policy",
      value: "Contact your workspace administrator",
      url: null,
    },
  ],

  about: {
    app_name: APP_NAME,
    // Mirrors package.json's `version` field — this dashboard has no build pipeline that stamps
    // a version, so it's kept in sync by hand rather than fabricated.
    version: "0.0.0",
    // package.json declares `"private": true` and no LICENSE file exists in the repo — reflecting
    // that honestly rather than inventing a license this project hasn't actually adopted.
    license: "Unlicensed (private repository)",
    environment: import.meta.env.MODE,
  },
}

export function getHelp(): HelpResponse {
  return HELP_DATA
}
