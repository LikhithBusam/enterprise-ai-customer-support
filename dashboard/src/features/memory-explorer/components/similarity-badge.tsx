import { cn } from "@/lib/utils"
import { formatPercent } from "@/lib/format"

interface SimilarityBadgeProps {
  value: number | null
  className?: string
}

/** Similarity is a relevance measure, not a quality judgment — color communicates magnitude
 * only (higher = more similar to the query that retrieved it), never good/bad. */
export function SimilarityBadge({ value, className }: SimilarityBadgeProps) {
  if (value === null) {
    return (
      <span className={cn("text-xs text-muted-foreground/60", className)} aria-label="No similarity score">
        —
      </span>
    )
  }

  const textClassName = value >= 0.85 ? "text-success" : value >= 0.7 ? "text-info" : "text-muted-foreground"
  const dotClassName = value >= 0.85 ? "bg-success" : value >= 0.7 ? "bg-info" : "bg-muted-foreground"

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
