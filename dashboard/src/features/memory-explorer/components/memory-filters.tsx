import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter"
import { MEMORY_TYPES, MEMORY_TYPE_LABELS } from "@/lib/memory-types"
import { formatPercent } from "@/lib/format"

const TYPE_OPTIONS = MEMORY_TYPES.map((type) => ({ label: MEMORY_TYPE_LABELS[type], value: type }))
const USAGE_PRESETS = [
  { label: "Any usage", value: "0" },
  { label: "Used 1+ times", value: "1" },
  { label: "Used 5+ times", value: "5" },
  { label: "Used 10+ times", value: "10" },
  { label: "Used 20+ times", value: "20" },
]

interface MemoryFiltersProps {
  types: string[]
  onTypesChange: (value: string[]) => void
  similarityRange: [number, number]
  onSimilarityRangeChange: (value: [number, number]) => void
  usageMin: number
  onUsageMinChange: (value: number) => void
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
}

/** Advanced filter row below the toolbar — type (kept in sync with the left nav via the same
 * URL param), similarity range, minimum usage, and a created-date range. */
export function MemoryFilters({
  types,
  onTypesChange,
  similarityRange,
  onSimilarityRangeChange,
  usageMin,
  onUsageMinChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: MemoryFiltersProps) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <DataTableFacetedFilter
            title="Type"
            options={TYPE_OPTIONS}
            selected={types}
            onChange={onTypesChange}
          />
        </div>

        <div className="w-48 space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Similarity {formatPercent(similarityRange[0])} – {formatPercent(similarityRange[1])}
          </Label>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={similarityRange}
            onValueChange={(value) => onSimilarityRangeChange([value[0] ?? 0, value[1] ?? 1])}
            thumbLabels={["Minimum similarity", "Maximum similarity"]}
            className="py-1.5"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="memory-usage-filter">
            Usage
          </Label>
          <Select value={String(usageMin)} onValueChange={(value) => onUsageMinChange(Number(value))}>
            <SelectTrigger id="memory-usage-filter" size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USAGE_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="memory-date-from">
            Created from
          </Label>
          <Input
            id="memory-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className="h-7 w-36"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="memory-date-to">
            Created to
          </Label>
          <Input
            id="memory-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            className="h-7 w-36"
          />
        </div>
      </CardContent>
    </Card>
  )
}
