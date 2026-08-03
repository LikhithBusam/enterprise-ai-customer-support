import { HealthBadge } from "@/features/tool-monitoring/components/health-badge"
import { TOOL_ICONS, toolLabel } from "@/lib/tools"
import { formatDuration, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ToolHealth } from "@/types/mocked"

interface ToolHealthCardProps {
  tool: ToolHealth
  active: boolean
  onClick: () => void
}

/** One row in the Tool Navigation — status, current latency, success rate, and error count per
 * tool. The app's reusable "ToolHealthCard" building block. */
export function ToolHealthCard({ tool, active, onClick }: ToolHealthCardProps) {
  const Icon = TOOL_ICONS[tool.tool_name]

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-primary/30 bg-muted ring-1 ring-primary/20"
          : "border-transparent hover:bg-muted/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />}
          <span className="truncate text-sm font-medium text-foreground">{toolLabel(tool.tool_name)}</span>
        </div>
        <HealthBadge status={tool.status} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-md bg-muted/50 px-1.5 py-1">
          <p className="text-[10px] text-muted-foreground">Latency</p>
          <p className="text-xs font-medium tabular-nums text-foreground">{formatDuration(tool.avg_latency_ms)}</p>
        </div>
        <div className="rounded-md bg-muted/50 px-1.5 py-1">
          <p className="text-[10px] text-muted-foreground">Success</p>
          <p className="text-xs font-medium tabular-nums text-foreground">{formatPercent(tool.success_rate)}</p>
        </div>
        <div className="rounded-md bg-muted/50 px-1.5 py-1">
          <p className="text-[10px] text-muted-foreground">Errors (24h)</p>
          <p className="text-xs font-medium tabular-nums text-foreground">{tool.retry_count_24h}</p>
        </div>
      </div>
    </button>
  )
}
