import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { AuditCard } from "@/features/audit-logs/components/audit-card"
import { ActionBadge } from "@/features/audit-logs/components/action-badge"
import { AuditStatusBadge } from "@/features/audit-logs/components/audit-status-badge"
import { formatRelativeTime } from "@/lib/format"
import type { AuditLogEntry } from "@/types/mocked"

interface ColumnsOptions {
  onInspect?: (id: string) => void
}

export function buildAuditColumns({ onInspect }: ColumnsOptions = {}): ColumnDef<AuditLogEntry>[] {
  return [
    {
      accessorKey: "timestamp",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Timestamp" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatRelativeTime(row.original.timestamp)}</span>
      ),
      meta: { label: "Timestamp" },
    },
    {
      accessorKey: "actor",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Actor" />,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.actor}</p>
          <p className="truncate text-xs text-muted-foreground">{row.original.actor_email}</p>
        </div>
      ),
      meta: { label: "Actor" },
    },
    {
      accessorKey: "client_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Client" />,
      cell: ({ row }) => <span className="truncate">{row.original.client_name}</span>,
      meta: { label: "Client" },
    },
    {
      accessorKey: "action",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
      cell: ({ row }) => <AuditCard entry={row.original} />,
      meta: { label: "Action" },
      size: 220,
    },
    {
      accessorKey: "category",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
      cell: ({ row }) => <ActionBadge category={row.original.category} />,
      meta: { label: "Category" },
    },
    {
      accessorKey: "resource",
      header: "Resource",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.resource}</span>,
      enableSorting: false,
      meta: { label: "Resource" },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <AuditStatusBadge status={row.original.status} />,
      meta: { label: "Status" },
    },
    {
      accessorKey: "ip_address",
      header: "IP Address",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.ip_address}</span>,
      enableSorting: false,
      meta: { label: "IP Address" },
    },
    {
      accessorKey: "request_id",
      header: "Request ID",
      cell: ({ row }) => (
        <span className="truncate font-mono text-xs text-muted-foreground">{row.original.request_id}</span>
      ),
      enableSorting: false,
      meta: { label: "Request ID" },
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
              aria-label={`Actions for ${row.original.action}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" data-stop-row-click>
            <DropdownMenuItem onSelect={() => onInspect?.(row.original.id)}>Inspect event</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
  ]
}
