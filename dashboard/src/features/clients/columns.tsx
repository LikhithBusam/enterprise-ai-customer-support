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
import { ClientCard } from "@/features/clients/components/client-card"
import { PlanBadge } from "@/features/clients/components/plan-badge"
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge"
import { UsageBadge } from "@/features/clients/components/usage-badge"
import { maskApiKey } from "@/lib/clients"
import { formatNumber, formatRelativeTime } from "@/lib/format"
import type { ClientRecord } from "@/types/mocked"

interface ColumnsOptions {
  onInspect?: (clientId: string) => void
}

export function buildClientColumns({ onInspect }: ColumnsOptions = {}): ColumnDef<ClientRecord>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Client Name" />,
      cell: ({ row }) => (
        <ClientCard
          name={row.original.name}
          clientId={row.original.client_id}
          plan={row.original.plan}
          status={row.original.status}
        />
      ),
      meta: { label: "Client Name" },
      size: 220,
    },
    {
      accessorKey: "client_id",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Client ID" />,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.client_id}</span>,
      meta: { label: "Client ID" },
    },
    {
      accessorKey: "plan",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Plan" />,
      cell: ({ row }) => <PlanBadge plan={row.original.plan} />,
      meta: { label: "Plan" },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <ClientStatusBadge status={row.original.status} />,
      meta: { label: "Status" },
    },
    {
      accessorKey: "api_key_last4",
      header: "API Key",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{maskApiKey(row.original.api_key_last4)}</span>,
      enableSorting: false,
      meta: { label: "API Key" },
    },
    {
      accessorKey: "active_users",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Active Users" />,
      cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.active_users)}</span>,
      meta: { label: "Active Users" },
    },
    {
      accessorKey: "monthly_ticket_usage",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Usage" />,
      cell: ({ row }) => <UsageBadge used={row.original.monthly_ticket_usage} limit={row.original.monthly_ticket_limit} />,
      meta: { label: "Usage" },
    },
    {
      accessorKey: "memory_retention_days",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Memory Retention" />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.memory_retention_days}d</span>,
      meta: { label: "Memory Retention" },
    },
    {
      accessorKey: "rate_limit_per_minute",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Rate Limit" />,
      cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.rate_limit_per_minute)}/min</span>,
      meta: { label: "Rate Limit" },
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created Date" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatRelativeTime(row.original.created_at)}</span>
      ),
      meta: { label: "Created Date" },
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
              aria-label={`Actions for ${row.original.name}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" data-stop-row-click>
            <DropdownMenuItem onSelect={() => onInspect?.(row.original.client_id)}>
              Inspect client
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
