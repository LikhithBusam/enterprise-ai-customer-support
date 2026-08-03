import { cn } from "@/lib/utils"
import type { MemoryStatus } from "@/types/mocked"

const CONFIG: Record<MemoryStatus, { label: string; dotClassName: string; textClassName: string }> = {
  active: { label: "Active", dotClassName: "bg-success", textClassName: "text-success" },
  stale: { label: "Stale", dotClassName: "bg-warning", textClassName: "text-warning" },
  archived: { label: "Archived", dotClassName: "bg-muted-foreground", textClassName: "text-muted-foreground" },
}

interface MemoryStatusBadgeProps {
  status: MemoryStatus
  className?: string
}

export function MemoryStatusBadge({ status, className }: MemoryStatusBadgeProps) {
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
