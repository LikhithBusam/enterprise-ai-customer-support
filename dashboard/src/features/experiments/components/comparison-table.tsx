import { AnalyticsTablePanel } from "@/features/analytics/components/analytics-table-panel"
import { buildComparisonColumns, type ExperimentTableRow } from "@/features/experiments/columns"

interface ComparisonTableProps {
  rows: ExperimentTableRow[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

/** The Result Table + Statistical Analysis section in one — every column the spec asks for
 * (Experiment, Failure Rate, Resolution, Latency, Retries, Tool Calls, Memory Hits, P-value,
 * Significant?) already lives on one row, so a second, separate "statistical analysis" table
 * would just repeat the same p-value/significance columns. Reuses Analytics's
 * AnalyticsTablePanel (frozen, approved) rather than rebuilding the same client-sorted DataTable
 * wrapper a third time. */
export function ComparisonTable({ rows, isLoading, isError, onRetry }: ComparisonTableProps) {
  return (
    <AnalyticsTablePanel
      title="Result comparison"
      data={rows}
      columns={buildComparisonColumns()}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      emptyTitle="No runs selected"
      emptyDescription="Select at least one experiment and failure rate to compare."
      getRowId={(row) => `${row.arm}::${row.failure_rate}`}
    />
  )
}
