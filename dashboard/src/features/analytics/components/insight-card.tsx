import { AlertTriangle, Info, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { InsightItem, InsightTone } from "@/types/mocked"

const TONE_CONFIG: Record<InsightTone, { icon: LucideIcon; textClassName: string; borderClassName: string }> = {
  positive: { icon: TrendingUp, textClassName: "text-success", borderClassName: "border-l-success" },
  negative: { icon: TrendingDown, textClassName: "text-destructive", borderClassName: "border-l-destructive" },
  warning: { icon: AlertTriangle, textClassName: "text-warning", borderClassName: "border-l-warning" },
  neutral: { icon: Info, textClassName: "text-info", borderClassName: "border-l-info" },
}

interface InsightCardProps {
  item: InsightItem
}

/** A single deterministic, enterprise-style insight callout — computed server-side (mock-side)
 * from the same current-vs-previous-period comparison the KPI cards use, never phrased by an LLM. */
export function InsightCard({ item }: InsightCardProps) {
  const config = TONE_CONFIG[item.tone]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-border border-l-4 bg-card px-3 py-2.5",
        config.borderClassName,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", config.textClassName)} aria-hidden="true" />
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground">{item.title}</p>
        <p className="text-xs text-muted-foreground">{item.description}</p>
      </div>
    </div>
  )
}
