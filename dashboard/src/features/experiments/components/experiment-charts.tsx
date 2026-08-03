import type { Ref } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AnalyticsChart } from "@/features/analytics/components/analytics-chart"
import { EXPERIMENT_FAILURE_RATE_ORDER, experimentArmColor, experimentArmLabel } from "@/lib/experiment-arms"
import { formatDuration, formatNumber } from "@/lib/format"
import type {
  ExperimentArm,
  ExperimentChartsResponse,
  ExperimentCiPoint,
  ExperimentFailureRate,
  ExperimentSeriesPoint,
} from "@/types/mocked"

const AXIS_COLOR = "var(--color-muted-foreground)"

const FAILURE_RATE_TICK_LABELS: Record<ExperimentFailureRate, string> = {
  "0.0": "0%",
  "0.3": "30%",
  "0.7": "70%",
}

function formatFailureRateTick(value: string): string {
  return FAILURE_RATE_TICK_LABELS[value as ExperimentFailureRate] ?? value
}

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = formatNumber,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value: number; color?: string }>
  label?: string
  valueFormatter?: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-foreground">{formatFailureRateTick(label ?? "")} failure rate</p>
      {payload.map((entry) => (
        <p key={entry.name ?? "value"} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
          {entry.name ? `${entry.name}: ` : ""}
          {valueFormatter(entry.value)}
        </p>
      ))}
    </div>
  )
}

function formatPercentValue(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatDecimal(value: number): string {
  return value.toFixed(2)
}

function armsInSeries(points: ExperimentSeriesPoint[], order: ExperimentArm[]): ExperimentArm[] {
  const present = new Set(points.map((point) => point.arm))
  return order.filter((arm) => present.has(arm))
}

function pivotByFailureRate(points: ExperimentSeriesPoint[]): Array<{ failure_rate: string; [arm: string]: unknown }> {
  const present = EXPERIMENT_FAILURE_RATE_ORDER.filter((rate) => points.some((point) => point.failure_rate === rate))
  return present.map((rate) => {
    const row: { failure_rate: string; [arm: string]: unknown } = { failure_rate: rate }
    for (const point of points.filter((p) => p.failure_rate === rate)) {
      row[point.arm] = point.value
    }
    return row
  })
}

function pivotCi(points: ExperimentCiPoint[]): Array<{ failure_rate: string; [key: string]: unknown }> {
  const present = EXPERIMENT_FAILURE_RATE_ORDER.filter((rate) => points.some((point) => point.failure_rate === rate))
  return present.map((rate) => {
    const row: { failure_rate: string; [key: string]: unknown } = { failure_rate: rate }
    for (const point of points.filter((p) => p.failure_rate === rate)) {
      row[point.arm] = point.value
      row[`${point.arm}__err`] = [point.value - point.ci_low, point.ci_high - point.value]
    }
    return row
  })
}

const MARGIN = { top: 4, right: 4, left: -20, bottom: 0 }

function FailureRateXAxis() {
  return (
    <XAxis
      dataKey="failure_rate"
      tickFormatter={formatFailureRateTick}
      tick={{ fontSize: 10, fill: AXIS_COLOR }}
      tickLine={false}
      axisLine={{ stroke: "var(--color-border)" }}
    />
  )
}

function ValueYAxis({ tickFormatter }: { tickFormatter?: (value: number) => string }) {
  return (
    <YAxis
      tick={{ fontSize: 10, fill: AXIS_COLOR }}
      tickLine={false}
      axisLine={false}
      width={32}
      tickFormatter={tickFormatter}
    />
  )
}

interface GroupedBarChartProps {
  points: ExperimentSeriesPoint[]
  armOrder: ExperimentArm[]
  valueFormatter: (value: number) => string
  yTickFormatter?: (value: number) => string
}

/** The shape every "N arms x 3 failure rates" comparison chart shares — one Bar per arm present
 * in the data, grouped by failure rate. Arms without that metric (e.g. Memoryless has no
 * memory_hit_rate) simply contribute no bar for that group rather than a zero. */
function GroupedBarChart({ points, armOrder, valueFormatter, yTickFormatter }: GroupedBarChartProps) {
  const arms = armsInSeries(points, armOrder)
  const data = pivotByFailureRate(points)
  const showLegend = arms.length >= 2

  return (
    <BarChart data={data} margin={MARGIN}>
      <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
      <FailureRateXAxis />
      <ValueYAxis tickFormatter={yTickFormatter} />
      <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} cursor={{ fill: "var(--color-muted)" }} />
      {showLegend && <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={6} />}
      {arms.map((arm) => (
        <Bar
          key={arm}
          dataKey={arm}
          name={experimentArmLabel(arm)}
          fill={experimentArmColor(arm)}
          radius={[3, 3, 0, 0]}
          maxBarSize={28}
        />
      ))}
    </BarChart>
  )
}

