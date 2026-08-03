import { cn } from "@/lib/utils"

function formatPValue(pValue: number): string {
  return pValue < 0.001 ? "p<0.001" : `p=${pValue.toFixed(3)}`
}

interface SignificanceBadgeProps {
  pValue: number | null
  significant: boolean | null
  className?: string
}

/** Renders a real chi-square significance result (or a neutral dash when the comparison doesn't
 * apply — e.g. Policy Memory has no p-value against itself). Never computes anything — just
 * formats `ExperimentSignificance` rows transcribed from the research reports. */
export function SignificanceBadge({ pValue, significant, className }: SignificanceBadgeProps) {
  if (pValue === null || significant === null) {
    return <span className={cn("text-xs text-muted-foreground", className)}>—</span>
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium",
        significant ? "text-info" : "text-muted-foreground",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", significant ? "bg-info" : "bg-muted-foreground")} aria-hidden="true" />
      {significant ? "Significant" : "Not significant"} ({formatPValue(pValue)})
    </span>
  )
}
