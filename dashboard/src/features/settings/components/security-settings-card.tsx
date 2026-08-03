import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { SettingsCard } from "@/features/settings/components/settings-card"
import { SettingsSection } from "@/features/settings/components/settings-section"
import { SettingsField } from "@/features/settings/components/settings-field"
import { ToggleField } from "@/features/settings/components/toggle-field"
import { NumberField } from "@/features/settings/components/number-field"
import { SecretField } from "@/features/settings/components/secret-field"
import { SettingsActions } from "@/features/settings/components/settings-actions"
import { useUpdateSettingsSection } from "@/features/settings/hooks"
import { securitySettingsSchema, type SecurityFormInput, type SecurityFormValues } from "@/features/settings/schema"
import { formatRelativeTime } from "@/lib/format"
import type { SecuritySettings } from "@/types/mocked"

interface SecuritySettingsCardProps {
  settings: SecuritySettings
}

function maskApiKey(last4: string): string {
  return `sk_live_••••••••${last4}`
}

function toFormValues(settings: SecuritySettings): SecurityFormInput {
  return {
    session_timeout_minutes: settings.session_timeout_minutes,
    mfa_enabled: settings.mfa_enabled,
    ip_allow_list: settings.ip_allow_list.join("\n"),
    audit_logging_enabled: settings.audit_logging_enabled,
  }
}

/** The one section with its own hand-rolled Edit/Cancel/Save/Reset state (rather than
 * useSettingsSectionForm) because ip_allow_list's zod schema transforms a newline-delimited
 * textarea string into string[] — its form-input type and saved-value type genuinely differ,
 * which the shared hook (built for same-shape sections) doesn't model. */
export function SecuritySettingsCard({ settings }: SecuritySettingsCardProps) {
  const updateMutation = useUpdateSettingsSection()
  const [isEditing, setIsEditing] = useState(false)
  const defaultValues = toFormValues(settings)

  const form = useForm<SecurityFormInput, unknown, SecurityFormValues>({
    resolver: zodResolver(securitySettingsSchema),
    defaultValues,
  })
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = form

  useEffect(() => {
    if (!isEditing) reset(toFormValues(settings))
    // See useSettingsSectionForm's identical comment: isEditing must be a dependency here too, or
    // a successful save's query-cache update and this effect's isEditing check can land in
    // separate renders and miss re-baselining — onSubmit below re-baselines directly instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, isEditing])

  const onSubmit = handleSubmit(async (data) => {
    try {
      await updateMutation.mutateAsync({ section: "security", data })
      toast.success("Security settings saved")
      // Re-baseline against what was actually submitted (converting the array back to the
      // textarea's newline-delimited string) rather than waiting for the effect above.
      reset({ ...data, ip_allow_list: data.ip_allow_list.join("\n") })
      setIsEditing(false)
    } catch {
      toast.error("Couldn't save security settings. Please try again.")
    }
  })

  function handleCancel(): void {
    reset(defaultValues)
    setIsEditing(false)
  }

  function handleReset(): void {
    reset(defaultValues)
  }

  return (
    <SettingsCard title="Security" description="API access, session policy, and audit controls.">
      <div className="mb-5 space-y-3">
        {settings.api_keys.map((key) => (
          <SecretField
            key={key.id}
            label={`API Key — ${key.label}`}
            value={maskApiKey(key.key_last4)}
            description={
              key.last_used_at
                ? `Last used ${formatRelativeTime(key.last_used_at)}`
                : "Never used"
            }
          />
        ))}
      </div>

      <form onSubmit={onSubmit} noValidate>
        <SettingsSection>
          <Controller
            control={control}
            name="session_timeout_minutes"
            render={({ field }) => (
              <NumberField
                label="Session Timeout"
                id="session_timeout_minutes"
                value={field.value}
                onChange={field.onChange}
                min={5}
                max={1440}
                suffix="min"
                disabled={!isEditing}
                error={errors.session_timeout_minutes?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="mfa_enabled"
            render={({ field }) => (
              <ToggleField
                label="Multi-Factor Authentication"
                description="Require MFA for every user in this organization."
                id="mfa_enabled"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!isEditing}
              />
            )}
          />

          <SettingsField
            label="IP Allow List"
            description="One IP or CIDR range per line. Leave empty to allow any address."
            htmlFor="ip_allow_list"
            error={errors.ip_allow_list?.message}
          >
            <Textarea
              id="ip_allow_list"
              rows={3}
              placeholder="203.0.113.0/24"
              disabled={!isEditing}
              aria-invalid={Boolean(errors.ip_allow_list)}
              {...register("ip_allow_list")}
            />
          </SettingsField>

          <Controller
            control={control}
            name="audit_logging_enabled"
            render={({ field }) => (
              <ToggleField
                label="Audit Logging"
                description="Record every settings change and administrative action."
                id="audit_logging_enabled"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!isEditing}
              />
            )}
          />
        </SettingsSection>

        <div className="mt-4">
          <SettingsActions
            isEditing={isEditing}
            isDirty={isDirty}
            isSubmitting={isSubmitting}
            onEdit={() => setIsEditing(true)}
            onCancel={handleCancel}
            onReset={handleReset}
          />
        </div>
      </form>
    </SettingsCard>
  )
}
