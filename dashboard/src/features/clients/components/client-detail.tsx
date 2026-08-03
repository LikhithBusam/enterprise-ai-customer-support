import { Building2, History } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/status/empty-state"
import { ErrorState } from "@/components/status/error-state"
import { NodeInspectorSkeleton } from "@/components/status/skeletons"
import { MetaRow } from "@/components/meta-row"
import { ClientCard } from "@/features/clients/components/client-card"
import { UsageBadge } from "@/features/clients/components/usage-badge"
import { RateLimitCard } from "@/features/clients/components/rate-limit-card"
import { FeatureFlagList } from "@/features/clients/components/feature-flag-list"
import { maskApiKey } from "@/lib/clients"
import { formatRelativeTime } from "@/lib/format"
import type { ClientDetail as ClientDetailData } from "@/types/mocked"

interface ClientDetailPanelProps {
  client: ClientDetailData | null
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

/** Center panel — human-readable summary of the currently-selected client: information, plan,
 * masked API key, usage/memory summaries, current limits, feature flags, recent activity, and
 * status. Distinct from the right-hand Client Inspector, which shows raw technical metadata. */
export function ClientDetailPanel({ client, isLoading, isError, onRetry }: ClientDetailPanelProps) {
  if (isError) {
    return (
      <Card>
        <CardContent className="pt-4">
          <ErrorState title="Couldn't load this client" onRetry={onRetry} />
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return <NodeInspectorSkeleton />
  }

  if (!client) {
    return (
      <Card>
        <CardContent className="pt-4">
          <EmptyState
            icon={Building2}
            title="No client selected"
            description="Select a client in the table to view its details."
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <ClientCard
            name={client.name}
            clientId={client.client_id}
            plan={client.plan}
            status={client.status}
            size="lg"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">API key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          <MetaRow label="Key" value={<span className="font-mono">{maskApiKey(client.api_key_last4)}</span>} />
          <MetaRow label="Created" value={formatRelativeTime(client.created_at)} />
          <MetaRow label="Updated" value={formatRelativeTime(client.updated_at)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Usage summary</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageBadge used={client.monthly_ticket_usage} limit={client.monthly_ticket_limit} showDetail />
          <p className="mt-2 text-xs text-muted-foreground">Monthly ticket volume against the plan limit.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Memory usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <UsageBadge used={client.memory_usage_mb} limit={client.memory_usage_limit_mb} showDetail />
          <MetaRow label="Retention window" value={`${client.memory_retention_days} days`} />
        </CardContent>
      </Card>

      <RateLimitCard rateLimits={client.rate_limits} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Feature flags</CardTitle>
        </CardHeader>
        <CardContent>
          <FeatureFlagList flags={client.feature_flags} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {client.recent_activity.length === 0 ? (
            <EmptyState icon={History} title="No recent activity" />
          ) : (
            client.recent_activity.slice(0, 8).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{entry.action}</p>
                  <p className="truncate text-muted-foreground">{entry.actor}</p>
                </div>
                <time className="shrink-0 text-muted-foreground">{formatRelativeTime(entry.timestamp)}</time>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
