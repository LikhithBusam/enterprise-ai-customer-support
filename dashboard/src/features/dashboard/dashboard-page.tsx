import {
  Activity,
  CheckCircle2,
  Clock,
  Gauge,
  MessagesSquare,
  PlusCircle,
  TrendingUp,
  Wrench,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard } from "@/components/layout/stat-card"
import { StatCardSkeleton, ListRowSkeleton } from "@/components/status/skeletons"
import { ErrorState } from "@/components/status/error-state"
import { EmptyState } from "@/components/status/empty-state"
import { StatusBadge, type StatusKind } from "@/components/status/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDuration, formatNumber, formatPercent, formatRelativeTime } from "@/lib/format"
import { useActivityFeed, useDashboardSummary } from "@/features/dashboard/hooks"
import { Link } from "react-router-dom"

export function DashboardPage() {
  const summaryQuery = useDashboardSummary()
  const activityQuery = useActivityFeed()

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="System health and activity at a glance"
        actions={
          <Button asChild size="sm">
            <Link to="/tickets/new">
              <PlusCircle className="size-4" />
              New ticket
            </Link>
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        {summaryQuery.isError ? (
          <ErrorState onRetry={() => summaryQuery.refetch()} />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summaryQuery.isPending ? (
              Array.from({ length: 8 }).map((_, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <StatCardSkeleton key={index} />
              ))
            ) : (
              <>
                <StatCard label="Tickets today" value={formatNumber(summaryQuery.data.tickets_today)} icon={MessagesSquare} />
                <StatCard label="Open tickets" value={formatNumber(summaryQuery.data.tickets_open)} icon={Clock} />
                <StatCard label="Resolved" value={formatNumber(summaryQuery.data.tickets_resolved)} icon={CheckCircle2} />
                <StatCard
                  label="Success rate"
                  value={formatPercent(summaryQuery.data.success_rate)}
                  icon={TrendingUp}
                  trend={{ direction: "up", value: "2.1%", isPositive: true }}
                />
                <StatCard label="Avg latency" value={formatDuration(summaryQuery.data.avg_latency_ms)} icon={Gauge} />
                <StatCard label="Avg resolution time" value={formatDuration(summaryQuery.data.avg_resolution_time_ms)} icon={Activity} />
                <StatCard
                  label="Escalation rate"
                  value={formatPercent(summaryQuery.data.escalation_rate)}
                  trend={{ direction: "down", value: "0.4%", isPositive: true }}
                />
                <StatCard label="Memory hit rate" value={formatPercent(summaryQuery.data.memory_hit_rate)} />
                <StatCard label="Policy retrieval rate" value={formatPercent(summaryQuery.data.policy_retrieval_rate)} />
                <StatCard label="Tool success rate" value={formatPercent(summaryQuery.data.tool_success_rate)} icon={Wrench} />
                <StatCard label="LLM tokens today" value={formatNumber(summaryQuery.data.llm_tokens_today)} />
                <StatCard
                  label="Agent health"
                  value={summaryQuery.data.agent_health === "healthy" ? "Healthy" : summaryQuery.data.agent_health}
                />
              </>
            )}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Live activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activityQuery.isError ? (
                <div className="px-4 pb-4">
                  <ErrorState onRetry={() => activityQuery.refetch()} />
                </div>
              ) : activityQuery.isPending ? (
                Array.from({ length: 5 }).map((_, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <ListRowSkeleton key={index} />
                ))
              ) : activityQuery.data.length === 0 ? (
                <div className="px-4 pb-4">
                  <EmptyState icon={Activity} title="No recent activity" />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {activityQuery.data.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <StatusBadge status={item.status as StatusKind} />
                      <Link
                        to={`/conversations/${item.ticket_id}`}
                        className="flex-1 truncate text-foreground hover:underline"
                      >
                        {item.message}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/conversations">
                  <MessagesSquare className="size-4" />
                  View conversations
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/tools">
                  <Wrench className="size-4" />
                  Check tool health
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/experiments">
                  <TrendingUp className="size-4" />
                  Compare experiments
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
