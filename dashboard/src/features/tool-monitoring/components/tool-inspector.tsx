import { CheckCircle2, Wrench, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/status/empty-state"
import { ErrorState } from "@/components/status/error-state"
import { NodeInspectorSkeleton } from "@/components/status/skeletons"
import { JsonInspector } from "@/components/json-inspector"
import { MetaRow } from "@/components/meta-row"
import { CircuitBreakerBadge } from "@/features/tool-monitoring/components/circuit-breaker-badge"
import { HealthBadge } from "@/features/tool-monitoring/components/health-badge"
import { LatencyBadge } from "@/features/tool-monitoring/components/latency-badge"
import { ToolTimeline } from "@/features/tool-monitoring/components/tool-timeline"
import { toolLabel } from "@/lib/tools"
import { formatDuration, formatPercent, formatRelativeTime } from "@/lib/format"
import type { ToolDetail } from "@/types/mocked"

interface ToolInspectorProps {
  tool: ToolDetail | null
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

/** Right panel of Tool Monitoring — full operational detail for whichever tool is currently
 * selected, in the left navigation or the table. */
export function ToolInspector({ tool, isLoading, isError, onRetry }: ToolInspectorProps) {
  if (isError) {
    return <ErrorState title="Couldn't load this tool" onRetry={onRetry} />
  }

  if (isLoading) {
    return <NodeInspectorSkeleton />
  }

  if (!tool) {
    return (
      <Card>
        <CardContent className="pt-4">
          <EmptyState
            icon={Wrench}
            title="No tool selected"
            description="Select a tool in the navigation or table to inspect its health."
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium">{toolLabel(tool.tool_name)}</CardTitle>
            <HealthBadge status={tool.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          <MetaRow label="Avg latency" value={<LatencyBadge valueMs={tool.avg_latency_ms} />} />
          <MetaRow label="P95 latency" value={<LatencyBadge valueMs={tool.p95_latency_ms} />} />
          <MetaRow label="P99 latency" value={<LatencyBadge valueMs={tool.p99_latency_ms} />} />
          <MetaRow label="Success rate" value={<span className="text-success">{formatPercent(tool.success_rate)}</span>} />
          <MetaRow label="Failure rate" value={<span className="text-destructive">{formatPercent(tool.failure_rate)}</span>} />
          <MetaRow label="Retry count (24h)" value={String(tool.retry_count_24h)} />
          <MetaRow label="Circuit breaker" value={<CircuitBreakerBadge state={tool.circuit_breaker_state} />} />
          <MetaRow
            label="Last used"
            value={tool.last_used_at ? formatRelativeTime(tool.last_used_at) : "Never"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">{tool.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Purpose</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">{tool.purpose}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {tool.recent_requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent requests.</p>
          ) : (
            tool.recent_requests.slice(0, 8).map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  {request.status === "success" ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-label="Succeeded" />
                  ) : (
                    <XCircle className="size-3.5 shrink-0 text-destructive" aria-label="Failed" />
                  )}
                  <span className="truncate font-mono text-muted-foreground">{request.ticket_id}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  <span>{formatDuration(request.duration_ms)}</span>
                  <time>{formatRelativeTime(request.timestamp)}</time>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent errors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {tool.recent_errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent errors.</p>
          ) : (
            tool.recent_errors.slice(0, 5).map((error, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={index} className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-destructive">{error.failure_type}</span>
                  <time className="text-xs text-muted-foreground">{formatRelativeTime(error.timestamp)}</time>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{error.message}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ToolTimeline events={tool.timeline} />
        </CardContent>
      </Card>

      <JsonInspector title="Raw JSON" data={tool} />
    </div>
  )
}
