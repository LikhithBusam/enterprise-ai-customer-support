import type { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { HealthBadge } from "@/features/tool-monitoring/components/health-badge"
import { LatencyBadge } from "@/features/tool-monitoring/components/latency-badge"
import { toolLabel } from "@/lib/tools"
import { formatPercent, formatRelativeTime } from "@/lib/format"
import type { ToolHealth } from "@/types/mocked"

export function buildToolColumns(): ColumnDef<ToolHealth>[] {
  return [
    {
      accessorKey: "tool_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tool Name" />,
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{toolLabel(row.original.tool_name)}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.original.tool_name}</p>
        </div>
      ),
      meta: { label: "Tool Name" },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <HealthBadge status={row.original.status} />,
      meta: { label: "Status" },
    },
    {
      accessorKey: "availability",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Availability" />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.availability.toFixed(1)}%</span>,
      meta: { label: "Availability" },
    },
    {
      accessorKey: "avg_latency_ms",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Latency" />,
      cell: ({ row }) => <LatencyBadge valueMs={row.original.avg_latency_ms} />,
      meta: { label: "Latency" },
    },
    {
      accessorKey: "success_rate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Success Rate" />,
      cell: ({ row }) => (
        <span className="tabular-nums text-success">{formatPercent(row.original.success_rate)}</span>
      ),
      meta: { label: "Success Rate" },
    },
    {
      accessorKey: "failure_rate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Failure Rate" />,
      cell: ({ row }) => (
        <span className="tabular-nums text-destructive">{formatPercent(row.original.failure_rate)}</span>
      ),
      meta: { label: "Failure Rate" },
    },
    {
      accessorKey: "retry_count_24h",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Retries" />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.retry_count_24h}</span>,
      meta: { label: "Retries" },
    },
    {
      accessorKey: "last_used_at",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Used" />,
      cell: ({ row }) =>
        row.original.last_used_at ? (
          <span className="text-muted-foreground">{formatRelativeTime(row.original.last_used_at)}</span>
        ) : (
          <span className="text-muted-foreground/50">Never</span>
        ),
      meta: { label: "Last Used" },
    },
    {
      id: "last_error",
      header: "Last Error",
      cell: ({ row }) =>
        row.original.last_error ? (
          <span className="truncate text-xs text-destructive">{row.original.last_error.message}</span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
      enableSorting: false,
      meta: { label: "Last Error" },
    },
  ]
}
