import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SettingsField } from "@/features/settings/components/settings-field"

interface SelectFieldOption {
  value: string
  label: string
}

interface SelectFieldProps {
  label: string
  description?: string
  value: string
  onValueChange: (value: string) => void
  options: SelectFieldOption[]
  disabled?: boolean
  error?: string
  id: string
}

export function SelectField({ label, description, value, onValueChange, options, disabled, error, id }: SelectFieldProps) {
  return (
    <SettingsField label={label} description={description} error={error} htmlFor={id}>
      <Select name={id} value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full sm:w-72" aria-invalid={Boolean(error)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingsField>
  )
}
