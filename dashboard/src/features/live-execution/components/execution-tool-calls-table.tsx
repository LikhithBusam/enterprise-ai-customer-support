import { Fragment, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toolLabel } from "@/lib/agent-nodes"
import { formatDuration } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ExecutionToolCallRecord } from "@/types/mocked"

interface ExecutionToolCallsTableProps {
  toolCalls: ExecutionToolCallRecord[]
}

/** Purpose-built rather than the shared DataTable — a small, fixed-size trace table with
 * expandable detail rows is a different shape than DataTable's sortable/filterable/paginated
 * list (same rationale as JsonInspector not reusing Accordion). */
export function ExecutionToolCallsTable({ toolCalls }: ExecutionToolCallsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (toolCalls.length === 0) {
    return <p className="text-sm text-muted-foreground">No tool calls were made for this execution.</p>
  }

  function toggle(id: string): void {
    setExpandedId((current) => (current === id ? null : id))
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Tool</TableHead>
            <TableHead>Arguments</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Retries</TableHead>
            <TableHead>Output summary</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {toolCalls.map((call) => {
            const isExpanded = expandedId === call.id
            return (
              <Fragment key={call.id}>
                <TableRow
                  tabIndex={0}
                  role="button"
                  aria-expanded={isExpanded}
                  className="cursor-pointer outline-none focus-visible:bg-muted/60"
                  onClick={() => toggle(call.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      toggle(call.id)
                    }
                  }}
                >
                  <TableCell>
                    {isExpanded ? (
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{toolLabel(call.tool_name)}</TableCell>
                  <TableCell className="max-w-40 truncate font-mono text-xs text-muted-foreground">
                    {JSON.stringify(call.arguments)}
                  </TableCell>
                  <TableCell>{formatDuration(call.duration_ms)}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-medium",
                        call.status === "success" ? "text-success" : "text-destructive",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          call.status === "success" ? "bg-success" : "bg-destructive",
                        )}
                      />
                      {call.status === "success" ? "Success" : "Failed"}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">{call.retries}</TableCell>
                  <TableCell className="max-w-52 truncate text-muted-foreground">
                    {call.output_summary}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="bg-muted/30">
                      <div className="grid gap-3 py-1 sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-medium text-muted-foreground">Arguments</p>
                          <pre className="overflow-auto rounded-md bg-card p-2 text-xs">
                            {JSON.stringify(call.arguments, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium text-muted-foreground">Output</p>
                          <pre className="overflow-auto rounded-md bg-card p-2 text-xs">
                            {call.output
                              ? JSON.stringify(call.output, null, 2)
                              : call.failure_type
                                ? `Failure type: ${call.failure_type}`
                                : "—"}
                          </pre>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
