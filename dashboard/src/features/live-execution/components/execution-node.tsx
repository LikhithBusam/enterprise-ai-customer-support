import { memo } from "react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/format"
import type { AgentNodeStatus } from "@/types/mocked"

export interface ExecutionNodeData extends Record<string, unknown> {
  label: string
  status: AgentNodeStatus
  durationMs: number | null
  order: number
}

export type ExecutionFlowNode = Node<ExecutionNodeData, "executionNode">

const STATUS_STYLES: Record<
  AgentNodeStatus,
  { border: string; icon: typeof CheckCircle2; iconClassName: string }
> = {
  done: { border: "border-success/60", icon: CheckCircle2, iconClassName: "text-success" },
  active: { border: "border-info", icon: Loader2, iconClassName: "text-info animate-spin" },
  failed: { border: "border-destructive", icon: XCircle, iconClassName: "text-destructive" },
  pending: {
    border: "border-dashed border-border",
    icon: CircleDashed,
    iconClassName: "text-muted-foreground",
  },
  skipped: {
    border: "border-dashed border-border",
    icon: CircleDashed,
    iconClassName: "text-muted-foreground/60",
  },
}

function ExecutionNodeComponent({ data, selected }: NodeProps<ExecutionFlowNode>) {
  const style = STATUS_STYLES[data.status]
  const Icon = style.icon
  const isDim = data.status === "pending" || data.status === "skipped"

  return (
    <div
      className={cn(
        "flex h-20 w-44 flex-col justify-center rounded-lg border-2 bg-card px-3 py-2.5 shadow-sm transition-shadow",
        style.border,
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        isDim && "opacity-60",
      )}
      data-node-status={data.status}
    >
      <Handle type="target" position={Position.Top} className="!bg-border" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-muted-foreground">#{data.order}</span>
        <Icon className={cn("size-3.5 shrink-0", style.iconClassName)} aria-label={data.status} />
      </div>
      <p className="mt-1 truncate text-sm font-medium text-foreground">{data.label}</p>
      {data.durationMs !== null && (
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {formatDuration(data.durationMs)}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  )
}

export const ExecutionNode = memo(ExecutionNodeComponent)
