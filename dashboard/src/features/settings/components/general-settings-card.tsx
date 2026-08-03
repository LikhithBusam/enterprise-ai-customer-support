import { Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { SettingsCard } from "@/features/settings/components/settings-card"
import { SettingsSection } from "@/features/settings/components/settings-section"
import { SettingsField } from "@/features/settings/components/settings-field"
import { SelectField } from "@/features/settings/components/select-field"
import { SettingsActions } from "@/features/settings/components/settings-actions"
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form"
import { useUpdateSettingsSection } from "@/features/settings/hooks"
import { generalSettingsSchema, LANGUAGE_OPTIONS, TIME_ZONE_OPTIONS, type GeneralFormValues } from "@/features/settings/schema"
import type { GeneralSettings } from "@/types/mocked"

interface GeneralSettingsCardProps {
  settings: GeneralSettings
}

export function GeneralSettingsCard({ settings }: GeneralSettingsCardProps) {
  const updateMutation = useUpdateSettingsSection()

  async function handleSave(data: GeneralFormValues): Promise<boolean> {
    try {
      await updateMutation.mutateAsync({ section: "general", data })
      toast.success("General settings saved")
      return true
    } catch {
      toast.error("Couldn't save general settings. Please try again.")
      return false
    }
  }

  const { form, isEditing, startEditing, handleCancel, handleReset, onSubmit } = useSettingsSectionForm({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: settings,
    onSave: handleSave,
  })
  const {
    register,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = form

  return (
    <SettingsCard title="General" description="Your organization's identity and locale defaults.">
      <form onSubmit={onSubmit} noValidate>
        <SettingsSection>
          <SettingsField label="Organization Name" htmlFor="organization_name" error={errors.organization_name?.message}>
            <Input
              id="organization_name"
              disabled={!isEditing}
              aria-invalid={Boolean(errors.organization_name)}
              {...register("organization_name")}
            />
          </SettingsField>

          <SettingsField
            label="Organization Slug"
            description="Used in URLs and API references."
            htmlFor="organization_slug"
            error={errors.organization_slug?.message}
          >
            <Input
              id="organization_slug"
              disabled={!isEditing}
              aria-invalid={Boolean(errors.organization_slug)}
              {...register("organization_slug")}
            />
          </SettingsField>

          <Controller
            control={control}
            name="time_zone"
            render={({ field }) => (
              <SelectField
                label="Time Zone"
                id="time_zone"
                value={field.value}
                onValueChange={field.onChange}
                options={TIME_ZONE_OPTIONS}
                disabled={!isEditing}
                error={errors.time_zone?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="default_language"
            render={({ field }) => (
              <SelectField
                label="Default Language"
                id="default_language"
                value={field.value}
                onValueChange={field.onChange}
                options={LANGUAGE_OPTIONS}
                disabled={!isEditing}
                error={errors.default_language?.message}
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
