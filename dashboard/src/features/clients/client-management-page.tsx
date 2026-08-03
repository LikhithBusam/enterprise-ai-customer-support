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
import { buildClientColumns } from "@/features/clients/columns"
import { ClientToolbar } from "@/features/clients/components/client-toolbar"
import { ClientFilters } from "@/features/clients/components/client-filters"
import { ClientStats } from "@/features/clients/components/client-stats"
import { ClientDetailPanel } from "@/features/clients/components/client-detail"
import { ClientInspector } from "@/features/clients/components/client-inspector"
import { useClient, useClientStats, useClientsList } from "@/features/clients/hooks"
import {
  buildClientsSearchParams,
  parseClientsSearchParams,
  clientsSearchSchema,
  type ClientsSearchParams,
} from "@/features/clients/search-params"
import type { ClientRecord } from "@/types/mocked"

const UNFILTERED_PARAMS = clientsSearchSchema.parse({})

export function ClientManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseClientsSearchParams(searchParams), [searchParams])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const clientsQuery = useClientsList(params)
  const statsQuery = useClientStats()
  const selectedClientQuery = useClient(selectedClientId)

  function updateParams(patch: Partial<ClientsSearchParams>): void {
    const next = { ...params, ...patch }
    if (!("page" in patch)) next.page = 1
    setSearchParams(buildClientsSearchParams(next), { replace: true })
  }

  const hasActiveFilters =
    params.search.length > 0 ||
    params.plan.length > 0 ||
    params.status.length > 0 ||
    params.usageMin > UNFILTERED_PARAMS.usageMin ||
    params.usageMax < UNFILTERED_PARAMS.usageMax ||
    params.retentionMin > UNFILTERED_PARAMS.retentionMin ||
    params.retentionMax < UNFILTERED_PARAMS.retentionMax ||
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
      sortBy: nextSort.id as ClientsSearchParams["sortBy"],
      sortDir: nextSort.desc ? "desc" : "asc",
      page: params.page,
    })
  }

  const columns = useMemo(
    () => buildClientColumns({ onInspect: (clientId) => setSelectedClientId(clientId) }),
    [],
  )
  const data = clientsQuery.data?.data ?? []

  const table = useReactTable({
    data,
    columns,
    getRowId: (row: ClientRecord) => row.client_id,
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
      <PageHeader
        title="Client Management"
        description="Manage every client tenant, plan, and usage limit"
      />
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
          <ClientStats stats={statsQuery.data} />
        )}

        <ClientToolbar
          table={table}
          search={params.search}
          onSearchChange={(value) => updateParams({ search: value })}
          plan={params.plan}
          onPlanChange={(value) => updateParams({ plan: value })}
          status={params.status}
          onStatusChange={(value) => updateParams({ status: value })}
          hasActiveFilters={hasActiveFilters}
          onResetAll={resetAllFilters}
        />

        <ClientFilters
          usageRange={[params.usageMin, params.usageMax]}
          onUsageRangeChange={([usageMin, usageMax]) => updateParams({ usageMin, usageMax })}
          retentionRange={[params.retentionMin, params.retentionMax]}
          onRetentionRangeChange={([retentionMin, retentionMax]) => updateParams({ retentionMin, retentionMax })}
          dateFrom={params.dateFrom}
          onDateFromChange={(value) => updateParams({ dateFrom: value })}
          dateTo={params.dateTo}
          onDateToChange={(value) => updateParams({ dateTo: value })}
        />

        <DataTable
          table={table}
          columnCount={columns.length}
          isLoading={clientsQuery.isPending}
          isError={clientsQuery.isError}
          onRetry={() => clientsQuery.refetch()}
          emptyTitle="No clients found"
          emptyDescription="Try adjusting your search or filters."
          onRowClick={(row) => setSelectedClientId(row.client_id)}
        />

        <DataTablePagination
          page={params.page}
          pageSize={params.pageSize}
          totalCount={clientsQuery.data?.total ?? 0}
          onPageChange={(page) => updateParams({ page })}
          onPageSizeChange={(pageSize) => updateParams({ pageSize, page: 1 })}
        />

        <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
          <div className="min-w-0">
            <ClientDetailPanel
              client={selectedClientQuery.data ?? null}
              isLoading={selectedClientQuery.isLoading}
              isError={selectedClientQuery.isError}
              onRetry={() => selectedClientQuery.refetch()}
            />
          </div>
          <div className="min-w-0 lg:sticky lg:top-6">
            <ClientInspector client={selectedClientQuery.data ?? null} />
          </div>
        </div>
      </div>
    </div>
  )
}
