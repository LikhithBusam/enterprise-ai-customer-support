import { Input } from "@/components/ui/input"
import { SettingsField } from "@/features/settings/components/settings-field"

interface NumberFieldProps {
  label: string
  description?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  error?: string
  id: string
  suffix?: string
}

export function NumberField({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  error,
  id,
  suffix,
}: NumberFieldProps) {
  return (
    <SettingsField label={label} description={description} error={error} htmlFor={id}>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          name={id}
          type="number"
          value={Number.isNaN(value) ? "" : value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.valueAsNumber)}
          className="w-32"
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </SettingsField>
  )
}
