import { Clock, Cog, KeyRound, ScrollText, ShieldAlert, UserCheck } from "lucide-react"
import { StatCard } from "@/components/layout/stat-card"
import { formatNumber } from "@/lib/format"
import type { AuditStats as AuditStatsData } from "@/types/mocked"

interface AuditStatsProps {
  stats: AuditStatsData
}

/** Top KPI cards for the Audit Logs dashboard. */
export function AuditStats({ stats }: AuditStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Total events" value={formatNumber(stats.total_events)} icon={ScrollText} />
      <StatCard label="Security events" value={formatNumber(stats.security_events)} icon={ShieldAlert} />
      <StatCard label="Configuration changes" value={formatNumber(stats.configuration_changes)} icon={Cog} />
      <StatCard label="Authentication events" value={formatNumber(stats.authentication_events)} icon={UserCheck} />
      <StatCard label="API key changes" value={formatNumber(stats.api_key_changes)} icon={KeyRound} />
      <StatCard label="Last 24 hours" value={formatNumber(stats.events_last_24h)} icon={Clock} />
    </div>
  )
}
