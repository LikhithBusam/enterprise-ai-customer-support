import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import { ActionBadge } from "@/features/audit-logs/components/action-badge"
import { AuditStatusBadge } from "@/features/audit-logs/components/audit-status-badge"
import { SeverityBadge } from "@/features/audit-logs/components/severity-badge"
import type { AuditLogEntry } from "@/types/mocked"

interface AuditCardProps {
  entry: AuditLogEntry
  size?: "sm" | "lg"
  className?: string
}

/** Event identity block — action + category. Reused as the DataTable's compact "Action" cell
 * (size="sm") and the Log Inspector drawer's header (size="lg", adds status/severity/time). */
export function AuditCard({ entry, size = "sm", className }: AuditCardProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className={cn("truncate font-medium text-foreground", size === "lg" ? "text-base" : "text-sm")}>
        {entry.action}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <ActionBadge category={entry.category} />
        {size === "lg" && (
          <>
            <AuditStatusBadge status={entry.status} />
            <SeverityBadge severity={entry.severity} />
            <span className="text-xs text-muted-foreground">{formatRelativeTime(entry.timestamp)}</span>
          </>
        )}
      </div>
    </div>
  )
}
