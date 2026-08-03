import { cn } from "@/lib/utils"
import type { AgentNodeStatus } from "@/types/mocked"

const CONFIG: Record<AgentNodeStatus, { label: string; dotClassName: string; textClassName: string }> = {
  done: { label: "Done", dotClassName: "bg-success", textClassName: "text-success" },
  active: { label: "Active", dotClassName: "bg-info animate-pulse", textClassName: "text-info" },
  failed: { label: "Failed", dotClassName: "bg-destructive", textClassName: "text-destructive" },
  pending: { label: "Pending", dotClassName: "bg-muted-foreground", textClassName: "text-muted-foreground" },
  skipped: { label: "Skipped", dotClassName: "bg-muted-foreground/60", textClassName: "text-muted-foreground" },
}

interface NodeStatusBadgeProps {
  status: AgentNodeStatus
  className?: string
}

/** Status pill for AgentNodeStatus (pending/active/done/failed/skipped) — distinct from the
 * ticket-level StatusBadge, which speaks a different status vocabulary. */
export function NodeStatusBadge({ status, className }: NodeStatusBadgeProps) {
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
