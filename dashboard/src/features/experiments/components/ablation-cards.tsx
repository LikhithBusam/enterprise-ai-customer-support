import { AnalyticsCard } from "@/features/analytics/components/analytics-card"
import { MetricComparison } from "@/features/experiments/components/metric-comparison"
import { ABLATION_ARMS, experimentArmLabel } from "@/lib/experiment-arms"
import { formatDuration, formatPercent } from "@/lib/format"
import type { ExperimentArmResult } from "@/types/mocked"

function deltaPct(current: number, base: number): number | null {
  return base !== 0 ? (current - base) / base : null
}

interface AblationCardsProps {
  /** Exactly ABLATION_ARMS' results at one failure rate — may be a subset while loading. */
  results: ExperimentArmResult[]
}

/** Baseline → Memory Augmented → v2 Full → Policy Memory, each showing its headline metrics with
 * a delta against the Memoryless reference card — the real "ablation ladder" this research's
 * contributions build on, per CLAUDE.md. */
export function AblationCards({ results }: AblationCardsProps) {
  const baseline = results.find((row) => row.arm === "memoryless")
  if (!baseline) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {ABLATION_ARMS.map((arm) => {
        const result = results.find((row) => row.arm === arm)
        if (!result) return null
        const isBaseline = arm === "memoryless"

        return (
          <AnalyticsCard key={arm} title={experimentArmLabel(arm)}>
            <div className="divide-y divide-border">
              <MetricComparison
                label="Resolution rate"
                value={formatPercent(result.resolution_rate)}
                deltaPct={isBaseline ? null : deltaPct(result.resolution_rate, baseline.resolution_rate)}
                isPositiveWhenUp
              />
              <MetricComparison
                label="Avg tool calls"
                value={result.avg_tool_calls.toFixed(2)}
                deltaPct={isBaseline ? null : deltaPct(result.avg_tool_calls, baseline.avg_tool_calls)}
                isPositiveWhenUp={false}
              />
              <MetricComparison
                label="Avg retries"
                value={result.avg_replans.toFixed(2)}
                deltaPct={isBaseline ? null : deltaPct(result.avg_replans, baseline.avg_replans)}
                isPositiveWhenUp={false}
              />
              <MetricComparison
                label="Memory hit rate"
                value={result.memory_hit_rate === null ? "n/a" : formatPercent(result.memory_hit_rate)}
                deltaPct={
                  isBaseline || result.memory_hit_rate === null || baseline.memory_hit_rate === null
                    ? null
                    : deltaPct(result.memory_hit_rate, baseline.memory_hit_rate)
                }
                isPositiveWhenUp
              />
              <MetricComparison
                label="Avg latency"
                value={result.avg_latency_ms === null ? "n/a" : formatDuration(result.avg_latency_ms)}
                deltaPct={null}
                isPositiveWhenUp={false}
              />
            </div>
            {isBaseline && (
              <p className="mt-2 text-xs text-muted-foreground">Reference arm — every delta above is relative to this.</p>
            )}
          </AnalyticsCard>
        )
      })}
    </div>
  )
}
