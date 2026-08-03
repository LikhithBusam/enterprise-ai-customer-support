import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { ConfidenceBadge } from "@/features/memory-explorer/components/confidence-badge"
import { SimilarityBadge } from "@/features/memory-explorer/components/similarity-badge"
import { MemoryStatusBadge } from "@/features/memory-explorer/components/memory-status-badge"
import { MEMORY_TYPE_LABELS } from "@/lib/memory-types"
import { formatRelativeTime } from "@/lib/format"
import type { MemoryEntryBase } from "@/types/mocked"

export function buildMemoryColumns(): ColumnDef<MemoryEntryBase>[] {
  return [
    {
      accessorKey: "id",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Memory ID" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span>,
      meta: { label: "Memory ID" },
    },
    {
      accessorKey: "memory_type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="font-normal">
          {MEMORY_TYPE_LABELS[row.original.memory_type]}
        </Badge>
      ),
      meta: { label: "Type" },
    },
    {
      accessorKey: "summary",
      header: "Summary",
      cell: ({ row }) => (
        <p className="max-w-80 truncate text-foreground">{row.original.summary}</p>
      ),
      enableSorting: false,
      meta: { label: "Summary" },
    },
    {
      accessorKey: "similarity_score",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Similarity" />,
      cell: ({ row }) => <SimilarityBadge value={row.original.similarity_score} />,
      meta: { label: "Similarity" },
    },
    {
      accessorKey: "confidence",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Confidence" />,
      cell: ({ row }) => <ConfidenceBadge value={row.original.confidence} />,
      meta: { label: "Confidence" },
    },
    {
      accessorKey: "usage_count",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Usage Count" />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.usage_count}</span>,
      meta: { label: "Usage Count" },
    },
    {
      accessorKey: "timestamp",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatRelativeTime(row.original.timestamp)}</span>
      ),
      meta: { label: "Created" },
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
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <MemoryStatusBadge status={row.original.status} />,
      meta: { label: "Status" },
    },
  ]
}
