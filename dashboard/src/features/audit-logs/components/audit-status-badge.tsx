import { cn } from "@/lib/utils"
import type { AuditStatus } from "@/types/mocked"

const CONFIG: Record<AuditStatus, { label: string; dotClassName: string; textClassName: string }> = {
  success: { label: "Success", dotClassName: "bg-success", textClassName: "text-success" },
  failure: { label: "Failure", dotClassName: "bg-destructive", textClassName: "text-destructive" },
  warning: { label: "Warning", dotClassName: "bg-warning", textClassName: "text-warning" },
}

interface AuditStatusBadgeProps {
  status: AuditStatus
  className?: string
}

/** Fixed audit-outcome → color mapping. A distinct vocabulary from ticket StatusBadge
 * (resolved/escalated/...) and ClientStatusBadge (active/trial/suspended). */
export function AuditStatusBadge({ status, className }: AuditStatusBadgeProps) {
  const config = CONFIG[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium",
        config.textClassName,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dotClassName)} aria-hidden="true" />
      {config.label}
    </span>
  )
}
