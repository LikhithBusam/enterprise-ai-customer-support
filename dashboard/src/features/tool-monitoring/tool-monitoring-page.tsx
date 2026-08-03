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
import { buildToolColumns } from "@/features/tool-monitoring/columns"
import { ToolToolbar } from "@/features/tool-monitoring/components/tool-toolbar"
import { ToolFilters } from "@/features/tool-monitoring/components/tool-filters"
import { ToolNavigation } from "@/features/tool-monitoring/components/tool-navigation"
import { ToolStats } from "@/features/tool-monitoring/components/tool-stats"
import { ToolCharts } from "@/features/tool-monitoring/components/tool-charts"
import { ToolInspector } from "@/features/tool-monitoring/components/tool-inspector"
import { useTool, useToolStats, useToolsList } from "@/features/tool-monitoring/hooks"
import {
  buildToolSearchParams,
  parseToolSearchParams,
  toolSearchSchema,
  type ToolSearchParams,
} from "@/features/tool-monitoring/search-params"
import type { ToolHealth } from "@/types/mocked"

const UNFILTERED_PARAMS = toolSearchSchema.parse({})

export function ToolMonitoringPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseToolSearchParams(searchParams), [searchParams])
  const [selectedToolName, setSelectedToolName] = useState<string | null>(null)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const toolsQuery = useToolsList(params)
  const allToolsQuery = useToolsList(UNFILTERED_PARAMS)
  const statsQuery = useToolStats()
  const selectedToolQuery = useTool(selectedToolName)

  function updateParams(patch: Partial<ToolSearchParams>): void {
    const next = { ...params, ...patch }
    if (!("page" in patch)) next.page = 1
    setSearchParams(buildToolSearchParams(next), { replace: true })
  }

  const hasActiveFilters =
    params.search.length > 0 ||
    params.status.length > 0 ||
    params.latencyMin > 0 ||
    params.latencyMax < 5000 ||
    params.successMin > 0 ||
    params.failureMax < 100 ||
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
      sortBy: nextSort.id as ToolSearchParams["sortBy"],
      sortDir: nextSort.desc ? "desc" : "asc",
      page: params.page,
    })
  }

  const columns = useMemo(() => buildToolColumns(), [])
  const data = toolsQuery.data?.data ?? []

  const table = useReactTable({
    data,
    columns,
    getRowId: (row: ToolHealth) => row.tool_name,
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
      <PageHeader title="Tool Monitoring" description="Operational health for every tool the agents call" />
      <div className="space-y-4 p-6">
        {statsQuery.isError ? (
          <ErrorState onRetry={() => statsQuery.refetch()} />
        ) : statsQuery.isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {Array.from({ length: 8 }).map((_, index) => (
              // eslint-disable-next-line react/no-array-index-key -- fixed-length skeleton placeholder, never reordered
              <StatCardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <>
            <ToolStats stats={statsQuery.data} />
            <ToolCharts stats={statsQuery.data} />
          </>
        )}

        <div className="grid min-w-0 gap-4 lg:grid-cols-[240px_1fr_320px] lg:items-start">
          <div className="min-w-0 lg:sticky lg:top-6">
            <ToolNavigation
              tools={allToolsQuery.data?.data ?? []}
              selectedToolName={selectedToolName}
              onSelectTool={setSelectedToolName}
            />
          </div>

          <div className="min-w-0 space-y-3">
            <ToolToolbar
              table={table}
              search={params.search}
              onSearchChange={(value) => updateParams({ search: value })}
              status={params.status}
              onStatusChange={(value) => updateParams({ status: value })}
              hasActiveFilters={hasActiveFilters}
              onResetAll={resetAllFilters}
            />

            <ToolFilters
              latencyRange={[params.latencyMin, params.latencyMax]}
              onLatencyRangeChange={([latencyMin, latencyMax]) => updateParams({ latencyMin, latencyMax })}
              successMin={params.successMin}
              onSuccessMinChange={(value) => updateParams({ successMin: value })}
              failureMax={params.failureMax}
              onFailureMaxChange={(value) => updateParams({ failureMax: value })}
              dateFrom={params.dateFrom}
              onDateFromChange={(value) => updateParams({ dateFrom: value })}
              dateTo={params.dateTo}
              onDateToChange={(value) => updateParams({ dateTo: value })}
            />

            <DataTable
              table={table}
              columnCount={columns.length}
              isLoading={toolsQuery.isPending}
              isError={toolsQuery.isError}
              onRetry={() => toolsQuery.refetch()}
              emptyTitle="No tools found"
              emptyDescription="Try adjusting your search or filters."
              onRowClick={(row) => setSelectedToolName(row.tool_name)}
            />

            <DataTablePagination
              page={params.page}
              pageSize={params.pageSize}
              totalCount={toolsQuery.data?.total ?? 0}
              onPageChange={(page) => updateParams({ page })}
              onPageSizeChange={(pageSize) => updateParams({ pageSize, page: 1 })}
            />
          </div>

          <div className="min-w-0 lg:sticky lg:top-6">
            <ToolInspector
              tool={selectedToolQuery.data ?? null}
              isLoading={selectedToolQuery.isLoading}
              isError={selectedToolQuery.isError}
              onRetry={() => selectedToolQuery.refetch()}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
