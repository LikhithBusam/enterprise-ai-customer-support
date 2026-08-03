import type { ReactElement, ReactNode } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MEMORY_TYPE_LABELS } from "@/lib/memory-types"
import { formatNumber } from "@/lib/format"
import type { MemoryStats } from "@/types/mocked"

const CHART_COLOR = "var(--color-primary)"
const AXIS_COLOR = "var(--color-muted-foreground)"

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">{formatNumber(payload[0]!.value)}</p>
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
      <CardContent className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          {children as ReactElement}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

interface MemoryChartsProps {
  stats: MemoryStats
}

/** Four small, single-series Recharts panels — every chart here shares one hue (identity is
 * already carried by the axis labels), so no categorical palette or legend is needed. */
export function MemoryCharts({ stats }: MemoryChartsProps) {
  const typeBreakdownData = stats.by_type.map((entry) => ({
    label: MEMORY_TYPE_LABELS[entry.memory_type].replace(" Memory", ""),
    count: entry.count,
  }))

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ChartPanel title="Memory type breakdown">
        <BarChart data={typeBreakdownData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
          <Bar dataKey="count" fill={CHART_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ChartPanel>

      <ChartPanel title="Usage trend (created/day)">
        <AreaChart data={stats.usage_trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
          <Area
            type="monotone"
            dataKey="count"
            stroke={CHART_COLOR}
            strokeWidth={2}
            fill={CHART_COLOR}
            fillOpacity={0.12}
          />
        </AreaChart>
      </ChartPanel>

      <ChartPanel title="Retrieval frequency">
        <BarChart data={stats.retrieval_frequency} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
          <Bar dataKey="count" fill={CHART_COLOR} radius={[4, 4, 0, 0]} maxBarSize={10} />
        </BarChart>
      </ChartPanel>

      <ChartPanel title="Similarity histogram">
        <BarChart data={stats.similarity_histogram} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="bucket"
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
    </div>
  )
}
