import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { formatDuration, formatPercent } from "@/lib/format"

interface ToolFiltersProps {
  latencyRange: [number, number]
  onLatencyRangeChange: (value: [number, number]) => void
  successMin: number
  onSuccessMinChange: (value: number) => void
  failureMax: number
  onFailureMaxChange: (value: number) => void
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
}

/** Advanced filter row below the toolbar — latency range, minimum success rate, maximum failure
 * rate, and a last-used date range. */
export function ToolFilters({
  latencyRange,
  onLatencyRangeChange,
  successMin,
  onSuccessMinChange,
  failureMax,
  onFailureMaxChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: ToolFiltersProps) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="w-48 space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Latency {formatDuration(latencyRange[0])} – {formatDuration(latencyRange[1])}
          </Label>
          <Slider
            min={0}
            max={5000}
            step={50}
            value={latencyRange}
            onValueChange={(value) => onLatencyRangeChange([value[0] ?? 0, value[1] ?? 5000])}
            thumbLabels={["Minimum latency", "Maximum latency"]}
            className="py-1.5"
          />
        </div>

        <div className="w-40 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Success rate ≥ {formatPercent(successMin / 100)}</Label>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[successMin]}
            onValueChange={(value) => onSuccessMinChange(value[0] ?? 0)}
            aria-label="Minimum success rate"
            className="py-1.5"
          />
        </div>

        <div className="w-40 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Failure rate ≤ {formatPercent(failureMax / 100)}</Label>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[failureMax]}
            onValueChange={(value) => onFailureMaxChange(value[0] ?? 100)}
            aria-label="Maximum failure rate"
            className="py-1.5"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="tool-date-from">
            Last used from
          </Label>
          <Input
            id="tool-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className="h-7 w-36"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="tool-date-to">
            Last used to
          </Label>
          <Input
            id="tool-date-to"
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
