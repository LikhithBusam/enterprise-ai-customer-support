import { CheckCircle2, MousePointerClick, XCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/status/empty-state"
import { JsonInspector } from "@/components/json-inspector"
import { MetaRow } from "@/components/meta-row"
import { NodeStatusBadge } from "@/features/live-execution/components/node-status-badge"
import { NODE_LABELS, toolLabel } from "@/lib/agent-nodes"
import { formatDuration, formatPercent, formatRelativeTime } from "@/lib/format"
import type { AgentNodeExecution } from "@/types/mocked"

interface NodeInspectorProps {
  node: AgentNodeExecution | null
}

/** Right panel of Live Agent Execution — full detail for whichever node is currently selected,
 * in the graph or in the timeline below it. */
export function NodeInspector({ node }: NodeInspectorProps) {
  if (!node) {
    return (
      <Card>
        <CardContent className="pt-4">
          <EmptyState
            icon={MousePointerClick}
            title="No node selected"
            description="Select a node in the graph or timeline to inspect its execution details."
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium">{NODE_LABELS[node.node_id]}</CardTitle>
            <NodeStatusBadge status={node.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          <MetaRow
            label="Execution time"
            value={node.started_at ? formatRelativeTime(node.started_at) : "—"}
          />
          <MetaRow label="Duration" value={node.duration_ms !== null ? formatDuration(node.duration_ms) : "—"} />
          <MetaRow label="Confidence" value={node.confidence !== null ? formatPercent(node.confidence) : "—"} />
          <MetaRow label="Retry count" value={String(node.retry_count)} />
        </CardContent>
      </Card>

      {node.status === "failed" && (
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>Node failed</AlertTitle>
          <AlertDescription>{node.output_summary ?? "This step did not complete successfully."}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Input</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{node.input_summary ?? "No input recorded."}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Output</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">{node.output_summary ?? "No output recorded."}</p>
        </CardContent>
      </Card>

      {node.reasoning_summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Reasoning</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic">{node.reasoning_summary}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Retrieved memories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {node.retrieved_memories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No memories retrieved for this step.</p>
          ) : (
            node.retrieved_memories.map((memory, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={index} className="rounded-md border border-border px-2.5 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{memory.type}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatPercent(memory.similarity)} similar
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{memory.summary}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Tool calls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {node.tool_calls.length === 0 ? (
            <p className="text-sm text-muted-foreground">This step made no tool calls.</p>
          ) : (
            node.tool_calls.map((call, index) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  {call.success ? (
                    <CheckCircle2 className="size-3.5 text-success" aria-label="Succeeded" />
                  ) : (
                    <XCircle className="size-3.5 text-destructive" aria-label="Failed" />
                  )}
                  <span className="font-mono text-xs">{toolLabel(call.tool_name)}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatDuration(call.duration_ms)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <JsonInspector title="Raw JSON" data={node} />
    </div>
  )
}
