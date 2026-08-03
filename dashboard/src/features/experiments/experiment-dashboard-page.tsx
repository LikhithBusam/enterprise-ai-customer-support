import { useMemo, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/page-header"
import { ErrorState } from "@/components/status/error-state"
import { StatCardSkeleton, ChartSkeleton } from "@/components/status/skeletons"
import { TrendBadge } from "@/features/analytics/components/trend-badge"
import { AblationCards } from "@/features/experiments/components/ablation-cards"
import { ComparisonTable } from "@/features/experiments/components/comparison-table"
import { ExperimentCard } from "@/features/experiments/components/experiment-card"
import { ExperimentCharts } from "@/features/experiments/components/experiment-charts"
import { ExportActions } from "@/features/experiments/components/export-actions"
import { FailureRateSelector } from "@/features/experiments/components/failure-rate-selector"
import { InsightPanel } from "@/features/experiments/components/insight-panel"
import { joinResultsWithSignificance } from "@/features/experiments/columns"
import { useExperimentCharts, useExperimentCompare, useExperimentsList } from "@/features/experiments/hooks"
import {
  buildExperimentSearchParams,
  parseExperimentSearchParams,
  type ExperimentSearchParams,
} from "@/features/experiments/search-params"
import { ABLATION_ARMS, EXPERIMENT_ARM_ORDER } from "@/lib/experiment-arms"
import { formatDuration, formatPercent } from "@/lib/format"
import type { ExperimentArm, ExperimentArmResult, ExperimentFailureRate } from "@/types/mocked"

function SummaryTile({
  label,
  value,
  deltaPct,
  isPositiveWhenUp = true,
}: {
  label: string
  value: string
  deltaPct?: number | null
  isPositiveWhenUp?: boolean
}) {
  return (
    <Card size="sm" className="gap-1.5 py-3">
      <CardContent className="space-y-1 px-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
        {deltaPct !== undefined && <TrendBadge deltaPct={deltaPct} isPositiveWhenUp={isPositiveWhenUp} />}
      </CardContent>
    </Card>
  )
}

export function ExperimentDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseExperimentSearchParams(searchParams), [searchParams])
  const chartContainerRef = useRef<HTMLDivElement>(null)

  const listQuery = useExperimentsList()
  const compareQuery = useExperimentCompare({ arms: params.arms, failureRates: params.failureRates })
  const chartsQuery = useExperimentCharts({ arms: params.arms, failureRates: params.failureRates })
  const ablationQuery = useExperimentCompare({ arms: ABLATION_ARMS, failureRates: [params.ablationRate] })

  function updateParams(patch: Partial<ExperimentSearchParams>): void {
    setSearchParams(buildExperimentSearchParams({ ...params, ...patch }), { replace: true })
  }

  function toggleArm(arm: ExperimentArm): void {
    if (params.arms.includes(arm)) {
      if (params.arms.length === 1) return
      updateParams({ arms: params.arms.filter((selected) => selected !== arm) })
    } else {
      updateParams({ arms: [...params.arms, arm] })
    }
  }

  const tableRows = useMemo(
    () => (compareQuery.data ? joinResultsWithSignificance(compareQuery.data.results, compareQuery.data.significance) : []),
    [compareQuery.data],
  )

  const armOrder = EXPERIMENT_ARM_ORDER.filter((arm) => params.arms.includes(arm))

  const ablationResults = ablationQuery.data?.results ?? []
  const policyAtFocus = ablationResults.find((row) => row.arm === "policy_memory")
  const augmentedAtFocus = ablationResults.find((row) => row.arm === "memory_augmented")
  const policyVsAugmentedSig = ablationQuery.data?.significance.find(
    (row) => row.arm_a === "memory_augmented" && row.arm_b === "policy_memory",
  )

  function deltaVsAugmented(pick: (row: ExperimentArmResult) => number | null): number | null {
    if (!policyAtFocus || !augmentedAtFocus) return null
    const current = pick(policyAtFocus)
    const base = pick(augmentedAtFocus)
    if (current === null || base === null || base === 0) return null
    return (current - base) / base
  }

  return (
    <div>
      <PageHeader
        title="Experiment Dashboard"
        description="Real evaluation results from experiments/results — memory-augmented dynamic replanning vs. memoryless and static-ReAct baselines"
        actions={<ExportActions rows={tableRows} chartContainerRef={chartContainerRef} />}
      />

      <div className="space-y-4 p-6">
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">Experiment selector</h2>
          {listQuery.isError ? (
            <ErrorState onRetry={() => listQuery.refetch()} />
          ) : listQuery.isPending ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <StatCardSkeleton key={index} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {listQuery.data.arms.map((meta) => {
                const headline = listQuery.data.results.find(
                  (row) => row.arm === meta.arm && row.failure_rate === params.ablationRate,
                )
                return (
                  <ExperimentCard
                    key={meta.arm}
                    meta={meta}
                    selected={params.arms.includes(meta.arm)}
                    onToggle={() => toggleArm(meta.arm)}
                    headlineResolutionRate={headline?.resolution_rate ?? null}
                  />
                )
              })}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Failure rates:</span>
            <FailureRateSelector value={params.failureRates} onChange={(value) => updateParams({ failureRates: value })} />
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-foreground">Baseline comparison — ablation ladder</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Focus rate:</span>
              <FailureRateSelector
                value={[params.ablationRate]}
                onChange={(value) => updateParams({ ablationRate: value[0] as ExperimentFailureRate })}
                multiple={false}
                label="Ablation focus failure rate"
              />
            </div>
          </div>
          {ablationQuery.isError ? (
            <ErrorState onRetry={() => ablationQuery.refetch()} />
          ) : ablationQuery.isPending ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <StatCardSkeleton key={index} />
              ))}
            </div>
          ) : (
            <AblationCards results={ablationResults} />
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">Summary — Policy Memory @ FR={params.ablationRate}</h2>
          {policyAtFocus ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <SummaryTile
                label="Resolution rate"
                value={formatPercent(policyAtFocus.resolution_rate)}
                deltaPct={deltaVsAugmented((row) => row.resolution_rate)}
                isPositiveWhenUp
              />
              <SummaryTile
                label="Tool calls"
                value={policyAtFocus.avg_tool_calls.toFixed(2)}
                deltaPct={deltaVsAugmented((row) => row.avg_tool_calls)}
                isPositiveWhenUp={false}
              />
              <SummaryTile
                label="Memory hits"
                value={policyAtFocus.memory_hit_rate === null ? "n/a" : formatPercent(policyAtFocus.memory_hit_rate)}
                deltaPct={deltaVsAugmented((row) => row.memory_hit_rate)}
                isPositiveWhenUp
              />
              <SummaryTile
                label="Retries"
                value={policyAtFocus.avg_replans.toFixed(2)}
                deltaPct={deltaVsAugmented((row) => row.avg_replans)}
                isPositiveWhenUp={false}
              />
              <SummaryTile
                label="Latency"
                value={policyAtFocus.avg_latency_ms === null ? "n/a" : formatDuration(policyAtFocus.avg_latency_ms)}
              />
              <SummaryTile
                label="Retrieval distance"
                value={policyAtFocus.retrieval_distance === null ? "n/a" : policyAtFocus.retrieval_distance.toFixed(4)}
              />
              <SummaryTile
                label="Policy reuse"
                value={policyAtFocus.policy_reuse_rate === null ? "n/a" : formatPercent(policyAtFocus.policy_reuse_rate)}
              />
              <SummaryTile
                label="95% CI (resolution)"
                value={
                  policyAtFocus.ci_low === null || policyAtFocus.ci_high === null
                    ? "n/a"
                    : `[${(policyAtFocus.ci_low * 100).toFixed(1)}%, ${(policyAtFocus.ci_high * 100).toFixed(1)}%]`
                }
              />
              <SummaryTile
                label="P-value (vs Memory Augmented)"
                value={
                  policyVsAugmentedSig?.p_value === null || policyVsAugmentedSig?.p_value === undefined
                    ? "n/a"
                    : policyVsAugmentedSig.p_value < 0.001
                      ? "<0.001"
                      : policyVsAugmentedSig.p_value.toFixed(3)
                }
              />
              <SummaryTile
                label="Statistical significance"
                value={
                  policyVsAugmentedSig === undefined ? "n/a" : policyVsAugmentedSig.significant ? "Significant" : "Not significant"
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <StatCardSkeleton key={index} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">Research charts</h2>
          {chartsQuery.isError ? (
            <ErrorState onRetry={() => chartsQuery.refetch()} />
          ) : chartsQuery.isPending ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <ChartSkeleton key={index} />
              ))}
            </div>
          ) : (
            chartsQuery.data && <ExperimentCharts charts={chartsQuery.data} armOrder={armOrder} firstChartRef={chartContainerRef} />
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">Result comparison &amp; statistical analysis</h2>
          <ComparisonTable
            rows={tableRows}
            isLoading={compareQuery.isPending}
            isError={compareQuery.isError}
            onRetry={() => compareQuery.refetch()}
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">Insights</h2>
          {compareQuery.isPending ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <ChartSkeleton key={index} />
              ))}
            </div>
          ) : (
            <InsightPanel insights={compareQuery.data?.insights ?? []} />
          )}
        </section>
      </div>
    </div>
  )
}
