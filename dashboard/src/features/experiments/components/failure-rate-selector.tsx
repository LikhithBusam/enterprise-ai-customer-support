import { Button } from "@/components/ui/button"
import type { ExperimentFailureRate } from "@/types/mocked"

const RATES: ExperimentFailureRate[] = ["0.0", "0.3", "0.7"]
const RATE_LABELS: Record<ExperimentFailureRate, string> = {
  "0.0": "0% (clean)",
  "0.3": "30% (moderate)",
  "0.7": "70% (severe)",
}

interface FailureRateSelectorProps {
  value: ExperimentFailureRate[]
  onChange: (value: ExperimentFailureRate[]) => void
  /** Single-select mode (Ablation Studies' focus rate) vs. multi-select (the page-level filter
   * that scopes the charts and comparison table). */
  multiple?: boolean
  label?: string
}

/** Injected synthetic tool-failure rate the research harness ran each arm at — the app's one
 * "severity" dimension, reused wherever a control needs to pick one or more of the 3 rates. */
export function FailureRateSelector({ value, onChange, multiple = true, label }: FailureRateSelectorProps) {
  function toggle(rate: ExperimentFailureRate): void {
    if (!multiple) {
      onChange([rate])
      return
    }
    if (value.includes(rate)) {
      if (value.length === 1) return
      onChange(value.filter((selected) => selected !== rate))
    } else {
      onChange([...value, rate])
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1"
      role="group"
      aria-label={label ?? "Failure rate"}
    >
      {RATES.map((rate) => (
        <Button
          key={rate}
          type="button"
          variant={value.includes(rate) ? "secondary" : "ghost"}
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => toggle(rate)}
          aria-pressed={value.includes(rate)}
        >
          {RATE_LABELS[rate]}
        </Button>
      ))}
    </div>
  )
}
