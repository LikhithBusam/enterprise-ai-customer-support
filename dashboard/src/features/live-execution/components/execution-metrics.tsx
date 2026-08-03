import { Clock, DollarSign, Hash, RotateCcw, Wrench, Zap } from "lucide-react"
import { StatCard } from "@/components/layout/stat-card"
import { formatDuration, formatNumber } from "@/lib/format"
import type { ExecutionMetrics as ExecutionMetricsData } from "@/types/mocked"

interface ExecutionMetricsProps {
  metrics: ExecutionMetricsData
}

/** MetricCards row above the graph — rollup stats for the whole execution, reusing the shared
 * StatCard primitive already established on the Dashboard. */
export function ExecutionMetrics({ metrics }: ExecutionMetricsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="Total duration" value={formatDuration(metrics.total_duration_ms)} icon={Clock} />
      <StatCard label="Tool calls" value={formatNumber(metrics.tool_call_count)} icon={Wrench} />
      <StatCard label="Retries" value={formatNumber(metrics.retry_count)} icon={RotateCcw} />
      <StatCard label="Memory retrieval" value={formatNumber(metrics.memory_retrieval_count)} icon={Hash} />
      <StatCard label="Tokens" value={formatNumber(metrics.tokens_used)} icon={Zap} />
      <StatCard
        label="Estimated cost"
        value={`$${metrics.estimated_cost_usd.toFixed(4)}`}
        icon={DollarSign}
      />
    </div>
  )
}
