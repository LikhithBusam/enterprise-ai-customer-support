import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/format"

interface LatencyBadgeProps {
  valueMs: number
  className?: string
}

/** Latency is a magnitude measure — color communicates severity via fixed thresholds (fast /
 * moderate / slow), consistent across every place a latency number appears. */
export function LatencyBadge({ valueMs, className }: LatencyBadgeProps) {
  const textClassName =
    valueMs < 400 ? "text-success" : valueMs < 900 ? "text-warning" : "text-destructive"
  const dotClassName =
    valueMs < 400 ? "bg-success" : valueMs < 900 ? "bg-warning" : "bg-destructive"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium tabular-nums",
        textClassName,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClassName)} aria-hidden="true" />
      {formatDuration(valueMs)}
    </span>
  )
}
