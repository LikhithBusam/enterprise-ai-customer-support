import { cn } from "@/lib/utils"
import type { ClientStatus } from "@/types/mocked"

const CONFIG: Record<ClientStatus, { label: string; dotClassName: string; textClassName: string }> = {
  active: { label: "Active", dotClassName: "bg-success", textClassName: "text-success" },
  trial: { label: "Trial", dotClassName: "bg-info", textClassName: "text-info" },
  suspended: { label: "Suspended", dotClassName: "bg-destructive", textClassName: "text-destructive" },
}

interface ClientStatusBadgeProps {
  status: ClientStatus
  className?: string
}

/** Fixed client-status → color mapping. A distinct vocabulary from ticket StatusBadge
 * (resolved/escalated/...) — must not be conflated with it despite the shared dot+label shape. */
export function ClientStatusBadge({ status, className }: ClientStatusBadgeProps) {
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
