import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AuditStatus, AuditTimelineEvent } from "@/types/mocked"

const STATUS_ICON: Record<AuditStatus, typeof CheckCircle2> = {
  success: CheckCircle2,
  failure: XCircle,
  warning: AlertTriangle,
}

const STATUS_CLASSNAME: Record<AuditStatus, string> = {
  success: "border-success text-success",
  failure: "border-destructive text-destructive",
  warning: "border-warning text-warning",
}

interface AuditTimelineProps {
  events: AuditTimelineEvent[]
}

/** Chronological timeline for a single audit event's request lifecycle — mirrors
 * ToolTimeline/ExecutionTimeline's visual language (connector line + circular status badge) with
 * the audit-log status vocabulary (success/failure/warning). */
export function AuditTimeline({ events }: AuditTimelineProps) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No related events recorded.</p>
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
                <p className="text-sm font-medium text-foreground">{event.action}</p>
                <time className="shrink-0 font-mono text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString([], { hour12: false })}
                </time>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{event.actor}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
