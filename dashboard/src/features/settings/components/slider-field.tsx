import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

interface SliderFieldProps {
  label: string
  description?: string
  value: number
  onValueChange: (value: number) => void
  min: number
  max: number
  step?: number
  disabled?: boolean
  formatValue?: (value: number) => string
  id: string
}

export function SliderField({
  label,
  description,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  disabled,
  formatValue,
  id,
}: SliderFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => onValueChange(next[0] ?? value)}
        disabled={disabled}
        aria-label={label}
      />
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}
