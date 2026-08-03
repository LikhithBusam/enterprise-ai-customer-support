import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

interface ClientFiltersProps {
  usageRange: [number, number]
  onUsageRangeChange: (value: [number, number]) => void
  retentionRange: [number, number]
  onRetentionRangeChange: (value: [number, number]) => void
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
}

/** Advanced filter row below the toolbar — usage %, memory retention range, and a created-date
 * range. Mirrors features/tool-monitoring/components/tool-filters.tsx's shape. */
export function ClientFilters({
  usageRange,
  onUsageRangeChange,
  retentionRange,
  onRetentionRangeChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: ClientFiltersProps) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="w-48 space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Usage {usageRange[0]}% – {usageRange[1]}%
          </Label>
          <Slider
            min={0}
            max={120}
            step={5}
            value={usageRange}
            onValueChange={(value) => onUsageRangeChange([value[0] ?? 0, value[1] ?? 120])}
            thumbLabels={["Minimum usage", "Maximum usage"]}
            className="py-1.5"
          />
        </div>

        <div className="w-48 space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Memory retention {retentionRange[0]}d – {retentionRange[1]}d
          </Label>
          <Slider
            min={0}
            max={400}
            step={10}
            value={retentionRange}
            onValueChange={(value) => onRetentionRangeChange([value[0] ?? 0, value[1] ?? 400])}
            thumbLabels={["Minimum memory retention", "Maximum memory retention"]}
            className="py-1.5"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="client-date-from">
            Created from
          </Label>
          <Input
            id="client-date-from"
            name="client-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className="h-7 w-36"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="client-date-to">
            Created to
          </Label>
          <Input
            id="client-date-to"
            name="client-date-to"
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
