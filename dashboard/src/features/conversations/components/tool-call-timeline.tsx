import { CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/format"
import type { ConversationDetail } from "@/types/mocked"

interface ToolCallTimelineProps {
  toolCalls: ConversationDetail["tool_calls_made"]
}

export function ToolCallTimeline({ toolCalls }: ToolCallTimelineProps) {
  if (toolCalls.length === 0) {
    return <p className="text-sm text-muted-foreground">No tool calls were made for this ticket.</p>
  }

  return (
    <ol className="space-y-0">
      {toolCalls.map((call, index) => (
        <li key={`${call.tool_name}-${index}`} className="relative flex gap-3 pb-6 last:pb-0">
          {index < toolCalls.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute top-6 left-[11px] h-full w-px bg-border"
            />
          )}
          <span
            className={cn(
              "z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-card",
              call.success ? "border-success text-success" : "border-destructive text-destructive",
            )}
          >
            {call.success ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-sm font-medium">{call.tool_name}</p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDuration(call.duration_ms)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {call.success
                ? "Completed successfully"
                : `Failed${call.failure_type ? ` — ${call.failure_type}` : ""}`}
            </p>
            {Object.keys(call.params).length > 0 && (
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground/80">
                {JSON.stringify(call.params)}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
