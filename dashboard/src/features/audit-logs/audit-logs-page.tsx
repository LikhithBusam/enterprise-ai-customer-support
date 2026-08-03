import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  useReactTable,
  getCoreRowModel,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { PageHeader } from "@/components/layout/page-header"
import { DataTable } from "@/components/data-table/data-table"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { ErrorState } from "@/components/status/error-state"
import { StatCardSkeleton } from "@/components/status/skeletons"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { buildAuditColumns } from "@/features/audit-logs/columns"
import { AuditToolbar } from "@/features/audit-logs/components/audit-toolbar"
import { AuditFilters } from "@/features/audit-logs/components/audit-filters"
import { AuditStats } from "@/features/audit-logs/components/audit-stats"
import { AuditInspector } from "@/features/audit-logs/components/audit-inspector"
import { useAuditLog, useAuditLogsList, useAuditStats } from "@/features/audit-logs/hooks"
import {
  buildAuditSearchParams,
  parseAuditSearchParams,
  type AuditSearchParams,
} from "@/features/audit-logs/search-params"
import type { AuditLogEntry } from "@/types/mocked"

export function AuditLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseAuditSearchParams(searchParams), [searchParams])
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const auditQuery = useAuditLogsList(params)
  const statsQuery = useAuditStats()
  const selectedLogQuery = useAuditLog(selectedLogId)

  function updateParams(patch: Partial<AuditSearchParams>): void {
    const next = { ...params, ...patch }
    if (!("page" in patch)) next.page = 1
    setSearchParams(buildAuditSearchParams(next), { replace: true })
  }

  const hasActiveFilters =
    params.search.length > 0 ||
    params.category.length > 0 ||
    params.actor.length > 0 ||
    params.client.length > 0 ||
    params.status.length > 0 ||
    params.severity.length > 0 ||
    params.dateFrom.length > 0 ||
    params.dateTo.length > 0

  function resetAllFilters(): void {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const sorting: SortingState = [{ id: params.sortBy, desc: params.sortDir === "desc" }]

  function handleSortingChange(updater: SortingState | ((old: SortingState) => SortingState)): void {
    const next = typeof updater === "function" ? updater(sorting) : updater
    const nextSort = next[0]
    if (!nextSort) return
    updateParams({
      sortBy: nextSort.id as AuditSearchParams["sortBy"],
      sortDir: nextSort.desc ? "desc" : "asc",
      page: params.page,
    })
  }

  const columns = useMemo(() => buildAuditColumns({ onInspect: (id) => setSelectedLogId(id) }), [])
  const data = auditQuery.data?.data ?? []

  const table = useReactTable({
    data,
    columns,
    getRowId: (row: AuditLogEntry) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    state: { columnVisibility, sorting },
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: handleSortingChange,
  })

  return (
    <div>
      <PageHeader title="Audit Logs" description="Every security, configuration, and access event across this workspace" />
      <div className="space-y-4 p-6">
        {statsQuery.isError ? (
          <ErrorState onRetry={() => statsQuery.refetch()} />
        ) : statsQuery.isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              // eslint-disable-next-line react/no-array-index-key -- fixed-length skeleton placeholder, never reordered
              <StatCardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <AuditStats stats={statsQuery.data} />
        )}

        <AuditToolbar
          table={table}
          search={params.search}
          onSearchChange={(value) => updateParams({ search: value })}
          category={params.category}
          onCategoryChange={(value) => updateParams({ category: value })}
          actor={params.actor}
          onActorChange={(value) => updateParams({ actor: value })}
          client={params.client}
          onClientChange={(value) => updateParams({ client: value })}
          status={params.status}
          onStatusChange={(value) => updateParams({ status: value })}
          severity={params.severity}
          onSeverityChange={(value) => updateParams({ severity: value })}
          hasActiveFilters={hasActiveFilters}
          onResetAll={resetAllFilters}
        />

        <AuditFilters
          dateFrom={params.dateFrom}
          onDateFromChange={(value) => updateParams({ dateFrom: value })}
          dateTo={params.dateTo}
          onDateToChange={(value) => updateParams({ dateTo: value })}
        />

        <DataTable
          table={table}
          columnCount={columns.length}
          isLoading={auditQuery.isPending}
          isError={auditQuery.isError}
          onRetry={() => auditQuery.refetch()}
          emptyTitle="No audit events found"
          emptyDescription="Try adjusting your search or filters."
          onRowClick={(row) => setSelectedLogId(row.id)}
        />

        <DataTablePagination
          page={params.page}
          pageSize={params.pageSize}
          totalCount={auditQuery.data?.total ?? 0}
          onPageChange={(page) => updateParams({ page })}
          onPageSizeChange={(pageSize) => updateParams({ pageSize, page: 1 })}
        />
      </div>

      <Sheet open={selectedLogId !== null} onOpenChange={(open) => !open && setSelectedLogId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Log Inspector</SheetTitle>
            <SheetDescription>Full detail for the selected audit event.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <AuditInspector
              log={selectedLogQuery.data ?? null}
              isLoading={selectedLogQuery.isLoading}
              isError={selectedLogQuery.isError}
              onRetry={() => selectedLogQuery.refetch()}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
