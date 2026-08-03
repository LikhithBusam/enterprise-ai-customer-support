import { User } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetaRow } from "@/components/meta-row"
import { StatusBadge, type StatusKind } from "@/components/status/status-badge"
import { formatDuration } from "@/lib/format"
import { formatIntentLabel } from "@/lib/intent-labels"
import type { ConversationDetail, ExecutionTrace } from "@/types/mocked"

const RESOLUTION_LABELS: Record<ConversationDetail["status"], string> = {
  resolved: "Resolved automatically",
  escalated: "Escalated to human agent",
  failed: "Failed",
  pending: "Not yet resolved",
  in_progress: "In progress",
}

interface ExecutionOverviewProps {
  conversation: ConversationDetail
  trace: ExecutionTrace
}

/** Left sidebar of Live Agent Execution — ticket/customer identity plus the execution rollup. */
export function ExecutionOverview({ conversation, trace }: ExecutionOverviewProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2.5">
            <Avatar className="size-9">
              <AvatarFallback>
                <User className="size-4" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{conversation.customer_name}</p>
              <p className="truncate text-xs text-muted-foreground">{conversation.customer_id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Execution overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          <MetaRow
            label="Ticket ID"
            value={<span className="font-mono text-xs">{conversation.ticket_id}</span>}
          />
          <MetaRow label="Intent" value={formatIntentLabel(conversation.intent_label)} />
          <MetaRow
            label="Status"
            value={<StatusBadge status={conversation.status as StatusKind} />}
          />
          <MetaRow label="Resolution" value={RESOLUTION_LABELS[conversation.status]} />
          <MetaRow label="Duration" value={formatDuration(trace.metrics.total_duration_ms)} />
          <MetaRow label="Memory hit" value={conversation.memory_hit ? "Yes" : "No"} />
          <MetaRow label="Iterations" value={String(conversation.replanning_count + 1)} />
          <MetaRow label="Total tool calls" value={String(trace.metrics.tool_call_count)} />
          <MetaRow label="Retry count" value={String(trace.metrics.retry_count)} />
        </CardContent>
      </Card>
    </div>
  )
}
