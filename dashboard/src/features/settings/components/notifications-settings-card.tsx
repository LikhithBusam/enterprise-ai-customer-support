import { Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { SettingsCard } from "@/features/settings/components/settings-card"
import { SettingsSection } from "@/features/settings/components/settings-section"
import { ToggleField } from "@/features/settings/components/toggle-field"
import { SettingsActions } from "@/features/settings/components/settings-actions"
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form"
import { useUpdateSettingsSection } from "@/features/settings/hooks"
import { notificationSettingsSchema, type NotificationFormValues } from "@/features/settings/schema"
import type { NotificationSettings } from "@/types/mocked"

interface NotificationsSettingsCardProps {
  settings: NotificationSettings
}

export function NotificationsSettingsCard({ settings }: NotificationsSettingsCardProps) {
  const updateMutation = useUpdateSettingsSection()

  async function handleSave(data: NotificationFormValues): Promise<boolean> {
    try {
      await updateMutation.mutateAsync({ section: "notifications", data })
      toast.success("Notification settings saved")
      return true
    } catch {
      toast.error("Couldn't save notification settings. Please try again.")
      return false
    }
  }

  const { form, isEditing, startEditing, handleCancel, handleReset, onSubmit } = useSettingsSectionForm({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: settings,
    onSave: handleSave,
  })
  const {
    control,
    formState: { isDirty, isSubmitting },
  } = form

  return (
    <SettingsCard title="Notifications" description="Where the platform sends alerts about ticket and system activity.">
      <form onSubmit={onSubmit} noValidate>
        <SettingsSection>
          <Controller
            control={control}
            name="email_alerts"
            render={({ field }) => (
              <ToggleField
                label="Email Alerts"
                description="Send email notifications for important ticket events."
                id="email_alerts"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!isEditing}
              />
            )}
          />

          <Controller
            control={control}
            name="slack_notifications"
            render={({ field }) => (
              <ToggleField
                label="Slack Notifications"
                description="Post ticket and escalation activity to a connected Slack channel."
                id="slack_notifications"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!isEditing}
              />
            )}
          />

          <Controller
            control={control}
            name="failure_alerts"
            render={({ field }) => (
              <ToggleField
                label="Failure Alerts"
                description="Notify immediately when a tool or circuit breaker degrades."
                id="failure_alerts"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!isEditing}
              />
            )}
          />

          <Controller
            control={control}
            name="weekly_reports"
            render={({ field }) => (
              <ToggleField
                label="Weekly Reports"
                description="Send a weekly resolution-rate and usage summary."
                id="weekly_reports"
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
            onEdit={startEditing}
            onCancel={handleCancel}
            onReset={handleReset}
          />
        </div>
      </form>
    </SettingsCard>
  )
}
