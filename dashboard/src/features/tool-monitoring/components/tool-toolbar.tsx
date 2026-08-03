import type { Table } from "@tanstack/react-table"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useSearchToolbar } from "@/hooks/use-search-toolbar"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter"
import type { ToolHealth } from "@/types/mocked"

const STATUS_OPTIONS = [
  { label: "Healthy", value: "healthy" },
  { label: "Degraded", value: "degraded" },
  { label: "Offline", value: "offline" },
  { label: "Maintenance", value: "maintenance" },
  { label: "Unknown", value: "unknown" },
]

interface ToolToolbarProps {
  table: Table<ToolHealth>
  search: string
  onSearchChange: (value: string) => void
  status: string[]
  onStatusChange: (value: string[]) => void
  hasActiveFilters: boolean
  onResetAll: () => void
}

/** Free-text search, status filter, column visibility, and a reset for every filter this page
 * exposes (this toolbar's status filter plus ToolFilters' range/date controls). */
export function ToolToolbar({
  table,
  search,
  onSearchChange,
  status,
  onStatusChange,
  hasActiveFilters,
  onResetAll,
}: ToolToolbarProps) {
  const [localSearch, setLocalSearch] = useSearchToolbar(search, onSearchChange)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search tool name, description…"
        value={localSearch}
        onChange={(event) => setLocalSearch(event.target.value)}
        className="h-8 w-64"
        aria-label="Search tools"
      />
      <DataTableFacetedFilter
        title="Status"
        options={STATUS_OPTIONS}
        selected={status}
        onChange={onStatusChange}
      />
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
