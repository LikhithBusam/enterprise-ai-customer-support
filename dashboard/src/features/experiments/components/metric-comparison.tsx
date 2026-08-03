import { TrendBadge } from "@/features/analytics/components/trend-badge"

interface MetricComparisonProps {
  label: string
  value: string
  /** Fractional change vs. the ladder's reference arm (Memoryless) at the same failure rate. */
  deltaPct: number | null
  isPositiveWhenUp: boolean
}

/** One metric row inside an Ablation Studies card — value plus a delta vs. the reference arm,
 * reusing Analytics's TrendBadge (frozen, approved) rather than re-implementing the same
 * up/down/flat indicator a third time. */
export function MetricComparison({ label, value, deltaPct, isPositiveWhenUp }: MetricComparisonProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium tabular-nums text-foreground">{value}</span>
        <TrendBadge deltaPct={deltaPct} isPositiveWhenUp={isPositiveWhenUp} />
      </div>
    </div>
  )
}
