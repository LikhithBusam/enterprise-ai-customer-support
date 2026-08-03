import { Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { SettingsCard } from "@/features/settings/components/settings-card"
import { SettingsSection } from "@/features/settings/components/settings-section"
import { SelectField } from "@/features/settings/components/select-field"
import { SettingsActions } from "@/features/settings/components/settings-actions"
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form"
import { useUpdateSettingsSection } from "@/features/settings/hooks"
import {
  appearanceSettingsSchema,
  DATE_FORMAT_OPTIONS,
  NUMBER_FORMAT_OPTIONS,
  type AppearanceFormValues,
} from "@/features/settings/schema"
import type { AppearanceSettings } from "@/types/mocked"

interface AppearanceSettingsCardProps {
  settings: AppearanceSettings
}

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
]

const DENSITY_OPTIONS = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
]

export function AppearanceSettingsCard({ settings }: AppearanceSettingsCardProps) {
  const updateMutation = useUpdateSettingsSection()

  async function handleSave(data: AppearanceFormValues): Promise<boolean> {
    try {
      await updateMutation.mutateAsync({ section: "appearance", data })
      toast.success("Appearance settings saved")
      return true
    } catch {
      toast.error("Couldn't save appearance settings. Please try again.")
      return false
    }
  }

  const { form, isEditing, startEditing, handleCancel, handleReset, onSubmit } = useSettingsSectionForm({
    resolver: zodResolver(appearanceSettingsSchema),
    defaultValues: settings,
    onSave: handleSave,
  })
  const {
    control,
    formState: { errors, isDirty, isSubmitting },
  } = form

  return (
    <SettingsCard title="Appearance" description="Display preferences for this workspace.">
      <form onSubmit={onSubmit} noValidate>
        <SettingsSection>
          <Controller
            control={control}
            name="theme"
            render={({ field }) => (
              <SelectField
                label="Theme"
                id="theme"
                value={field.value}
                onValueChange={field.onChange}
                options={THEME_OPTIONS}
                disabled={!isEditing}
                error={errors.theme?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="density"
            render={({ field }) => (
              <SelectField
                label="Density"
                description="Compact reduces spacing in tables and lists."
                id="density"
                value={field.value}
                onValueChange={field.onChange}
                options={DENSITY_OPTIONS}
                disabled={!isEditing}
                error={errors.density?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="date_format"
            render={({ field }) => (
              <SelectField
                label="Date Format"
                id="date_format"
                value={field.value}
                onValueChange={field.onChange}
                options={DATE_FORMAT_OPTIONS}
                disabled={!isEditing}
                error={errors.date_format?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="number_format"
            render={({ field }) => (
              <SelectField
                label="Number Format"
                id="number_format"
                value={field.value}
                onValueChange={field.onChange}
                options={NUMBER_FORMAT_OPTIONS}
                disabled={!isEditing}
                error={errors.number_format?.message}
              />
            )}
          />
        </SettingsSection>

        <div className="mt-4">
          <SettingsActions
            isEditing={isEditing}
            isDirty={isDirty}
            isSubmitting={isSubmitting}
            onEdit={startEditing}
            onCancel={handleCancel}
            onReset={handleReset}
          />
        </div>
      </form>
    </SettingsCard>
  )
}
