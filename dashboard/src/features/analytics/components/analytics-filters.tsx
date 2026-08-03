import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter"
import { ANALYTICS_CLIENTS } from "@/lib/analytics-clients"
import { INTENT_LABELS } from "@/lib/intent-labels"
import { MEMORY_TYPES, MEMORY_TYPE_LABELS } from "@/lib/memory-types"
import { TOOL_NAMES, toolLabel } from "@/lib/tools"
import type { AnalyticsFilterParams } from "@/features/analytics/search-params"

const INTENT_OPTIONS = Object.entries(INTENT_LABELS).map(([value, label]) => ({ label, value }))
const STATUS_OPTIONS = [
  { label: "Resolved", value: "resolved" },
  { label: "Escalated", value: "escalated" },
  { label: "Pending", value: "pending" },
  { label: "In progress", value: "in_progress" },
  { label: "Failed", value: "failed" },
]
const TOOL_OPTIONS = TOOL_NAMES.map((value) => ({ label: toolLabel(value), value }))
const MEMORY_TYPE_OPTIONS = MEMORY_TYPES.map((value) => ({ label: MEMORY_TYPE_LABELS[value], value }))

interface AnalyticsFiltersProps {
  filters: AnalyticsFilterParams
  onChange: (patch: Partial<AnalyticsFilterParams>) => void
}

/** Right-column filters panel — every dimension the Analytics endpoints accept. Date range and
 * the four multi-select facets narrow the underlying conversation/tool-call/memory sets;
 * Resolution and Client are single-select lenses layered on top. */
export function AnalyticsFilters({ filters, onChange }: AnalyticsFiltersProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="analytics-date-from">
              From
            </Label>
            <Input
              id="analytics-date-from"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => onChange({ dateFrom: event.target.value })}
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="analytics-date-to">
              To
            </Label>
            <Input
              id="analytics-date-to"
              type="date"
              value={filters.dateTo}
              onChange={(event) => onChange({ dateTo: event.target.value })}
              className="h-8"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Intent</Label>
          <DataTableFacetedFilter
            title="Intent"
            options={INTENT_OPTIONS}
            selected={filters.intent}
            onChange={(value) => onChange({ intent: value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <DataTableFacetedFilter
            title="Status"
            options={STATUS_OPTIONS}
            selected={filters.status}
            onChange={(value) => onChange({ status: value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tool</Label>
          <DataTableFacetedFilter
            title="Tool"
            options={TOOL_OPTIONS}
            selected={filters.tool}
            onChange={(value) => onChange({ tool: value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Memory type</Label>
          <DataTableFacetedFilter
            title="Memory type"
            options={MEMORY_TYPE_OPTIONS}
            selected={filters.memoryType}
            onChange={(value) => onChange({ memoryType: value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="analytics-resolution">
            Resolution
          </Label>
          <Select
            value={filters.resolution}
            onValueChange={(value) => onChange({ resolution: value as AnalyticsFilterParams["resolution"] })}
          >
            <SelectTrigger id="analytics-resolution" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="unresolved">Unresolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="analytics-client">
            Client
          </Label>
          <Select value={filters.client} onValueChange={(value) => onChange({ client: value })}>
            <SelectTrigger id="analytics-client" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {ANALYTICS_CLIENTS.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
