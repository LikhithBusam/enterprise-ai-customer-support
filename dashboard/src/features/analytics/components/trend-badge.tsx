import { ArrowDown, ArrowUp, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface TrendBadgeProps {
  /** Fractional change vs. the prior period (e.g. 0.05 = +5%). Null when there's no comparable
   * prior-period value to divide by. */
  deltaPct: number | null
  /** Whether an upward move is good (resolution rate) or bad (escalations, latency, retries). */
  isPositiveWhenUp: boolean
  className?: string
}

/** Reusable up/down/flat indicator for KPI and insight deltas — same visual language as the
 * inline trend rendered by components/layout/stat-card.tsx, extracted here as its own component
 * since Analytics needs it standalone (KpiGrid tiles, table cells) rather than baked into a card. */
export function TrendBadge({ deltaPct, isPositiveWhenUp, className }: TrendBadgeProps) {
  if (deltaPct === null || Math.abs(deltaPct) < 0.001) {
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground", className)}>
        <Minus className="size-3" />
        Flat
      </span>
    )
  }

  const isUp = deltaPct > 0
  const isPositive = isUp === isPositiveWhenUp

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        isPositive ? "text-success" : "text-destructive",
        className,
      )}
    >
      {isUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(deltaPct * 100).toFixed(1)}%
    </span>
  )
}
