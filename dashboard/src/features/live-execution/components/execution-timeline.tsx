import { CheckCircle2, RotateCcw, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/format"
import type { ExecutionTimelineEvent } from "@/types/mocked"

const STATUS_ICON = {
  success: CheckCircle2,
  failed: XCircle,
  retry: RotateCcw,
} as const

const STATUS_CLASSNAME = {
  success: "border-success text-success",
  failed: "border-destructive text-destructive",
  retry: "border-warning text-warning",
} as const

interface ExecutionTimelineProps {
  events: ExecutionTimelineEvent[]
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
}

/** Flat, chronological view of the same execution the graph renders — every row is a real
 * <button> so node selection stays fully keyboard-operable without depending on the graph
 * canvas's own focus model. */
export function ExecutionTimeline({ events, selectedNodeId, onSelectNode }: ExecutionTimelineProps) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No timeline events recorded yet.</p>
  }

  return (
    <ol className="space-y-0">
      {events.map((event, index) => {
        const Icon = STATUS_ICON[event.status]
        const isSelected = event.node_id === selectedNodeId
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
            <button
              type="button"
              onClick={() => onSelectNode(event.node_id)}
              className={cn(
                "min-w-0 flex-1 rounded-md py-0.5 pl-1 text-left transition-colors hover:bg-muted/40",
                isSelected && "bg-muted/60",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{event.label}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <time className="font-mono text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString([], { hour12: false })}
                  </time>
                  {event.duration_ms !== null && (
                    <span className="text-xs text-muted-foreground">{formatDuration(event.duration_ms)}</span>
                  )}
                </div>
              </div>
              {event.detail && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{event.detail}</p>
              )}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
