import { CheckCircle2, Circle } from "lucide-react"
import { experimentArmColor } from "@/lib/experiment-arms"
import { formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ExperimentArmMeta } from "@/types/mocked"

interface ExperimentCardProps {
  meta: ExperimentArmMeta
  selected: boolean
  onToggle: () => void
  /** Resolution rate at whichever failure rate the page currently has "in focus" — a quick
   * glance number, not the full comparison (that's the chart/table sections below). */
  headlineResolutionRate: number | null
}

/** One selectable card in the Experiment Selector — a toggle button, not a real checkbox input,
 * mirroring Tool Monitoring's ToolHealthCard pattern (single interactive element, no nested
 * focusable controls). The left border repeats this arm's fixed chart color so the selector
 * visually keys to the same identity used in every chart below it. */
export function ExperimentCard({ meta, selected, onToggle, headlineResolutionRate }: ExperimentCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        // Native <button> elements default to `align-items: flex-start` in the UA stylesheet
        // (a well-known form-control quirk) rather than the usual flex initial of `stretch` — so
        // `items-stretch` has to be explicit or the header row below won't stretch to the
        // button's own (grid-track-constrained) width, and truncate/line-clamp silently stop
        // constraining anything.
        "flex w-full min-w-0 flex-col items-stretch gap-2 rounded-lg border-y border-r border-l-4 px-3 py-2.5 text-left transition-colors",
        selected ? "border-y-primary/30 border-r-primary/30 bg-muted ring-1 ring-primary/20" : "border-y-transparent border-r-transparent hover:bg-muted/40",
      )}
      style={{ borderLeftColor: experimentArmColor(meta.arm) }}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{meta.label}</span>
        {selected ? (
          <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <Circle className="size-4 shrink-0 text-muted-foreground/40" aria-hidden="true" />
        )}
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{meta.description}</p>
      {headlineResolutionRate !== null && (
        <p className="text-lg font-semibold tabular-nums text-foreground">{formatPercent(headlineResolutionRate)}</p>
      )}
    </button>
  )
}
