import type { Table } from "@tanstack/react-table"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useSearchToolbar } from "@/hooks/use-search-toolbar"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter"
import { AUDIT_ACTOR_OPTIONS, AUDIT_CLIENT_OPTIONS } from "@/services/mock/fixtures/audit"
import type { AuditLogEntry } from "@/types/mocked"

const CATEGORY_OPTIONS = [
  { label: "Security", value: "security" },
  { label: "Configuration", value: "configuration" },
  { label: "Authentication", value: "authentication" },
  { label: "API Key", value: "api_key" },
  { label: "Data", value: "data" },
  { label: "System", value: "system" },
]

const STATUS_OPTIONS = [
  { label: "Success", value: "success" },
  { label: "Failure", value: "failure" },
  { label: "Warning", value: "warning" },
]

const SEVERITY_OPTIONS = [
  { label: "Info", value: "info" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" },
]

interface AuditToolbarProps {
  table: Table<AuditLogEntry>
  search: string
  onSearchChange: (value: string) => void
  category: string[]
  onCategoryChange: (value: string[]) => void
  actor: string[]
  onActorChange: (value: string[]) => void
  client: string[]
  onClientChange: (value: string[]) => void
  status: string[]
  onStatusChange: (value: string[]) => void
  severity: string[]
  onSeverityChange: (value: string[]) => void
  hasActiveFilters: boolean
  onResetAll: () => void
}

/** Free-text search plus every faceted filter (category/actor/client/status/severity), column
 * visibility, and a reset. Date range lives in the toolbar too since it's a compact pair of
 * inputs, not a separate filters row — unlike Client Management/Tool Monitoring's range sliders,
 * there's nothing here wide enough to warrant its own row. */
export function AuditToolbar({
  table,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  actor,
  onActorChange,
  client,
  onClientChange,
  status,
  onStatusChange,
  severity,
  onSeverityChange,
  hasActiveFilters,
  onResetAll,
}: AuditToolbarProps) {
  const [localSearch, setLocalSearch] = useSearchToolbar(search, onSearchChange)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        name="audit-search"
        placeholder="Search actor, action, resource, request ID…"
        value={localSearch}
        onChange={(event) => setLocalSearch(event.target.value)}
        className="h-8 w-64"
        aria-label="Search audit log"
      />
      <DataTableFacetedFilter title="Category" options={CATEGORY_OPTIONS} selected={category} onChange={onCategoryChange} />
      <DataTableFacetedFilter title="Actor" options={AUDIT_ACTOR_OPTIONS} selected={actor} onChange={onActorChange} />
      <DataTableFacetedFilter title="Client" options={AUDIT_CLIENT_OPTIONS} selected={client} onChange={onClientChange} />
      <DataTableFacetedFilter title="Status" options={STATUS_OPTIONS} selected={status} onChange={onStatusChange} />
      <DataTableFacetedFilter title="Severity" options={SEVERITY_OPTIONS} selected={severity} onChange={onSeverityChange} />
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
