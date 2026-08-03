import type { ReactElement, ReactNode } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toolLabel } from "@/lib/tools"
import { formatNumber } from "@/lib/format"
import type { ToolStats } from "@/types/mocked"

const CHART_COLOR = "var(--color-primary)"
const SUCCESS_COLOR = "var(--color-success)"
const FAILURE_COLOR = "var(--color-destructive)"
const AXIS_COLOR = "var(--color-muted-foreground)"

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name ?? "value"} className="text-muted-foreground">
          {entry.name ? `${entry.name}: ` : ""}
          {formatNumber(entry.value)}
        </p>
      ))}
    </div>
  )
}

function formatShortDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          {children as ReactElement}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

interface ToolChartsProps {
  stats: ToolStats
}

/** Six small Recharts panels for the Tool Health Dashboard. Every chart here is single-series
 * (identity already carried by the axis) except Success vs Failure, which genuinely needs two
 * distinguishable series — that one alone gets a legend and status-semantic colors. */
export function ToolCharts({ stats }: ToolChartsProps) {
  const usageData = stats.usage_frequency.map((entry) => ({
    label: toolLabel(entry.tool_name),
    count: entry.count,
  }))

  const successVsFailure = stats.success_trend.map((point, index) => ({
    date: point.date,
    success: point.count,
    failure: stats.failure_trend[index]?.count ?? 0,
  }))

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <ChartPanel title="Latency trend">
        <LineChart data={stats.latency_trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fontSize: 10, fill: AXIS_COLOR }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis tick={{ fontSize: 10, fill: AXIS_COLOR }} tickLine={false} axisLine={false} width={32} />
          <Tooltip content={<ChartTooltip />} labelFormatter={(value) => formatShortDate(String(value))} />
          <Line
            type="monotone"
            dataKey="avg_latency_ms"
            name="Avg latency (ms)"
            stroke={CHART_COLOR}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartPanel>

      <ChartPanel title="Success vs failure">
        <BarChart data={successVsFailure} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fontSize: 10, fill: AXIS_COLOR }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis tick={{ fontSize: 10, fill: AXIS_COLOR }} tickLine={false} axisLine={false} width={32} />
          <Tooltip content={<ChartTooltip />} labelFormatter={(value) => formatShortDate(String(value))} />
          <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={6} />
          <Bar dataKey="success" name="Success" fill={SUCCESS_COLOR} radius={[4, 4, 0, 0]} maxBarSize={8} />
          <Bar dataKey="failure" name="Failure" fill={FAILURE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={8} />
        </BarChart>
      </ChartPanel>

      <ChartPanel title="Tool usage frequency">
        <BarChart data={usageData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: AXIS_COLOR }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            interval={0}
          />
          <YAxis tick={{ fontSize: 10, fill: AXIS_COLOR }} tickLine={false} axisLine={false} width={32} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
          <Bar dataKey="count" fill={CHART_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ChartPanel>

      <ChartPanel title="Retry trend">
        <LineChart data={stats.retry_trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fontSize: 10, fill: AXIS_COLOR }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis tick={{ fontSize: 10, fill: AXIS_COLOR }} tickLine={false} axisLine={false} width={32} />
          <Tooltip content={<ChartTooltip />} labelFormatter={(value) => formatShortDate(String(value))} />
          <Line type="monotone" dataKey="count" name="Retries" stroke={CHART_COLOR} strokeWidth={2} dot={false} />
        </LineChart>
      </ChartPanel>

      <ChartPanel title="Error distribution">
        <BarChart data={stats.error_distribution} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="failure_type"
            tick={{ fontSize: 10, fill: AXIS_COLOR }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            interval={0}
          />
          <YAxis tick={{ fontSize: 10, fill: AXIS_COLOR }} tickLine={false} axisLine={false} width={32} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
          <Bar dataKey="count" fill={FAILURE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ChartPanel>

      <ChartPanel title="Response time histogram">
        <BarChart data={stats.response_time_histogram} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 9, fill: AXIS_COLOR }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            interval={0}
          />
          <YAxis tick={{ fontSize: 10, fill: AXIS_COLOR }} tickLine={false} axisLine={false} width={32} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
          <Bar dataKey="count" fill={CHART_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ChartPanel>
    </div>
  )
}
