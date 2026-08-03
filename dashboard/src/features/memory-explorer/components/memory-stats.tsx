import { Activity, CheckCircle2, FlaskConical, Gauge, Layers, Target } from "lucide-react"
import { StatCard } from "@/components/layout/stat-card"
import { formatNumber, formatPercent } from "@/lib/format"
import type { MemoryStats as MemoryStatsData } from "@/types/mocked"

interface MemoryStatsProps {
  stats: MemoryStatsData
}

/** Memory distribution cards — the top-line rollup above the type nav / table / inspector. */
export function MemoryStats({ stats }: MemoryStatsProps) {
  const policyCount = stats.by_type.find((entry) => entry.memory_type === "policy")?.count ?? 0

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="Total memories" value={formatNumber(stats.total_count)} icon={Layers} />
      <StatCard label="Active" value={formatNumber(stats.active_count)} icon={CheckCircle2} />
      <StatCard label="Retrieval rate" value={formatPercent(stats.retrieved_rate)} icon={Activity} />
      <StatCard label="Avg confidence" value={formatPercent(stats.avg_confidence)} icon={Target} />
      <StatCard
        label="Avg similarity"
        value={stats.avg_similarity !== null ? formatPercent(stats.avg_similarity) : "—"}
        icon={Gauge}
      />
      <StatCard label="Policy memories" value={formatNumber(policyCount)} icon={FlaskConical} />
    </div>
  )
}
