import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  useReactTable,
  getCoreRowModel,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
} from "@tanstack/react-table"
import { PageHeader } from "@/components/layout/page-header"
import { DataTable } from "@/components/data-table/data-table"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { buildConversationColumns } from "@/features/conversations/columns"
import { ConversationsToolbar } from "@/features/conversations/conversations-toolbar"
import { useConversations } from "@/features/conversations/hooks"
import {
  buildConversationsSearchParams,
  parseConversationsSearchParams,
  type ConversationsSearchParams,
} from "@/features/conversations/search-params"
import type { ConversationSummary } from "@/types/mocked"

export function ConversationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const params = useMemo(() => parseConversationsSearchParams(searchParams), [searchParams])

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const conversationsQuery = useConversations(params)

  function updateParams(patch: Partial<ConversationsSearchParams>): void {
    const next = { ...params, ...patch }
    // Any change other than an explicit page change resets pagination to page 1.
    if (!("page" in patch)) next.page = 1
    setSearchParams(buildConversationsSearchParams(next), { replace: true })
  }

  const sorting: SortingState = [{ id: params.sortBy, desc: params.sortDir === "desc" }]

  function handleSortingChange(updater: SortingState | ((old: SortingState) => SortingState)): void {
    const next = typeof updater === "function" ? updater(sorting) : updater
    const nextSort = next[0]
    if (!nextSort) return
    updateParams({
      sortBy: nextSort.id as ConversationsSearchParams["sortBy"],
      sortDir: nextSort.desc ? "desc" : "asc",
      page: params.page,
    })
  }

  const columns = useMemo(
    () =>
      buildConversationColumns({
        onOpenLive: (ticketId) => navigate(`/conversations/${ticketId}/live`),
      }),
    [navigate],
  )

  const data = conversationsQuery.data?.data ?? []

  const table = useReactTable({
    data,
    columns,
    getRowId: (row: ConversationSummary) => row.ticket_id,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: true,
    state: { columnVisibility, rowSelection, sorting },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
  })

  const selectedCount = Object.keys(rowSelection).length

  return (
    <div>
      <PageHeader title="Conversations" description="All customer support tickets" />
      <div className="space-y-4 p-6">
        <ConversationsToolbar
          table={table}
          search={params.search}
          onSearchChange={(value) => updateParams({ search: value })}
          status={params.status}
          onStatusChange={(value) => updateParams({ status: value })}
          intent={params.intent}
          onIntentChange={(value) => updateParams({ intent: value })}
        />

        <DataTable
          table={table}
          columnCount={columns.length}
          isLoading={conversationsQuery.isPending}
          isError={conversationsQuery.isError}
          onRetry={() => conversationsQuery.refetch()}
          emptyTitle="No conversations found"
          emptyDescription="Try adjusting your search or filters."
          onRowClick={(row) => navigate(`/conversations/${row.ticket_id}`)}
        />

        <DataTablePagination
          page={params.page}
          pageSize={params.pageSize}
          totalCount={conversationsQuery.data?.total ?? 0}
          onPageChange={(page) => updateParams({ page })}
          onPageSizeChange={(pageSize) => updateParams({ pageSize, page: 1 })}
          selectedCount={selectedCount || undefined}
        />
      </div>
    </div>
  )
}
