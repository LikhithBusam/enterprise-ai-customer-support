import { cn } from "@/lib/utils"

export type StatusKind = "resolved" | "escalated" | "failed" | "pending" | "in_progress"

const STATUS_CONFIG: Record<StatusKind, { label: string; dotClassName: string; textClassName: string }> = {
  resolved: {
    label: "Resolved",
    dotClassName: "bg-success",
    textClassName: "text-success",
  },
  escalated: {
    label: "Escalated",
    dotClassName: "bg-warning",
    textClassName: "text-warning",
  },
  failed: {
    label: "Failed",
    dotClassName: "bg-destructive",
    textClassName: "text-destructive",
  },
  pending: {
    label: "Pending",
    dotClassName: "bg-muted-foreground",
    textClassName: "text-muted-foreground",
  },
  in_progress: {
    label: "In progress",
    dotClassName: "bg-info animate-pulse",
    textClassName: "text-info",
  },
}

interface StatusBadgeProps {
  status: StatusKind
  className?: string
}

/** Fixed, app-wide semantic status → color mapping (design system §6) — never used decoratively. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
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
