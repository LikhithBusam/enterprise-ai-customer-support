import type { ReactNode } from "react"
import { Label } from "@/components/ui/label"

interface SettingsFieldProps {
  label: string
  description?: string
  htmlFor?: string
  error?: string
  children: ReactNode
}

/** Label-left / control-right row — the base layout every text/select/number field in Settings
 * builds on (ToggleField and SliderField use their own, more compact layout instead). */
export function SettingsField({ label, description, htmlFor, error, children }: SettingsFieldProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-start sm:gap-4">
      <div>
        <Label htmlFor={htmlFor}>{label}</Label>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-1.5">
        {children}
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
