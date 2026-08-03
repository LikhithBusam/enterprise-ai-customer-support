import { cn } from "@/lib/utils"
import { formatPercent } from "@/lib/format"

interface ConfidenceBadgeProps {
  value: number
  className?: string
}

/** Confidence is a quality signal — low confidence is worth flagging, so (unlike
 * SimilarityBadge) this maps onto the same success/warning/destructive semantic scale as
 * StatusBadge rather than a neutral magnitude gradient. */
export function ConfidenceBadge({ value, className }: ConfidenceBadgeProps) {
  const textClassName =
    value >= 0.85 ? "text-success" : value >= 0.65 ? "text-warning" : "text-destructive"
  const dotClassName = value >= 0.85 ? "bg-success" : value >= 0.65 ? "bg-warning" : "bg-destructive"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium tabular-nums",
        textClassName,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClassName)} aria-hidden="true" />
      {formatPercent(value)}
    </span>
  )
}
