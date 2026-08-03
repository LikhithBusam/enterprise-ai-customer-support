import type { ReactElement, ReactNode } from "react"
import { ResponsiveContainer } from "recharts"
import { AnalyticsCard } from "@/features/analytics/components/analytics-card"

interface AnalyticsChartProps {
  title: string
  children: ReactNode
  /** Taller charts (angled category ticks with long labels) need more room than the h-40
   * default — see the intent/memory-type panels in analytics-charts.tsx. */
  heightClassName?: string
}

/** Thin Recharts wrapper — title + ResponsiveContainer inside the shared AnalyticsCard panel, so
 * every chart on this page (and later Experiment Dashboard) gets the same card chrome, height,
 * and title treatment without repeating it per chart. */
export function AnalyticsChart({ title, children, heightClassName = "h-40" }: AnalyticsChartProps) {
  return (
    <AnalyticsCard title={title} contentClassName={heightClassName}>
      <ResponsiveContainer width="100%" height="100%">
        {children as ReactElement}
      </ResponsiveContainer>
    </AnalyticsCard>
  )
}
