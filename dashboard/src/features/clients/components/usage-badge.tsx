import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { formatNumber } from "@/lib/format"

interface UsageBadgeProps {
  used: number
  limit: number
  className?: string
  /** Renders a Progress bar + "used / limit" text beneath the percentage — used by the Client
   * Detail panel's Usage Summary card; the compact table-cell usage omits it. */
  showDetail?: boolean
}

// Full literal class strings (not built via template interpolation) so Tailwind's static content
// scanner can see each arbitrary-variant selector at build time.
const PROGRESS_INDICATOR_CLASS = {
  destructive: "[&>[data-slot=progress-indicator]]:bg-destructive",
  warning: "[&>[data-slot=progress-indicator]]:bg-warning",
  success: "[&>[data-slot=progress-indicator]]:bg-success",
} as const

function usageTone(pct: number): { text: string; indicator: string; progressIndicatorClass: string } {
  if (pct >= 100) return { text: "text-destructive", indicator: "bg-destructive", progressIndicatorClass: PROGRESS_INDICATOR_CLASS.destructive }
  if (pct >= 80) return { text: "text-warning", indicator: "bg-warning", progressIndicatorClass: PROGRESS_INDICATOR_CLASS.warning }
  return { text: "text-success", indicator: "bg-success", progressIndicatorClass: PROGRESS_INDICATOR_CLASS.success }
}

/** Fixed usage → color mapping (green under 80%, amber 80–99%, red at/over limit) — reused by the
 * Client List's Usage column and the Client Detail panel's Usage Summary / Memory Usage cards. */
export function UsageBadge({ used, limit, className, showDetail = false }: UsageBadgeProps) {
  const pct = limit === 0 ? 0 : Math.round((used / limit) * 100)
  const tone = usageTone(pct)

  if (!showDetail) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium tabular-nums", tone.text, className)}>
        <span className={cn("size-1.5 rounded-full", tone.indicator)} aria-hidden="true" />
        {pct}%
      </span>
    )
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {formatNumber(used)} / {formatNumber(limit)}
        </span>
        <span className={cn("font-medium tabular-nums", tone.text)}>{pct}%</span>
      </div>
      <Progress value={Math.min(100, pct)} className={tone.progressIndicatorClass} />
    </div>
  )
}
