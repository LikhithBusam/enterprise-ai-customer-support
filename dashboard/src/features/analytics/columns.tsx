import type { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { StatusBadge, type StatusKind } from "@/components/status/status-badge"
import { formatIntentLabel } from "@/lib/intent-labels"
import { MEMORY_TYPE_LABELS } from "@/lib/memory-types"
import { toolLabel } from "@/lib/tools"
import { formatDuration, formatNumber, formatPercent, formatRelativeTime } from "@/lib/format"
import type {
  FrequentMemoryRow,
  HighRetryConversationRow,
  LongResolutionRow,
  TopCustomerRow,
  TopToolFailureRow,
} from "@/types/mocked"

export function buildTopCustomersColumns(): ColumnDef<TopCustomerRow>[] {
  return [
    {
      accessorKey: "customer_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.customer_name}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.original.customer_id}</p>
        </div>
      ),
      meta: { label: "Customer" },
    },
    {
      accessorKey: "ticket_count",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tickets" />,
      cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.ticket_count)}</span>,
      meta: { label: "Tickets" },
    },
    {
      accessorKey: "resolution_rate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Resolution Rate" />,
      cell: ({ row }) => <span className="tabular-nums text-success">{formatPercent(row.original.resolution_rate)}</span>,
      meta: { label: "Resolution Rate" },
    },
    {
      accessorKey: "avg_latency_ms",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Avg Latency" />,
      cell: ({ row }) => <span className="tabular-nums">{formatDuration(row.original.avg_latency_ms)}</span>,
      meta: { label: "Avg Latency" },
    },
  ]
}

export function buildTopToolFailuresColumns(): ColumnDef<TopToolFailureRow>[] {
  return [
    {
      accessorKey: "tool_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tool" />,
      cell: ({ row }) => <span className="font-medium text-foreground">{toolLabel(row.original.tool_name)}</span>,
      meta: { label: "Tool" },
    },
    {
      accessorKey: "failure_type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Failure Type" />,
      cell: ({ row }) => <span className="font-mono text-xs text-destructive">{row.original.failure_type}</span>,
      meta: { label: "Failure Type" },
    },
    {
      accessorKey: "count",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Count" />,
      cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.count)}</span>,
      meta: { label: "Count" },
    },
    {
      accessorKey: "last_seen",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Seen" />,
      cell: ({ row }) => <span className="text-muted-foreground">{formatRelativeTime(row.original.last_seen)}</span>,
      meta: { label: "Last Seen" },
    },
  ]
}

export function buildHighRetryColumns(): ColumnDef<HighRetryConversationRow>[] {
  return [
    {
      accessorKey: "ticket_id",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Ticket" />,
      cell: ({ row }) => <span className="font-mono text-xs text-foreground">{row.original.ticket_id}</span>,
      meta: { label: "Ticket" },
    },
    {
      accessorKey: "customer_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      meta: { label: "Customer" },
    },
    {
      accessorKey: "intent_label",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Intent" />,
      cell: ({ row }) => formatIntentLabel(row.original.intent_label),
      meta: { label: "Intent" },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <StatusBadge status={row.original.status as StatusKind} />,
      meta: { label: "Status" },
    },
    {
      accessorKey: "replanning_count",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Retries" />,
      cell: ({ row }) => <span className="tabular-nums font-medium text-warning">{row.original.replanning_count}</span>,
      meta: { label: "Retries" },
    },
  ]
}

export function buildLongResolutionColumns(): ColumnDef<LongResolutionRow>[] {
  return [
    {
      accessorKey: "ticket_id",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Ticket" />,
      cell: ({ row }) => <span className="font-mono text-xs text-foreground">{row.original.ticket_id}</span>,
      meta: { label: "Ticket" },
    },
    {
      accessorKey: "customer_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      meta: { label: "Customer" },
    },
    {
      accessorKey: "intent_label",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Intent" />,
      cell: ({ row }) => formatIntentLabel(row.original.intent_label),
      meta: { label: "Intent" },
    },
    {
      accessorKey: "resolution_time_ms",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Resolution Time" />,
      cell: ({ row }) => <span className="tabular-nums font-medium">{formatDuration(row.original.resolution_time_ms)}</span>,
      meta: { label: "Resolution Time" },
    },
    {
      accessorKey: "resolved_at",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Resolved" />,
      cell: ({ row }) => <span className="text-muted-foreground">{formatRelativeTime(row.original.resolved_at)}</span>,
      meta: { label: "Resolved" },
    },
  ]
}

export function buildFrequentMemoriesColumns(): ColumnDef<FrequentMemoryRow>[] {
  return [
    {
      accessorKey: "memory_type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => <span className="text-xs font-medium text-foreground">{MEMORY_TYPE_LABELS[row.original.memory_type]}</span>,
      meta: { label: "Type" },
    },
    {
      accessorKey: "summary",
      header: "Summary",
      cell: ({ row }) => <span className="line-clamp-1 text-muted-foreground">{row.original.summary}</span>,
      enableSorting: false,
      meta: { label: "Summary" },
    },
    {
      accessorKey: "usage_count",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Usage" />,
      cell: ({ row }) => <span className="tabular-nums font-medium">{formatNumber(row.original.usage_count)}</span>,
      meta: { label: "Usage" },
    },
    {
      accessorKey: "confidence",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Confidence" />,
      cell: ({ row }) => <span className="tabular-nums">{formatPercent(row.original.confidence)}</span>,
      meta: { label: "Confidence" },
    },
    {
      accessorKey: "last_retrieved_at",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Retrieved" />,
      cell: ({ row }) =>
        row.original.last_retrieved_at ? (
          <span className="text-muted-foreground">{formatRelativeTime(row.original.last_retrieved_at)}</span>
        ) : (
          <span className="text-muted-foreground/50">Never</span>
        ),
      meta: { label: "Last Retrieved" },
    },
  ]
}
