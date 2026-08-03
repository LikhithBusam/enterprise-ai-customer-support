import type { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { SignificanceBadge } from "@/features/experiments/components/significance-badge"
import { experimentArmLabel } from "@/lib/experiment-arms"
import { formatDuration } from "@/lib/format"
import type { ExperimentArmResult, ExperimentSignificance } from "@/types/mocked"

export interface ExperimentTableRow extends ExperimentArmResult {
  p_value: number | null
  significant: boolean | null
}

/** Joins each result row with its real "vs Policy Memory" significance test, when one exists —
 * Policy Memory's own rows have no self-comparison, so they keep p_value/significant as null. */
export function joinResultsWithSignificance(
  results: ExperimentArmResult[],
  significance: ExperimentSignificance[],
): ExperimentTableRow[] {
  return results.map((result) => {
    const sig = significance.find((row) => row.arm_a === result.arm && row.failure_rate === result.failure_rate)
    return { ...result, p_value: sig?.p_value ?? null, significant: sig?.significant ?? null }
  })
}

function formatPercentCell(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatNullableDuration(value: number | null): string {
  return value === null ? "—" : formatDuration(value)
}

function formatNullablePercent(value: number | null): string {
  return value === null ? "—" : formatPercentCell(value)
}

export function buildComparisonColumns(): ColumnDef<ExperimentTableRow>[] {
  return [
    {
      accessorKey: "arm",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Experiment" />,
      cell: ({ row }) => <span className="font-medium text-foreground">{experimentArmLabel(row.original.arm)}</span>,
      meta: { label: "Experiment" },
    },
    {
      accessorKey: "failure_rate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Failure Rate" />,
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.failure_rate}</span>,
      meta: { label: "Failure Rate" },
    },
    {
      accessorKey: "resolution_rate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Resolution" />,
      cell: ({ row }) => (
        <span className="tabular-nums text-success">
          {row.original.resolved}/{row.original.total} ({formatPercentCell(row.original.resolution_rate)})
        </span>
      ),
      meta: { label: "Resolution" },
    },
    {
      accessorKey: "avg_latency_ms",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Latency" />,
      cell: ({ row }) => <span className="tabular-nums">{formatNullableDuration(row.original.avg_latency_ms)}</span>,
      meta: { label: "Latency" },
    },
    {
      accessorKey: "avg_replans",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Retries" />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.avg_replans.toFixed(2)}</span>,
      meta: { label: "Retries" },
    },
    {
      accessorKey: "avg_tool_calls",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tool Calls" />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.avg_tool_calls.toFixed(2)}</span>,
      meta: { label: "Tool Calls" },
    },
    {
      accessorKey: "memory_hit_rate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Memory Hits" />,
      cell: ({ row }) => <span className="tabular-nums">{formatNullablePercent(row.original.memory_hit_rate)}</span>,
      meta: { label: "Memory Hits" },
    },
    {
      accessorKey: "p_value",
      header: ({ column }) => <DataTableColumnHeader column={column} title="P-value" />,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.p_value === null ? "—" : row.original.p_value < 0.001 ? "<0.001" : row.original.p_value.toFixed(3)}
        </span>
      ),
      meta: { label: "P-value" },
    },
    {
      id: "significant",
      header: "Significant?",
      cell: ({ row }) => <SignificanceBadge pValue={row.original.p_value} significant={row.original.significant} />,
      enableSorting: false,
      meta: { label: "Significant?" },
    },
  ]
}
