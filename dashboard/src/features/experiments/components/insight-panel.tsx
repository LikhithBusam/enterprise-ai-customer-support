import { Lightbulb } from "lucide-react"
import { EmptyState } from "@/components/status/empty-state"
import { InsightCard } from "@/features/analytics/components/insight-card"
import type { InsightItem } from "@/types/mocked"

interface InsightPanelProps {
  insights: InsightItem[]
}

/** Deterministic research findings for the currently-selected arms/failure rates — reuses
 * Analytics's InsightCard (frozen, approved) for the individual callout, this component is just
 * the titled grid wrapper plus the empty case (every condition in computeExperimentInsights
 * gated to real data, so an empty result here means the current selection genuinely doesn't
 * support any of the available claims, not a bug). */
export function InsightPanel({ insights }: InsightPanelProps) {
  if (insights.length === 0) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="No insights for this selection"
        description="Select more arms or failure rates — some findings only apply to specific comparisons."
      />
    )
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {insights.map((item) => (
        <InsightCard key={item.id} item={item} />
      ))}
    </div>
  )
}
