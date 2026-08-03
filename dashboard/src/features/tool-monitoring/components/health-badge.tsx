import { cn } from "@/lib/utils"
import type { ToolStatus } from "@/types/mocked"

const CONFIG: Record<ToolStatus, { label: string; dotClassName: string; textClassName: string }> = {
  healthy: { label: "Healthy", dotClassName: "bg-success", textClassName: "text-success" },
  degraded: { label: "Degraded", dotClassName: "bg-warning", textClassName: "text-warning" },
  offline: { label: "Offline", dotClassName: "bg-destructive", textClassName: "text-destructive" },
  maintenance: { label: "Maintenance", dotClassName: "bg-info", textClassName: "text-info" },
  unknown: { label: "Unknown", dotClassName: "bg-muted-foreground", textClassName: "text-muted-foreground" },
}

interface HealthBadgeProps {
  status: ToolStatus
  className?: string
}

/** Fixed, app-wide tool-status → color mapping — the Tool Monitoring analog of StatusBadge
 * (ticket status) and MemoryStatusBadge (memory status), each with its own status vocabulary. */
export function HealthBadge({ status, className }: HealthBadgeProps) {
  const config = CONFIG[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium",
        config.textClassName,
        className,
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", config.dotClassName, status === "degraded" && "animate-pulse")}
        aria-hidden="true"
      />
      {config.label}
    </span>
  )
}
