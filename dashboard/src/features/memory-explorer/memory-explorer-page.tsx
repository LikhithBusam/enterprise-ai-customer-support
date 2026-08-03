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
import { buildMemoryColumns } from "@/features/memory-explorer/columns"
import { MemoryToolbar } from "@/features/memory-explorer/components/memory-toolbar"
import { MemoryFilters } from "@/features/memory-explorer/components/memory-filters"
import { MemoryTypeNav } from "@/features/memory-explorer/components/memory-type-nav"
import { MemoryStats } from "@/features/memory-explorer/components/memory-stats"
import { MemoryCharts } from "@/features/memory-explorer/components/memory-charts"
import { MemoryInspector } from "@/features/memory-explorer/components/memory-inspector"
import { useMemoryEntry, useMemoryList, useMemoryStats } from "@/features/memory-explorer/hooks"
import {
  buildMemorySearchParams,
  parseMemorySearchParams,
  type MemorySearchParams,
} from "@/features/memory-explorer/search-params"
import type { MemoryEntryBase } from "@/types/mocked"

export function MemoryExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseMemorySearchParams(searchParams), [searchParams])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const memoryQuery = useMemoryList(params)
  const statsQuery = useMemoryStats(undefined)
  const selectedEntryQuery = useMemoryEntry(selectedId)

  function updateParams(patch: Partial<MemorySearchParams>): void {
    const next = { ...params, ...patch }
    if (!("page" in patch)) next.page = 1
    setSearchParams(buildMemorySearchParams(next), { replace: true })
  }

  const hasActiveFilters =
    params.search.length > 0 ||
    params.types.length > 0 ||
    params.status.length > 0 ||
    params.simMin > 0 ||
    params.simMax < 1 ||
    params.usageMin > 0 ||
    params.usageMax < 100 ||
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
      sortBy: nextSort.id as MemorySearchParams["sortBy"],
      sortDir: nextSort.desc ? "desc" : "asc",
      page: params.page,
    })
  }

  const columns = useMemo(() => buildMemoryColumns(), [])
  const data = memoryQuery.data?.data ?? []

  const table = useReactTable({
    data,
    columns,
    getRowId: (row: MemoryEntryBase) => row.id,
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
      <PageHeader title="Memory Explorer" description="Every memory stored by the multi-agent system" />
      <div className="space-y-4 p-6">
        {statsQuery.isError ? (
          <ErrorState onRetry={() => statsQuery.refetch()} />
        ) : statsQuery.isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              // eslint-disable-next-line react/no-array-index-key -- fixed-length skeleton placeholder, never reordered
              <StatCardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <>
            <MemoryStats stats={statsQuery.data} />
            <MemoryCharts stats={statsQuery.data} />
          </>
        )}

        <div className="grid min-w-0 gap-4 lg:grid-cols-[240px_1fr_320px] lg:items-start">
          <div className="min-w-0 lg:sticky lg:top-6">
            <MemoryTypeNav
              byType={statsQuery.data?.by_type ?? []}
              totalCount={statsQuery.data?.total_count ?? 0}
              selectedTypes={params.types}
              onSelectType={(type) => updateParams({ types: type ? [type] : [] })}
            />
          </div>

          <div className="min-w-0 space-y-3">
            <MemoryToolbar
              table={table}
              search={params.search}
              onSearchChange={(value) => updateParams({ search: value })}
              status={params.status}
              onStatusChange={(value) => updateParams({ status: value })}
              hasActiveFilters={hasActiveFilters}
              onResetAll={resetAllFilters}
            />

            <MemoryFilters
              types={params.types}
              onTypesChange={(value) => updateParams({ types: value })}
              similarityRange={[params.simMin, params.simMax]}
              onSimilarityRangeChange={([simMin, simMax]) => updateParams({ simMin, simMax })}
              usageMin={params.usageMin}
              onUsageMinChange={(value) => updateParams({ usageMin: value })}
              dateFrom={params.dateFrom}
              onDateFromChange={(value) => updateParams({ dateFrom: value })}
              dateTo={params.dateTo}
              onDateToChange={(value) => updateParams({ dateTo: value })}
            />

            <DataTable
              table={table}
              columnCount={columns.length}
              isLoading={memoryQuery.isPending}
              isError={memoryQuery.isError}
              onRetry={() => memoryQuery.refetch()}
              emptyTitle="No memory entries found"
              emptyDescription="Try adjusting your search or filters."
              onRowClick={(row) => setSelectedId(row.id)}
            />

            <DataTablePagination
              page={params.page}
              pageSize={params.pageSize}
              totalCount={memoryQuery.data?.total ?? 0}
              onPageChange={(page) => updateParams({ page })}
              onPageSizeChange={(pageSize) => updateParams({ pageSize, page: 1 })}
            />
          </div>

          <div className="min-w-0 lg:sticky lg:top-6">
            <MemoryInspector
              entry={selectedEntryQuery.data ?? null}
              isLoading={selectedEntryQuery.isLoading}
              isError={selectedEntryQuery.isError}
              onRetry={() => selectedEntryQuery.refetch()}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
