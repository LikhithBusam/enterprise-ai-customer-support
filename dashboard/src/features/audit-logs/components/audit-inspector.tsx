import { FileSearch } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/status/empty-state"
import { ErrorState } from "@/components/status/error-state"
import { NodeInspectorSkeleton } from "@/components/status/skeletons"
import { MetaRow } from "@/components/meta-row"
import { JsonInspector } from "@/components/json-inspector"
import { AuditCard } from "@/features/audit-logs/components/audit-card"
import { AuditTimeline } from "@/features/audit-logs/components/audit-timeline"
import { RequestMetadataCard } from "@/features/audit-logs/components/request-metadata-card"
import { formatRelativeTime } from "@/lib/format"
import type { AuditLogDetail } from "@/types/mocked"

interface AuditInspectorProps {
  log: AuditLogDetail | null
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

function ValueBlock({ title, value }: { title: string; value: Record<string, unknown> | null }) {
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <span className="text-xs text-muted-foreground">{title}</span>
      {value ? (
        <pre className="overflow-auto rounded-md border border-border bg-muted/30 p-2 text-xs">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        <p className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
          No value
        </p>
      )}
    </div>
  )
}

/** Log Inspector drawer content — full detail for the currently-selected audit event, ending in
 * the request lifecycle timeline and a copyable Raw JSON block. */
export function AuditInspector({ log, isLoading, isError, onRetry }: AuditInspectorProps) {
  if (isError) {
    return <ErrorState title="Couldn't load this event" onRetry={onRetry} />
  }

  if (isLoading) {
    return <NodeInspectorSkeleton />
  }

  if (!log) {
    return (
      <EmptyState
        icon={FileSearch}
        title="No event selected"
        description="Select an event in the table to inspect its details."
      />
    )
  }

  return (
    <div className="space-y-4">
      <AuditCard entry={log} size="lg" />

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Event details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          <MetaRow label="Timestamp" value={formatRelativeTime(log.timestamp)} />
          <MetaRow label="Client" value={log.client_name} />
          <MetaRow label="Resource" value={<span className="font-mono text-xs">{log.resource}</span>} />
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Change</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <ValueBlock title="Old value" value={log.old_value} />
          <ValueBlock title="New value" value={log.new_value} />
        </CardContent>
      </Card>

      <RequestMetadataCard log={log} />

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditTimeline events={log.timeline} />
        </CardContent>
      </Card>

      <JsonInspector title="Raw JSON" data={log} />
    </div>
  )
}
