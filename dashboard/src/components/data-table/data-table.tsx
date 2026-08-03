import { useRef } from "react"
import { flexRender, type Table as TanstackTable } from "@tanstack/react-table"
import { ChevronRight, Inbox } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/status/empty-state"
import { ErrorState } from "@/components/status/error-state"
import { TableSkeleton } from "@/components/status/skeletons"
import { cn } from "@/lib/utils"

interface DataTableProps<TData> {
  /** The caller owns the `useReactTable()` instance (columns, data, sorting/visibility/selection
   * state) — this component is purely presentational, so a single table instance can be shared
   * with sibling toolbar components (column-visibility dropdown, faceted filters, bulk-action
   * bar) instead of each maintaining its own redundant copy. This is the reusable shape shared by
   * Conversations, Memory Explorer, Tool Monitoring, Client Management, and Audit Logs. */
  table: TanstackTable<TData>
  columnCount: number
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (row: TData) => void
}

export function DataTable<TData>({
  table,
  columnCount,
  isLoading = false,
  isError = false,
  onRetry,
  emptyTitle = "No results",
  emptyDescription = "Try adjusting your filters.",
  onRowClick,
}: DataTableProps<TData>) {
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const rows = table.getRowModel().rows
  // Rows themselves are never an ARIA-interactive element (see handleFocusableKeyDown's doc
  // comment) — this is purely how many real columns get rendered, so the loading/error/empty
  // placeholder rows' colSpan still spans the full table width including the trailing open-row
  // button column.
  const effectiveColumnCount = columnCount + (onRowClick ? 1 : 0)

  // Arrow-key scanning between rows' "open" buttons — the keyboard equivalent of clicking
  // anywhere in a row, now targeting a real focusable element instead of the row itself (see
  // the TableRow doc comment below for why the row can't hold this responsibility directly).
  function handleFocusableKeyDown(event: React.KeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    event.preventDefault()
    const focusable = bodyRef.current?.querySelectorAll<HTMLElement>("[data-row-focusable]")
    if (!focusable || focusable.length === 0) return
    const currentIndex = Array.from(focusable).indexOf(event.currentTarget)
    const nextIndex =
      event.key === "ArrowDown"
        ? Math.min(currentIndex + 1, focusable.length - 1)
        : Math.max(currentIndex - 1, 0)
    focusable[nextIndex]?.focus()
  }

  return (
    <div className="relative overflow-auto rounded-lg border border-border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} colSpan={header.colSpan}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
              {onRowClick && <TableHead aria-hidden="true" className="w-9" />}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody ref={bodyRef}>
          {isError ? (
            <TableRow>
              <TableCell colSpan={effectiveColumnCount} className="p-0">
                <ErrorState onRetry={onRetry} />
              </TableCell>
            </TableRow>
          ) : isLoading ? (
            <TableRow>
              <TableCell colSpan={effectiveColumnCount} className="p-0">
                <TableSkeleton columns={effectiveColumnCount} />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={effectiveColumnCount} className="p-0">
                <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              // Deliberately NOT role="button"/tabIndex/onKeyDown here. Every row that uses
              // onRowClick also renders real interactive children (a row-actions dropdown button,
              // sometimes a selection checkbox, and — below — a dedicated "open" button) —
              // claiming an interactive ARIA role on the <tr> itself while it contains those
              // nested controls is an invalid widget pattern that both breaks native table
              // row/cell announcement for screen readers and caused a real bug (Enter on the
              // nested actions button also fired this row's own Enter handler). onClick is kept
              // as a mouse-only convenience — with no role/tabIndex it carries no ARIA meaning,
              // so it can't mislead assistive tech into announcing the row as a widget.
              <TableRow
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={cn(onRowClick && "cursor-pointer hover:bg-muted/40")}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    onClick={(event) => {
                      // Let interactive cell content (checkboxes, action menus) handle its own
                      // click without also triggering row navigation.
                      if ((event.target as HTMLElement).closest("[data-stop-row-click]")) {
                        event.stopPropagation()
                      }
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
                {onRowClick && (
                  <TableCell className="w-9 p-0">
                    <button
                      type="button"
                      data-row-focusable
                      aria-label={`Open ${row.id}`}
                      className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={(event) => {
                        event.stopPropagation()
                        onRowClick(row.original)
                      }}
                      onKeyDown={handleFocusableKeyDown}
                    >
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
