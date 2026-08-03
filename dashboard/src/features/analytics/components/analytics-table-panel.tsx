import { useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { DataTable } from "@/components/data-table/data-table"
import { AnalyticsCard } from "@/features/analytics/components/analytics-card"

interface AnalyticsTablePanelProps<TData> {
  title: string
  data: TData[]
  columns: ColumnDef<TData>[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  emptyTitle: string
  emptyDescription?: string
  getRowId: (row: TData) => string
  className?: string
}

/** One of the five "top N" analytics tables — client-side sorted (each list is already a small,
 * fully-fetched top-10), so unlike Conversations/Memory Explorer/Tool Monitoring this owns its
 * own useReactTable instance instead of taking manualSorting props from the page. */
export function AnalyticsTablePanel<TData>({
  title,
  data,
  columns,
  isLoading,
  isError,
  onRetry,
  emptyTitle,
  emptyDescription,
  getRowId,
  className,
}: AnalyticsTablePanelProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
  })

  return (
    <AnalyticsCard title={title} className={className}>
      <DataTable
        table={table}
        columnCount={columns.length}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
    </AnalyticsCard>
  )
}
