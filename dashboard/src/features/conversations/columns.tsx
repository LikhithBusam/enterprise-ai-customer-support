import type { ColumnDef } from "@tanstack/react-table"
import { CheckCircle2, MoreHorizontal, XCircle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { StatusBadge, type StatusKind } from "@/components/status/status-badge"
import { formatRelativeTime } from "@/lib/format"
import { formatIntentLabel } from "@/lib/intent-labels"
import type { ConversationSummary } from "@/types/mocked"

interface ColumnsOptions {
  onOpenLive?: (ticketId: string) => void
}

export function buildConversationColumns({
  onOpenLive,
}: ColumnsOptions = {}): ColumnDef<ConversationSummary>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          data-stop-row-click
          checked={
            table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
          aria-label="Select all rows on this page"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          data-stop-row-click
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          aria-label={`Select row ${row.id}`}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 32,
    },
    {
      accessorKey: "ticket_id",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Ticket ID" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.ticket_id}</span>,
      meta: { label: "Ticket ID" },
    },
    {
      accessorKey: "customer_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.customer_name}</p>
          <p className="truncate text-xs text-muted-foreground">{row.original.customer_id}</p>
        </div>
      ),
      meta: { label: "Customer" },
    },
    {
      accessorKey: "intent_label",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Intent" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="font-normal">
          {formatIntentLabel(row.original.intent_label)}
        </Badge>
      ),
      meta: { label: "Intent" },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <StatusBadge status={row.original.status as StatusKind} />,
      meta: { label: "Status" },
    },
    {
      id: "resolved",
      header: "Resolved",
      cell: ({ row }) =>
        row.original.status === "resolved" ? (
          <CheckCircle2 className="size-4 text-success" aria-label="Resolved" />
        ) : (
          <span className="text-muted-foreground/40" aria-label="Not resolved">
            —
          </span>
        ),
      enableSorting: false,
      meta: { label: "Resolved" },
    },
    {
      id: "escalated",
      header: "Escalated",
      cell: ({ row }) =>
        row.original.status === "escalated" ? (
          <XCircle className="size-4 text-warning" aria-label="Escalated" />
        ) : (
          <span className="text-muted-foreground/40" aria-label="Not escalated">
            —
          </span>
        ),
      enableSorting: false,
      meta: { label: "Escalated" },
    },
    {
      accessorKey: "memory_hit",
      header: "Memory Hit",
      cell: ({ row }) =>
        row.original.memory_hit ? (
          <CheckCircle2 className="size-4 text-info" aria-label="Memory hit" />
        ) : (
          <span className="text-muted-foreground/40" aria-label="No memory hit">
            —
          </span>
        ),
      enableSorting: false,
      meta: { label: "Memory Hit" },
    },
    {
      accessorKey: "replanning_count",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Iterations" />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.replanning_count + 1}</span>,
      meta: { label: "Iterations" },
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatRelativeTime(row.original.created_at)}</span>
      ),
      meta: { label: "Created" },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              data-stop-row-click
              aria-label={`Actions for ${row.original.ticket_id}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" data-stop-row-click>
            <DropdownMenuItem onSelect={() => onOpenLive?.(row.original.ticket_id)}>
              View live execution
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
  ]
}
