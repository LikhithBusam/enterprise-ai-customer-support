import { useParams, useNavigate, Link } from "react-router-dom"
import { ArrowLeft, Radio, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge, type StatusKind } from "@/components/status/status-badge"
import { ErrorState } from "@/components/status/error-state"
import { EmptyState } from "@/components/status/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDuration, formatPercent, formatRelativeTime } from "@/lib/format"
import { useConversation } from "@/features/conversations/hooks"
import { ToolCallTimeline } from "@/features/conversations/components/tool-call-timeline"
import { JsonInspector } from "@/components/json-inspector"
import { MetaRow } from "@/components/meta-row"
import { formatIntentLabel } from "@/lib/intent-labels"

export function ConversationDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const navigate = useNavigate()
  const query = useConversation(ticketId)

  if (query.isPending) {
    return (
      <div>
        <PageHeader title={ticketId ?? "Conversation"} />
        <div className="grid gap-4 p-6 lg:grid-cols-[280px_1fr_280px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div>
        <PageHeader title="Conversation not found" />
        <div className="p-6">
          <ErrorState
            title="Couldn't load this conversation"
            description="It may not exist, or something went wrong loading it."
            onRetry={() => query.refetch()}
          />
        </div>
      </div>
    )
  }

  const conversation = query.data

  return (
    <div>
      <PageHeader
        title={conversation.ticket_id}
        description={formatIntentLabel(conversation.intent_label)}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button size="sm" asChild>
              <Link to={`/conversations/${conversation.ticket_id}/live`}>
                <Radio className="size-4" />
                Live execution
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid min-w-0 gap-4 p-6 lg:grid-cols-[280px_1fr_300px] lg:items-start">
        {/* LEFT: customer info, ticket metadata, conversation history */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
              <CardTitle className="text-sm font-medium">Ticket metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <MetaRow label="Status" value={<StatusBadge status={conversation.status as StatusKind} />} />
              <MetaRow label="Created" value={formatRelativeTime(conversation.created_at)} />
              <MetaRow
                label="Resolved"
                value={conversation.resolved_at ? formatRelativeTime(conversation.resolved_at) : "—"}
              />
              <MetaRow label="Iterations" value={String(conversation.replanning_count + 1)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Conversation history</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{conversation.customer_message}</p>
            </CardContent>
          </Card>
        </div>

        {/* CENTER: execution summary, tool call timeline, resolution summary */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Agent execution summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{conversation.response_message}</p>
              {conversation.escalation_summary && (
                <>
                  <Separator className="my-3" />
                  <p className="text-sm text-warning">{conversation.escalation_summary}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Tool call timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ToolCallTimeline toolCalls={conversation.tool_calls_made} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Resolution summary</CardTitle>
            </CardHeader>
            <CardContent>
              {conversation.status === "resolved" ? (
                <p className="text-sm text-success">
                  Ticket resolved after {conversation.replanning_count + 1} iteration
                  {conversation.replanning_count > 0 ? "s" : ""}.
                </p>
              ) : conversation.status === "escalated" ? (
                <p className="text-sm text-warning">Escalated to a human agent.</p>
              ) : (
                <EmptyState icon={Radio} title="Not yet resolved" description="This ticket is still in progress." />
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: metadata, memory information, execution statistics, JSON inspector */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Execution statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <MetaRow label="Latency" value={formatDuration(conversation.latency_ms)} />
              <MetaRow label="Tool calls" value={String(conversation.tool_calls_made.length)} />
              <MetaRow
                label="Success rate"
                value={formatPercent(
                  conversation.tool_calls_made.filter((c) => c.success).length /
                    Math.max(conversation.tool_calls_made.length, 1),
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Memory information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <MetaRow
                label="Memory hit"
                value={conversation.memory_hit ? "Yes" : "No"}
              />
              <p className="text-xs text-muted-foreground">
                {conversation.memory_hit
                  ? "A relevant memory entry was retrieved and used during planning."
                  : "No relevant memory was found for this ticket."}
              </p>
            </CardContent>
          </Card>

          <JsonInspector title="Raw JSON" data={conversation} />
        </div>
      </div>
    </div>
  )
}
