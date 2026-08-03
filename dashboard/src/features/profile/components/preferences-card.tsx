import { Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { SettingsCard } from "@/features/settings/components/settings-card"
import { SettingsSection } from "@/features/settings/components/settings-section"
import { SelectField } from "@/features/settings/components/select-field"
import { SettingsActions } from "@/features/settings/components/settings-actions"
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form"
import { TIME_ZONE_OPTIONS, LANGUAGE_OPTIONS } from "@/features/settings/schema"
import { useUpdateProfile } from "@/features/profile/hooks"
import { preferencesSchema, type PreferencesFormValues } from "@/features/profile/schema"
import { KeyboardShortcutsDialog } from "@/features/profile/components/keyboard-shortcuts-dialog"
import type { ProfilePreferences } from "@/types/mocked"

interface PreferencesCardProps {
  preferences: ProfilePreferences
}

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
]

/** Theme is the one field here backed by a real capability (next-themes, already wired app-wide
 * via the Topbar's quick toggle) — saving here actually applies it, rather than persisting an
 * inert preference. Language/Timezone are stored the same way Settings' Appearance section stores
 * date/number format: saved, displayed, not wired to a live formatter anywhere in this build. */
export function PreferencesCard({ preferences }: PreferencesCardProps) {
  const updateMutation = useUpdateProfile()
  const { setTheme } = useTheme()

  async function handleSave(data: PreferencesFormValues): Promise<boolean> {
    try {
      await updateMutation.mutateAsync({ section: "preferences", data })
      setTheme(data.theme)
      toast.success("Preferences saved")
      return true
    } catch {
      toast.error("Couldn't save your preferences. Please try again.")
      return false
    }
  }

  const { form, isEditing, startEditing, handleCancel, handleReset, onSubmit } = useSettingsSectionForm({
    resolver: zodResolver(preferencesSchema),
    defaultValues: preferences,
    onSave: handleSave,
  })
  const {
    control,
    formState: { errors, isDirty, isSubmitting },
  } = form

  return (
    <SettingsCard title="Preferences" description="Personal appearance and locale defaults.">
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
            name="language"
            render={({ field }) => (
              <SelectField
                label="Language"
                id="language"
                value={field.value}
                onValueChange={field.onChange}
                options={LANGUAGE_OPTIONS}
                disabled={!isEditing}
                error={errors.language?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="timezone"
            render={({ field }) => (
              <SelectField
                label="Time Zone"
                id="timezone"
                value={field.value}
                onValueChange={field.onChange}
                options={TIME_ZONE_OPTIONS}
                disabled={!isEditing}
                error={errors.timezone?.message}
              />
            )}
          />
        </SettingsSection>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <KeyboardShortcutsDialog />
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
