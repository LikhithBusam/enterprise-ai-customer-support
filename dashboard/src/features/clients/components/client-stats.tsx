import { Activity, Building2, Gauge, HardDrive, Server, Zap } from "lucide-react"
import { StatCard } from "@/components/layout/stat-card"
import { formatDuration, formatNumber } from "@/lib/format"
import type { ClientStats as ClientStatsData } from "@/types/mocked"

interface ClientStatsProps {
  stats: ClientStatsData
}

function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${formatNumber(mb)} MB`
}

/** Top metric cards for the Client Management dashboard. */
export function ClientStats({ stats }: ClientStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Total clients" value={formatNumber(stats.total_clients)} icon={Building2} />
      <StatCard label="Active clients" value={formatNumber(stats.active_clients)} icon={Activity} />
      <StatCard label="Enterprise plans" value={formatNumber(stats.enterprise_clients)} icon={Server} />
      <StatCard label="API requests (24h)" value={formatNumber(stats.api_requests_24h)} icon={Zap} />
      <StatCard label="Memory usage" value={formatMb(stats.memory_usage_mb)} icon={HardDrive} />
      <StatCard label="Avg response time" value={formatDuration(stats.avg_response_time_ms)} icon={Gauge} />
    </div>
  )
}
