import { CheckCircle2, Power, PowerOff, RotateCcw, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolEventStatus, ToolTimelineEvent } from "@/types/mocked"

const STATUS_ICON: Record<ToolEventStatus, typeof CheckCircle2> = {
  success: CheckCircle2,
  failed: XCircle,
  retry: RotateCcw,
  circuit_open: PowerOff,
  circuit_half_open: Power,
  circuit_closed: Power,
}

const STATUS_CLASSNAME: Record<ToolEventStatus, string> = {
  success: "border-success text-success",
  failed: "border-destructive text-destructive",
  retry: "border-warning text-warning",
  circuit_open: "border-destructive text-destructive",
  circuit_half_open: "border-warning text-warning",
  circuit_closed: "border-success text-success",
}

interface ToolTimelineProps {
  events: ToolTimelineEvent[]
}

/** Professional activity timeline for a single tool — mirrors ExecutionTimeline's visual
 * language (connector line + circular status badge) with a tool-specific event vocabulary
 * (success/failed/retry plus circuit-breaker state changes). */
export function ToolTimeline({ events }: ToolTimelineProps) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent activity for this tool.</p>
  }

  return (
    <ol className="space-y-0">
      {events.map((event, index) => {
        const Icon = STATUS_ICON[event.status]
        return (
          <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
            {index < events.length - 1 && (
              <span aria-hidden="true" className="absolute top-6 left-[11px] h-full w-px bg-border" />
            )}
            <span
              className={cn(
                "z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-card",
                STATUS_CLASSNAME[event.status],
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{event.label}</p>
                <time className="shrink-0 font-mono text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString([], { hour12: false })}
                </time>
              </div>
              {event.detail && <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
