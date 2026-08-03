import type { Table } from "@tanstack/react-table"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useSearchToolbar } from "@/hooks/use-search-toolbar"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter"
import type { MemoryEntryBase } from "@/types/mocked"

const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Stale", value: "stale" },
  { label: "Archived", value: "archived" },
]

interface MemoryToolbarProps {
  table: Table<MemoryEntryBase>
  search: string
  onSearchChange: (value: string) => void
  status: string[]
  onStatusChange: (value: string[]) => void
  hasActiveFilters: boolean
  onResetAll: () => void
}

/** Free-text search, status filter, column visibility, and a reset for every filter this page
 * exposes (this toolbar's own status filter plus MemoryFilters' range/date controls). */
export function MemoryToolbar({
  table,
  search,
  onSearchChange,
  status,
  onStatusChange,
  hasActiveFilters,
  onResetAll,
}: MemoryToolbarProps) {
  const [localSearch, setLocalSearch] = useSearchToolbar(search, onSearchChange)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search memory ID, summary, tags…"
        value={localSearch}
        onChange={(event) => setLocalSearch(event.target.value)}
        className="h-8 w-64"
        aria-label="Search memory"
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
