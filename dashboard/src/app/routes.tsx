import { lazy } from "react"
import { createBrowserRouter, Navigate } from "react-router-dom"
import { AppShell } from "@/layouts/app-shell"
import { ProtectedRoute } from "@/app/protected-route"
import { LoginPage } from "@/features/auth/login-page"
import { ComingSoon } from "@/components/layout/coming-soon"

// Lazy-loaded: every authenticated page is its own chunk, fetched on first visit instead of
// bundled into the initial load (see the Production Readiness Audit's Performance Report — this
// was previously a single ~1.9MB/593KB-gzip chunk regardless of which page a user opened).
// LoginPage and ComingSoon stay eager above: Login is the very first thing an unauthenticated
// user needs (lazy-loading it would add a chunk round-trip before they can even sign in, with no
// offsetting benefit), and ComingSoon is a tiny shared placeholder already paid for by whichever
// real page chunk references it.
const DashboardPage = lazy(() =>
  import("@/features/dashboard/dashboard-page").then((m) => ({ default: m.DashboardPage })),
)
const ConversationsPage = lazy(() =>
  import("@/features/conversations/conversations-page").then((m) => ({ default: m.ConversationsPage })),
)
const ConversationDetailPage = lazy(() =>
  import("@/features/conversations/conversation-detail-page").then((m) => ({
    default: m.ConversationDetailPage,
  })),
)
const LiveExecutionPage = lazy(() =>
  import("@/features/live-execution/live-execution-page").then((m) => ({ default: m.LiveExecutionPage })),
)
const MemoryExplorerPage = lazy(() =>
  import("@/features/memory-explorer/memory-explorer-page").then((m) => ({ default: m.MemoryExplorerPage })),
)
const ToolMonitoringPage = lazy(() =>
  import("@/features/tool-monitoring/tool-monitoring-page").then((m) => ({ default: m.ToolMonitoringPage })),
)
const AnalyticsPage = lazy(() =>
  import("@/features/analytics/analytics-page").then((m) => ({ default: m.AnalyticsPage })),
)
const ExperimentDashboardPage = lazy(() =>
  import("@/features/experiments/experiment-dashboard-page").then((m) => ({
    default: m.ExperimentDashboardPage,
  })),
)
const ClientManagementPage = lazy(() =>
  import("@/features/clients/client-management-page").then((m) => ({ default: m.ClientManagementPage })),
)
const SettingsPage = lazy(() =>
  import("@/features/settings/settings-page").then((m) => ({ default: m.SettingsPage })),
)
const AuditLogsPage = lazy(() =>
  import("@/features/audit-logs/audit-logs-page").then((m) => ({ default: m.AuditLogsPage })),
)
const ProfilePage = lazy(() =>
  import("@/features/profile/profile-page").then((m) => ({ default: m.ProfilePage })),
)
const HelpPage = lazy(() => import("@/features/help/help-page").then((m) => ({ default: m.HelpPage })))
const NewTicketPage = lazy(() =>
  import("@/features/tickets/new-ticket-page").then((m) => ({ default: m.NewTicketPage })),
)

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "conversations", element: <ConversationsPage /> },
      { path: "conversations/:ticketId", element: <ConversationDetailPage /> },
      { path: "conversations/:ticketId/live", element: <LiveExecutionPage /> },
      { path: "tickets/new", element: <NewTicketPage /> },
      { path: "memory", element: <MemoryExplorerPage /> },
      { path: "tools", element: <ToolMonitoringPage /> },
      { path: "analytics", element: <AnalyticsPage /> },
      { path: "experiments", element: <ExperimentDashboardPage /> },
      { path: "clients", element: <ClientManagementPage /> },
      { path: "clients/:clientId", element: <ComingSoon title="Client Detail" /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "audit-logs", element: <AuditLogsPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "help", element: <HelpPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
])
