import { cn } from "@/lib/utils"
import type { CircuitBreakerState } from "@/types/mocked"

const CONFIG: Record<CircuitBreakerState, { label: string; dotClassName: string; textClassName: string }> = {
  closed: { label: "Closed", dotClassName: "bg-success", textClassName: "text-success" },
  half_open: { label: "Half-Open", dotClassName: "bg-warning", textClassName: "text-warning" },
  open: { label: "Open", dotClassName: "bg-destructive", textClassName: "text-destructive" },
}

interface CircuitBreakerBadgeProps {
  state: CircuitBreakerState
  className?: string
}

/** "Closed" means the circuit is intact and requests flow normally — matches
 * src/core/llm_client.py's _CircuitBreaker states (closed / open / half-open after cooldown). */
export function CircuitBreakerBadge({ state, className }: CircuitBreakerBadgeProps) {
  const config = CONFIG[state]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium",
        config.textClassName,
        className,
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", config.dotClassName, state === "half_open" && "animate-pulse")}
        aria-hidden="true"
      />
      {config.label}
    </span>
  )
}
