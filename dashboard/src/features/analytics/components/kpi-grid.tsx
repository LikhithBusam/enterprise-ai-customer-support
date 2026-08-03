import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { TrendBadge } from "@/features/analytics/components/trend-badge"

export interface KpiGridItem {
  key: string
  label: string
  value: string
  icon?: LucideIcon
  deltaPct: number | null
  isPositiveWhenUp: boolean
}

interface KpiGridProps {
  items: KpiGridItem[]
}

/** The executive KPI row — bigger numbers and a TrendBadge per tile, distinct from the plain
 * components/layout/stat-card.tsx grid Dashboard uses, since this page is explicitly about
 * period-over-period comparison rather than a point-in-time snapshot. */
export function KpiGrid({ items }: KpiGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.key} size="sm" className="gap-2">
          <CardContent className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              {item.icon && <item.icon className="size-4 shrink-0 text-muted-foreground" />}
            </div>
            <p className="text-2xl font-semibold tracking-tight text-foreground">{item.value}</p>
            <TrendBadge deltaPct={item.deltaPct} isPositiveWhenUp={item.isPositiveWhenUp} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
