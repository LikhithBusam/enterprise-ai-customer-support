import { cn } from "@/lib/utils"
import type { ClientPlan } from "@/types/mocked"

const CONFIG: Record<ClientPlan, { label: string; dotClassName: string; textClassName: string }> = {
  starter: { label: "Starter", dotClassName: "bg-muted-foreground", textClassName: "text-muted-foreground" },
  growth: { label: "Growth", dotClassName: "bg-info", textClassName: "text-info" },
  enterprise: { label: "Enterprise", dotClassName: "bg-primary", textClassName: "text-primary" },
}

interface PlanBadgeProps {
  plan: ClientPlan
  className?: string
}

/** Fixed, app-wide plan → color mapping — the Client Management analog of StatusBadge/HealthBadge,
 * each domain with its own status vocabulary but the same dot+label shape. */
export function PlanBadge({ plan, className }: PlanBadgeProps) {
  const config = CONFIG[plan]
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
