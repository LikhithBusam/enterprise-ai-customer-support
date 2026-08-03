import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DatePreset {
  label: string
  days: number | null
}

const PRESETS: DatePreset[] = [
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "21D", days: 21 },
  { label: "All time", days: null },
]

function isoDaysAgo(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

interface AnalyticsToolbarProps {
  dateFrom: string
  dateTo: string
  onDateRangeChange: (dateFrom: string, dateTo: string) => void
  hasActiveFilters: boolean
  onResetAll: () => void
}

/** Page-level control bar — quick date-range presets plus a reset for every filter this page
 * exposes (this toolbar's presets plus AnalyticsFilters' more granular controls). */
export function AnalyticsToolbar({
  dateFrom,
  dateTo,
  onDateRangeChange,
  hasActiveFilters,
  onResetAll,
}: AnalyticsToolbarProps) {
  function isActivePreset(preset: DatePreset): boolean {
    if (preset.days === null) return dateFrom === "" && dateTo === ""
    return dateFrom === isoDaysAgo(preset.days) && dateTo === todayIso()
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            variant={isActivePreset(preset) ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() =>
              onDateRangeChange(
                preset.days === null ? "" : isoDaysAgo(preset.days),
                preset.days === null ? "" : todayIso(),
              )
            }
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {hasActiveFilters && (
        <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={onResetAll}>
          Reset filters
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
