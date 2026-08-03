import { useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Gauge,
  MessagesSquare,
  Percent,
  RotateCcw,
  Wrench,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { StatCardSkeleton, ChartSkeleton } from "@/components/status/skeletons"
import { ErrorState } from "@/components/status/error-state"
import { AnalyticsToolbar } from "@/features/analytics/components/analytics-toolbar"
import { AnalyticsFilters } from "@/features/analytics/components/analytics-filters"
import { KpiGrid, type KpiGridItem } from "@/features/analytics/components/kpi-grid"
import { InsightCard } from "@/features/analytics/components/insight-card"
import { AnalyticsCharts } from "@/features/analytics/components/analytics-charts"
import { AnalyticsTablePanel } from "@/features/analytics/components/analytics-table-panel"
import {
  buildFrequentMemoriesColumns,
  buildHighRetryColumns,
  buildLongResolutionColumns,
  buildTopCustomersColumns,
  buildTopToolFailuresColumns,
} from "@/features/analytics/columns"
import { useAnalyticsCharts, useAnalyticsSummary, useAnalyticsTables } from "@/features/analytics/hooks"
import {
  buildAnalyticsSearchParams,
  hasActiveAnalyticsFilters,
  parseAnalyticsSearchParams,
  type AnalyticsFilterParams,
} from "@/features/analytics/search-params"
import { formatDuration, formatNumber, formatPercent } from "@/lib/format"

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseAnalyticsSearchParams(searchParams), [searchParams])

  const summaryQuery = useAnalyticsSummary(filters)
  const chartsQuery = useAnalyticsCharts(filters)
  const tablesQuery = useAnalyticsTables(filters)

  function updateFilters(patch: Partial<AnalyticsFilterParams>): void {
    setSearchParams(buildAnalyticsSearchParams({ ...filters, ...patch }), { replace: true })
  }

  function resetAllFilters(): void {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const kpiItems: KpiGridItem[] = summaryQuery.data
    ? [
        {
          key: "total",
          label: "Total conversations",
          value: formatNumber(summaryQuery.data.summary.total_conversations.value),
          icon: MessagesSquare,
          deltaPct: summaryQuery.data.summary.total_conversations.delta_pct,
          isPositiveWhenUp: true,
        },
        {
          key: "resolved",
          label: "Resolved",
          value: formatNumber(summaryQuery.data.summary.resolved.value),
          icon: CheckCircle2,
          deltaPct: summaryQuery.data.summary.resolved.delta_pct,
          isPositiveWhenUp: true,
        },
        {
          key: "escalated",
          label: "Escalated",
          value: formatNumber(summaryQuery.data.summary.escalated.value),
          icon: AlertTriangle,
          deltaPct: summaryQuery.data.summary.escalated.delta_pct,
          isPositiveWhenUp: false,
        },
        {
          key: "resolution-rate",
          label: "Resolution rate",
          value: formatPercent(summaryQuery.data.summary.resolution_rate.value),
          icon: Percent,
          deltaPct: summaryQuery.data.summary.resolution_rate.delta_pct,
          isPositiveWhenUp: true,
        },
        {
          key: "avg-resolution-time",
          label: "Avg resolution time",
          value: formatDuration(summaryQuery.data.summary.avg_resolution_time_ms.value),
          icon: Clock,
          deltaPct: summaryQuery.data.summary.avg_resolution_time_ms.delta_pct,
          isPositiveWhenUp: false,
        },
        {
          key: "avg-tool-calls",
          label: "Avg tool calls",
          value: summaryQuery.data.summary.avg_tool_calls.value.toFixed(1),
          icon: Wrench,
          deltaPct: summaryQuery.data.summary.avg_tool_calls.delta_pct,
          isPositiveWhenUp: false,
        },
        {
          key: "avg-memory-hits",
          label: "Avg memory hits",
          value: formatPercent(summaryQuery.data.summary.avg_memory_hit_rate.value),
          icon: BrainCircuit,
          deltaPct: summaryQuery.data.summary.avg_memory_hit_rate.delta_pct,
          isPositiveWhenUp: true,
        },
        {
          key: "avg-retries",
          label: "Avg retries",
          value: summaryQuery.data.summary.avg_retries.value.toFixed(2),
          icon: RotateCcw,
          deltaPct: summaryQuery.data.summary.avg_retries.delta_pct,
          isPositiveWhenUp: false,
        },
        {
          key: "avg-latency",
          label: "Avg latency",
          value: formatDuration(summaryQuery.data.summary.avg_latency_ms.value),
          icon: Gauge,
          deltaPct: summaryQuery.data.summary.avg_latency_ms.delta_pct,
          isPositiveWhenUp: false,
        },
        {
          key: "avg-confidence",
          label: "Avg confidence",
          value: formatPercent(summaryQuery.data.summary.avg_confidence.value),
          icon: Percent,
          deltaPct: summaryQuery.data.summary.avg_confidence.delta_pct,
          isPositiveWhenUp: true,
        },
      ]
    : []

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Executive view of resolution, latency, and workflow health across every ticket"
      />
      <div className="space-y-4 p-6">
        <AnalyticsToolbar
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onDateRangeChange={(dateFrom, dateTo) => updateFilters({ dateFrom, dateTo })}
          hasActiveFilters={hasActiveAnalyticsFilters(filters)}
          onResetAll={resetAllFilters}
        />

        <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_280px] lg:items-start">
          <div className="min-w-0 space-y-4">
            {summaryQuery.isError ? (
              <ErrorState onRetry={() => summaryQuery.refetch()} />
            ) : summaryQuery.isPending ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {Array.from({ length: 10 }).map((_, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <StatCardSkeleton key={index} />
                ))}
              </div>
            ) : (
              <KpiGrid items={kpiItems} />
            )}

            {summaryQuery.data && summaryQuery.data.insights.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {summaryQuery.data.insights.map((item) => (
                  <InsightCard key={item.id} item={item} />
                ))}
              </div>
            )}

            {chartsQuery.isError ? (
              <ErrorState onRetry={() => chartsQuery.refetch()} />
            ) : chartsQuery.isPending ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 10 }).map((_, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <ChartSkeleton key={index} />
                ))}
              </div>
            ) : (
              chartsQuery.data && <AnalyticsCharts charts={chartsQuery.data} />
            )}

            <div className="grid gap-3 xl:grid-cols-2">
              <AnalyticsTablePanel
                title="Top customers"
                data={tablesQuery.data?.top_customers ?? []}
                columns={buildTopCustomersColumns()}
                isLoading={tablesQuery.isPending}
                isError={tablesQuery.isError}
                onRetry={() => tablesQuery.refetch()}
                emptyTitle="No customers found"
                emptyDescription="No conversations match the current filters."
                getRowId={(row) => row.customer_id}
              />
              <AnalyticsTablePanel
                title="Top tool failures"
                data={tablesQuery.data?.top_tool_failures ?? []}
                columns={buildTopToolFailuresColumns()}
                isLoading={tablesQuery.isPending}
                isError={tablesQuery.isError}
                onRetry={() => tablesQuery.refetch()}
                emptyTitle="No tool failures found"
                emptyDescription="No failing tool calls match the current filters."
                getRowId={(row) => `${row.tool_name}::${row.failure_type}`}
              />
              <AnalyticsTablePanel
                title="Highest retry conversations"
                data={tablesQuery.data?.highest_retry_conversations ?? []}
                columns={buildHighRetryColumns()}
                isLoading={tablesQuery.isPending}
                isError={tablesQuery.isError}
                onRetry={() => tablesQuery.refetch()}
                emptyTitle="No conversations found"
                emptyDescription="No conversations match the current filters."
                getRowId={(row) => row.ticket_id}
              />
              <AnalyticsTablePanel
                title="Longest resolution times"
                data={tablesQuery.data?.longest_resolution_times ?? []}
                columns={buildLongResolutionColumns()}
                isLoading={tablesQuery.isPending}
                isError={tablesQuery.isError}
                onRetry={() => tablesQuery.refetch()}
                emptyTitle="No resolved conversations found"
                emptyDescription="No resolved conversations match the current filters."
                getRowId={(row) => row.ticket_id}
              />
              <AnalyticsTablePanel
                title="Most frequently retrieved memories"
                data={tablesQuery.data?.most_frequent_memories ?? []}
                columns={buildFrequentMemoriesColumns()}
                isLoading={tablesQuery.isPending}
                isError={tablesQuery.isError}
                onRetry={() => tablesQuery.refetch()}
                emptyTitle="No memories found"
                emptyDescription="No memory entries match the current filters."
                getRowId={(row) => row.id}
                className="xl:col-span-2"
              />
            </div>
          </div>

          <div className="min-w-0 lg:sticky lg:top-6">
            <AnalyticsFilters filters={filters} onChange={updateFilters} />
          </div>
        </div>
      </div>
    </div>
  )
}
