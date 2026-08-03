import { Wrench } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/status/empty-state"
import { MetaRow } from "@/components/meta-row"
import { JsonInspector } from "@/components/json-inspector"
import { PlanBadge } from "@/features/clients/components/plan-badge"
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge"
import { maskApiKey } from "@/lib/clients"
import { formatNumber, formatRelativeTime } from "@/lib/format"
import type { ClientDetail } from "@/types/mocked"

interface ClientInspectorProps {
  client: ClientDetail | null
}

/** Right panel — raw technical metadata and configuration for the currently-selected client,
 * ending in a copyable Raw JSON block (JsonInspector already ships copy-to-clipboard). Distinct
 * from the center Client Detail panel, which reads as a human-facing summary. */
export function ClientInspector({ client }: ClientInspectorProps) {
  if (!client) {
    return (
      <Card>
        <CardContent className="pt-4">
          <EmptyState
            icon={Wrench}
            title="No client selected"
            description="Select a client in the table to inspect its configuration."
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          <MetaRow label="Client ID" value={<span className="font-mono text-xs">{client.client_id}</span>} />
          <MetaRow label="Plan" value={<PlanBadge plan={client.plan} />} />
          <MetaRow label="Status" value={<ClientStatusBadge status={client.status} />} />
          <MetaRow label="API key" value={<span className="font-mono text-xs">{maskApiKey(client.api_key_last4)}</span>} />
          <MetaRow label="Created" value={formatRelativeTime(client.created_at)} />
          <MetaRow label="Updated" value={formatRelativeTime(client.updated_at)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          <MetaRow label="Current usage" value={`${formatNumber(client.monthly_ticket_usage)} / ${formatNumber(client.monthly_ticket_limit)}`} />
          <MetaRow label="Memory retention" value={`${client.memory_retention_days} days`} />
          <MetaRow label="Rate limit" value={`${formatNumber(client.rate_limits.requests_per_minute_limit)}/min`} />
          <MetaRow label="Burst limit" value={`${formatNumber(client.rate_limits.burst_limit)}/min`} />
          <div className="space-y-1.5 pt-1">
            <span className="text-muted-foreground">Allowed models</span>
            <div className="flex flex-wrap gap-1.5">
              {client.allowed_models.map((model) => (
                <Badge key={model} variant="outline" className="font-mono text-[10px] font-normal">
                  {model}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <JsonInspector title="Raw JSON" data={client} />
    </div>
  )
}
