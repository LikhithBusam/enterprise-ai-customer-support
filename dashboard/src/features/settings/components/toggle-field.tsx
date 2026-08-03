import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface ToggleFieldProps {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  id: string
}

/** Label+description on the left, Switch right-aligned on the same row — the conventional
 * toggle-row layout (distinct from SettingsField's stacked layout, which suits text/select
 * controls better than a compact switch). */
export function ToggleField({ label, description, checked, onCheckedChange, disabled, id }: ToggleFieldProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} name={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}
