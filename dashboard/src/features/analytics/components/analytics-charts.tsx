import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AnalyticsChart } from "@/features/analytics/components/analytics-chart"
import { formatNumber } from "@/lib/format"
import type { AnalyticsChartsResponse } from "@/types/mocked"

const PRIMARY_COLOR = "var(--color-primary)"
const SUCCESS_COLOR = "var(--color-success)"
const WARNING_COLOR = "var(--color-warning)"
const FAILURE_COLOR = "var(--color-destructive)"
const INFO_COLOR = "var(--color-info)"
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

/** The 6 intent labels and 5 memory-type labels are too long to sit horizontally under a bar at
 * interval={0} without colliding (learned the hard way — see the categorical charts below).
 * Shortened for axis display only; the panel title already gives the reader context. */
const INTENT_SHORT_LABELS: Record<string, string> = {
  "Refund request": "Refund",
  "Order status": "Order status",
  "Billing dispute": "Billing",
  "Account issue": "Account",
  "Complaint escalation": "Complaint",
  "General inquiry": "General",
}

function shortenIntentLabel(label: string): string {
  return INTENT_SHORT_LABELS[label] ?? label
}

function shortenMemoryLabel(label: string): string {
  return label.replace(/ Memory$/, "")
}

const TREND_MARGIN = { top: 4, right: 4, left: -20, bottom: 0 }
const CATEGORY_MARGIN = { top: 4, right: 4, left: -20, bottom: 0 }
const ROTATED_CATEGORY_MARGIN = { top: 4, right: 4, left: -20, bottom: 8 }

/** Angled ticks for category axes with 5+ longer labels (intent names, memory-type names) —
 * horizontal labels at interval={0} collide once there are more than ~4 categories or any label
 * runs past 8-9 characters, even after shortening them. */
function RotatedCategoryXAxis() {
  return (
    <XAxis
      dataKey="label"
      tick={{ fontSize: 9, fill: AXIS_COLOR }}
      tickLine={false}
      axisLine={{ stroke: "var(--color-border)" }}
      interval={0}
      angle={-35}
      textAnchor="end"
      height={46}
    />
  )
}

function TrendXAxis() {
  return (
    <XAxis
      dataKey="date"
      tickFormatter={formatShortDate}
      tick={{ fontSize: 10, fill: AXIS_COLOR }}
      tickLine={false}
      axisLine={{ stroke: "var(--color-border)" }}
      interval="preserveStartEnd"
      minTickGap={24}
    />
  )
}

function TrendYAxis() {
  return <YAxis tick={{ fontSize: 10, fill: AXIS_COLOR }} tickLine={false} axisLine={false} width={32} />
}

interface AnalyticsChartsProps {
  charts: AnalyticsChartsResponse
}

/** Ten small Recharts panels for the Analytics page. Every chart here is single-series (identity
 * already carried by the axis + panel title), so none needs a legend — the color per panel is
 * chosen semantically: success/destructive/warning for resolution-, failure-, and escalation-
 * flavored metrics, primary/info for neutral volume and memory metrics. */
export function AnalyticsCharts({ charts }: AnalyticsChartsProps) {
  const memoryUsageData = charts.memory_usage.map((point) => ({ ...point, label: shortenMemoryLabel(point.label) }))
  const intentDistributionData = charts.intent_distribution.map((point) => ({
    ...point,
    label: shortenIntentLabel(point.label),
  }))
  const resolutionByIntentData = charts.resolution_success_by_intent.map((point) => ({
    ...point,
    label: shortenIntentLabel(point.label),
  }))

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <AnalyticsChart title="Conversation volume">
        <BarChart data={charts.conversation_volume} margin={TREND_MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <TrendXAxis />
          <TrendYAxis />
          <Tooltip content={<ChartTooltip />} labelFormatter={(value) => formatShortDate(String(value))} />
          <Bar dataKey="value" name="Conversations" fill={PRIMARY_COLOR} radius={[4, 4, 0, 0]} maxBarSize={16} />
        </BarChart>
      </AnalyticsChart>

      <AnalyticsChart title="Resolution trend">
        <LineChart data={charts.resolution_trend} margin={TREND_MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <TrendXAxis />
          <TrendYAxis />
          <Tooltip content={<ChartTooltip />} labelFormatter={(value) => formatShortDate(String(value))} />
          <Line type="monotone" dataKey="value" name="Resolution rate (%)" stroke={SUCCESS_COLOR} strokeWidth={2} dot={false} />
        </LineChart>
      </AnalyticsChart>

      <AnalyticsChart title="Escalation trend">
        <LineChart data={charts.escalation_trend} margin={TREND_MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <TrendXAxis />
          <TrendYAxis />
          <Tooltip content={<ChartTooltip />} labelFormatter={(value) => formatShortDate(String(value))} />
          <Line type="monotone" dataKey="value" name="Escalation rate (%)" stroke={WARNING_COLOR} strokeWidth={2} dot={false} />
        </LineChart>
      </AnalyticsChart>

      <AnalyticsChart title="Latency trend">
        <LineChart data={charts.latency_trend} margin={TREND_MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <TrendXAxis />
          <TrendYAxis />
          <Tooltip content={<ChartTooltip />} labelFormatter={(value) => formatShortDate(String(value))} />
          <Line type="monotone" dataKey="value" name="Avg latency (ms)" stroke={PRIMARY_COLOR} strokeWidth={2} dot={false} />
        </LineChart>
      </AnalyticsChart>

      <AnalyticsChart title="Tool usage">
        <BarChart data={charts.tool_usage} margin={CATEGORY_MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: AXIS_COLOR }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            interval={0}
          />
          <TrendYAxis />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
          <Bar dataKey="value" name="Calls" fill={PRIMARY_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </AnalyticsChart>

      <AnalyticsChart title="Memory usage" heightClassName="h-48">
        <BarChart data={memoryUsageData} margin={ROTATED_CATEGORY_MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <RotatedCategoryXAxis />
          <TrendYAxis />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
          <Bar dataKey="value" name="Retrievals" fill={INFO_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </AnalyticsChart>

      <AnalyticsChart title="Retry trend">
        <LineChart data={charts.retry_trend} margin={TREND_MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <TrendXAxis />
          <TrendYAxis />
          <Tooltip content={<ChartTooltip />} labelFormatter={(value) => formatShortDate(String(value))} />
          <Line type="monotone" dataKey="value" name="Avg replans" stroke={PRIMARY_COLOR} strokeWidth={2} dot={false} />
        </LineChart>
      </AnalyticsChart>

      <AnalyticsChart title="Intent distribution" heightClassName="h-48">
        <BarChart data={intentDistributionData} margin={ROTATED_CATEGORY_MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <RotatedCategoryXAxis />
          <TrendYAxis />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
          <Bar dataKey="value" name="Conversations" fill={PRIMARY_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </AnalyticsChart>

      <AnalyticsChart title="Tool failure distribution">
        <BarChart data={charts.tool_failure_distribution} margin={CATEGORY_MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: AXIS_COLOR }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            interval={0}
          />
          <TrendYAxis />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
          <Bar dataKey="value" name="Failures" fill={FAILURE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </AnalyticsChart>

      <AnalyticsChart title="Resolution success by intent" heightClassName="h-48">
        <BarChart data={resolutionByIntentData} margin={ROTATED_CATEGORY_MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <RotatedCategoryXAxis />
          <TrendYAxis />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
          <Bar dataKey="value" name="Resolution rate (%)" fill={SUCCESS_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </AnalyticsChart>
    </div>
  )
}