interface ExperimentChartsProps {
  charts: ExperimentChartsResponse
  armOrder: ExperimentArm[]
  /** Attached to the Resolution Rate Comparison panel only — the chart ExportActions' "PNG
   * chart" button captures, since exporting all 9 panels as one image isn't a coherent artifact. */
  firstChartRef?: Ref<HTMLDivElement>
}

/**
 * Nine Recharts panels comparing the selected arms across the selected failure rates. Reuses
 * Analytics's AnalyticsChart panel wrapper (frozen, approved) for consistent chrome.
 *
 * Palette note: the 5 arm colors are the app's existing --color-chart-{1..5} ramp, which
 * `dataviz`'s validate_palette.js flags as a weak 5-way categorical set in dark mode (two pairs
 * fall under the CVD-safe threshold — see lib/experiment-arms.ts's doc comment for the exact
 * numbers and the color-order mitigation applied). Since this is the app's one existing
 * categorical ramp and redesigning it is out of scope for this feature, every multi-series chart
 * here always ships a legend (never color-alone identity) and the Result Table below duplicates
 * every number in text form — the skill's prescribed fallback when a palette can't be fixed.
 */
export function ExperimentCharts({ charts, armOrder, firstChartRef }: ExperimentChartsProps) {
  const ciArms = armsInSeries(charts.confidence_interval, armOrder)
  const ciData = pivotCi(charts.confidence_interval)

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <div ref={firstChartRef}>
        <AnalyticsChart title="Resolution rate comparison">
          <GroupedBarChart points={charts.resolution_rate} armOrder={armOrder} valueFormatter={formatPercentValue} yTickFormatter={(v) => `${Math.round(v * 100)}%`} />
        </AnalyticsChart>
      </div>

      <AnalyticsChart title="Latency comparison">
        <GroupedBarChart points={charts.latency} armOrder={armOrder} valueFormatter={formatDuration} />
      </AnalyticsChart>

      <AnalyticsChart title="Memory hit comparison">
        <GroupedBarChart points={charts.memory_hit} armOrder={armOrder} valueFormatter={formatPercentValue} yTickFormatter={(v) => `${Math.round(v * 100)}%`} />
      </AnalyticsChart>

      <AnalyticsChart title="Tool call comparison">
        <GroupedBarChart points={charts.tool_calls} armOrder={armOrder} valueFormatter={formatDecimal} />
      </AnalyticsChart>

      <AnalyticsChart title="Retry comparison">
        <GroupedBarChart points={charts.retries} armOrder={armOrder} valueFormatter={formatDecimal} />
      </AnalyticsChart>

      <AnalyticsChart title="Policy retrieval rate">
        <GroupedBarChart points={charts.policy_retrieval} armOrder={armOrder} valueFormatter={formatPercentValue} yTickFormatter={(v) => `${Math.round(v * 100)}%`} />
      </AnalyticsChart>

      <AnalyticsChart title="Retrieval distance">
        <GroupedBarChart points={charts.retrieval_distance} armOrder={armOrder} valueFormatter={formatDecimal} />
      </AnalyticsChart>

      <AnalyticsChart title="Confidence interval (95% Wilson, resolution rate)">
        <BarChart data={ciData} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <FailureRateXAxis />
          <ValueYAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} />
          <Tooltip content={<ChartTooltip valueFormatter={formatPercentValue} />} cursor={{ fill: "var(--color-muted)" }} />
          {ciArms.length >= 2 && <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={6} />}
          {ciArms.map((arm) => (
            <Bar key={arm} dataKey={arm} name={experimentArmLabel(arm)} fill={experimentArmColor(arm)} radius={[3, 3, 0, 0]} maxBarSize={28}>
              <ErrorBar dataKey={`${arm}__err`} width={4} strokeWidth={1.5} stroke={experimentArmColor(arm)} />
            </Bar>
          ))}
        </BarChart>
      </AnalyticsChart>

      <AnalyticsChart title="Performance by failure rate">
        <LineChart data={pivotByFailureRate(charts.resolution_rate)} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <FailureRateXAxis />
          <ValueYAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} />
          <Tooltip content={<ChartTooltip valueFormatter={formatPercentValue} />} />
          {armsInSeries(charts.resolution_rate, armOrder).length >= 2 && (
            <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={6} />
          )}
          {armsInSeries(charts.resolution_rate, armOrder).map((arm) => (
            <Line
              key={arm}
              type="monotone"
              dataKey={arm}
              name={experimentArmLabel(arm)}
              stroke={experimentArmColor(arm)}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </AnalyticsChart>
    </div>
  )
}
