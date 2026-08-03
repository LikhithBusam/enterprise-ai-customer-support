import type { Table } from "@tanstack/react-table"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useSearchToolbar } from "@/hooks/use-search-toolbar"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter"
import type { ClientRecord } from "@/types/mocked"

const PLAN_OPTIONS = [
  { label: "Starter", value: "starter" },
  { label: "Growth", value: "growth" },
  { label: "Enterprise", value: "enterprise" },
]

const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Trial", value: "trial" },
  { label: "Suspended", value: "suspended" },
]

interface ClientToolbarProps {
  table: Table<ClientRecord>
  search: string
  onSearchChange: (value: string) => void
  plan: string[]
  onPlanChange: (value: string[]) => void
  status: string[]
  onStatusChange: (value: string[]) => void
  hasActiveFilters: boolean
  onResetAll: () => void
}

/** Free-text search, plan/status filters, column visibility, and a reset for every filter this
 * page exposes (this toolbar's facets plus ClientFilters' range/date controls). */
export function ClientToolbar({
  table,
  search,
  onSearchChange,
  plan,
  onPlanChange,
  status,
  onStatusChange,
  hasActiveFilters,
  onResetAll,
}: ClientToolbarProps) {
  const [localSearch, setLocalSearch] = useSearchToolbar(search, onSearchChange)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        name="client-search"
        placeholder="Search client name or ID…"
        value={localSearch}
        onChange={(event) => setLocalSearch(event.target.value)}
        className="h-8 w-56"
        aria-label="Search clients"
      />
      <DataTableFacetedFilter title="Plan" options={PLAN_OPTIONS} selected={plan} onChange={onPlanChange} />
      <DataTableFacetedFilter title="Status" options={STATUS_OPTIONS} selected={status} onChange={onStatusChange} />
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="gap-1" onClick={onResetAll}>
          Reset
          <X className="size-3.5" />
        </Button>
      )}
      <div className="ml-auto">
        <DataTableViewOptions table={table} />
      </div>
    </div>
  )
}
