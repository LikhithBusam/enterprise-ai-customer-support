import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/status/empty-state"
import { ErrorState } from "@/components/status/error-state"
import {
  GraphSkeleton,
  NodeInspectorSkeleton,
  StatCardSkeleton,
  TimelineSkeleton,
} from "@/components/status/skeletons"
import { useConversation } from "@/features/conversations/hooks"
import { ExecutionOverview } from "@/features/live-execution/components/execution-overview"
import { ExecutionGraph } from "@/features/live-execution/components/execution-graph"
import { ExecutionMetrics } from "@/features/live-execution/components/execution-metrics"
import { ExecutionTimeline } from "@/features/live-execution/components/execution-timeline"
import { ExecutionToolCallsTable } from "@/features/live-execution/components/execution-tool-calls-table"
import { NodeInspector } from "@/features/live-execution/components/node-inspector"
import {
  useExecutionTimeline,
  useExecutionToolCalls,
  useExecutionTrace,
} from "@/features/live-execution/hooks"
import { formatIntentLabel } from "@/lib/intent-labels"

export function LiveExecutionPage() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const navigate = useNavigate()
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const conversationQuery = useConversation(ticketId)
  const traceQuery = useExecutionTrace(ticketId)
  const timelineQuery = useExecutionTimeline(ticketId)
  const toolCallsQuery = useExecutionToolCalls(ticketId)

  const isLoading =
    conversationQuery.isPending ||
    traceQuery.isPending ||
    timelineQuery.isPending ||
    toolCallsQuery.isPending
  const isError = conversationQuery.isError || traceQuery.isError

  function retryAll(): void {
    void conversationQuery.refetch()
    void traceQuery.refetch()
    void timelineQuery.refetch()
    void toolCallsQuery.refetch()
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title={ticketId ?? "Live Agent Execution"} />
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <StatCardSkeleton key={index} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[280px_1fr_320px]">
            <div className="space-y-4">
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
            <div className="space-y-4">
              <GraphSkeleton />
              <Card>
                <CardContent className="pt-4">
                  <TimelineSkeleton />
                </CardContent>
              </Card>
            </div>
            <NodeInspectorSkeleton />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !conversationQuery.data || !traceQuery.data) {
    return (
      <div>
        <PageHeader title="Execution not found" />
        <div className="p-6">
          <ErrorState
            title="Couldn't load this execution"
            description="It may not exist, or something went wrong loading it."
            onRetry={retryAll}
          />
        </div>
      </div>
    )
  }

  const conversation = conversationQuery.data
  const trace = traceQuery.data
  const timeline = timelineQuery.data ?? []
  const toolCalls = toolCallsQuery.data ?? []

  if (trace.nodes.length === 0) {
    return (
      <div>
        <PageHeader title={conversation.ticket_id} description={formatIntentLabel(conversation.intent_label)} />
        <div className="p-6">
          <EmptyState
            icon={Workflow}
            title="No execution trace exists for this ticket"
            description="This ticket hasn't been run through the agent pipeline yet."
          />
        </div>
      </div>
    )
  }

  const selectedNode = trace.nodes.find((node) => node.node_id === selectedNodeId) ?? null

  return (
    <div>
      <PageHeader
        title={conversation.ticket_id}
        description={formatIntentLabel(conversation.intent_label)}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <ExecutionMetrics metrics={trace.metrics} />

        <div className="grid min-w-0 gap-4 lg:grid-cols-[280px_1fr_320px] lg:items-start">
          <div className="min-w-0 lg:sticky lg:top-6">
            <ExecutionOverview conversation={conversation} trace={trace} />
          </div>

          <div className="min-w-0 space-y-4">
            <ExecutionGraph
              nodes={trace.nodes}
              currentNode={trace.current_node}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Execution timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ExecutionTimeline
                  events={timeline}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Tool calls</CardTitle>
              </CardHeader>
              <CardContent>
                <ExecutionToolCallsTable toolCalls={toolCalls} />
              </CardContent>
            </Card>
          </div>

          <div className="min-w-0 lg:sticky lg:top-6">
            <NodeInspector node={selectedNode} />
          </div>
        </div>
      </div>
    </div>
  )
}
