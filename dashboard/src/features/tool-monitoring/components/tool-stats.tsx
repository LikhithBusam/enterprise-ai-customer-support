import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Layers,
  PowerOff,
  RotateCcw,
  Zap,
} from "lucide-react"
import { StatCard } from "@/components/layout/stat-card"
import { formatDuration, formatNumber, formatPercent } from "@/lib/format"
import type { ToolStats as ToolStatsData } from "@/types/mocked"

interface ToolStatsProps {
  stats: ToolStatsData
}

/** Top metric cards for the Tool Health Dashboard. */
export function ToolStats({ stats }: ToolStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
      <StatCard label="Total tools" value={formatNumber(stats.total_tools)} icon={Layers} />
      <StatCard label="Healthy" value={formatNumber(stats.healthy_count)} icon={CheckCircle2} />
      <StatCard label="Degraded" value={formatNumber(stats.degraded_count)} icon={AlertTriangle} />
      <StatCard label="Offline" value={formatNumber(stats.offline_count)} icon={PowerOff} />
      <StatCard label="Avg latency" value={formatDuration(stats.avg_latency_ms)} icon={Gauge} />
      <StatCard label="Success rate" value={formatPercent(stats.success_rate)} icon={Activity} />
      <StatCard label="Retry rate" value={formatPercent(stats.retry_rate)} icon={RotateCcw} />
      <StatCard label="Circuits open" value={formatNumber(stats.circuit_breakers_open)} icon={Zap} />
    </div>
  )
}
