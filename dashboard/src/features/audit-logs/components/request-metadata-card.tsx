import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetaRow } from "@/components/meta-row"
import type { AuditLogDetail } from "@/types/mocked"

interface RequestMetadataCardProps {
  log: AuditLogDetail
}

/** IP address, user agent, and correlation/request identifiers for a single audit event — used
 * only by the Log Inspector drawer. */
export function RequestMetadataCard({ log }: RequestMetadataCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Request metadata</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 text-sm">
        <MetaRow label="IP address" value={<span className="font-mono text-xs">{log.ip_address}</span>} />
        <MetaRow label="Request ID" value={<span className="font-mono text-xs">{log.request_id}</span>} />
        <MetaRow label="Correlation ID" value={<span className="font-mono text-xs">{log.correlation_id}</span>} />
        <div className="space-y-1">
          <span className="text-muted-foreground">User agent</span>
          <p className="break-all font-mono text-xs text-foreground">{log.user_agent}</p>
        </div>
      </CardContent>
    </Card>
  )
}
