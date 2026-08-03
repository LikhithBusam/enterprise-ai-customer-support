import { CheckCircle2, XCircle } from "lucide-react"
import type { ClientFeatureFlag } from "@/types/mocked"

interface FeatureFlagListProps {
  flags: ClientFeatureFlag[]
}

/** Enabled/disabled indicator per feature flag — used by both the Client Detail panel and the
 * Client Inspector's configuration section. */
export function FeatureFlagList({ flags }: FeatureFlagListProps) {
  if (flags.length === 0) {
    return <p className="text-sm text-muted-foreground">No feature flags configured.</p>
  }

  return (
    <ul className="space-y-1.5">
      {flags.map((flag) => (
        <li key={flag.key} className="flex items-center justify-between gap-2 text-sm">
          <span className="text-foreground">{flag.label}</span>
          {flag.enabled ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Enabled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <XCircle className="size-3.5" aria-hidden="true" />
              Disabled
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
