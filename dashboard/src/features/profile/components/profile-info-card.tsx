import { useMemo } from "react"
import { Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SettingsCard } from "@/features/settings/components/settings-card"
import { SettingsSection } from "@/features/settings/components/settings-section"
import { SettingsField } from "@/features/settings/components/settings-field"
import { SecretField } from "@/features/settings/components/secret-field"
import { SettingsActions } from "@/features/settings/components/settings-actions"
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form"
import { ProfileAvatarField } from "@/features/profile/components/profile-avatar-field"
import { useUpdateProfile } from "@/features/profile/hooks"
import { profileInfoSchema, type ProfileInfoFormValues } from "@/features/profile/schema"
import type { ProfileResponse, ProfileRole } from "@/types/mocked"

interface ProfileInfoCardProps {
  profile: ProfileResponse
}

const ROLE_LABELS: Record<ProfileRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  member: "Member",
  viewer: "Viewer",
}

function toFormValues(profile: ProfileResponse): ProfileInfoFormValues {
  return { name: profile.name, email: profile.email, avatar_url: profile.avatar_url ?? "" }
}

function maskApiKey(last4: string): string {
  return `sk_live_••••••••${last4}`
}

/** Editable identity fields (Avatar/Name/Email) plus read-only account metadata (Role,
 * Organization, masked API key) in the same card, matching how Settings' Security card mixes a
 * read-only API-key list above its editable fields. */
export function ProfileInfoCard({ profile }: ProfileInfoCardProps) {
  const updateMutation = useUpdateProfile()

  async function handleSave(data: ProfileInfoFormValues): Promise<boolean> {
    try {
      await updateMutation.mutateAsync({
        section: "info",
        data: { name: data.name, email: data.email, avatar_url: data.avatar_url || null },
      })
      toast.success("Profile saved")
      return true
    } catch {
      toast.error("Couldn't save your profile. Please try again.")
      return false
    }
  }

  // Memoized so its reference only changes when `profile` itself changes — useSettingsSectionForm's
  // internal effect depends on `defaultValues` by reference, and a freshly computed object literal
  // here on every render would re-fire that effect every render, causing an infinite reset loop
  // (caught live: React's "Maximum update depth exceeded" on this component).
  const defaultValues = useMemo(() => toFormValues(profile), [profile])

  const { form, isEditing, startEditing, handleCancel, handleReset, onSubmit } = useSettingsSectionForm({
    resolver: zodResolver(profileInfoSchema),
    defaultValues,
    onSave: handleSave,
  })
  const {
    register,
    control,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = form
  const nameValue = watch("name")

  return (
    <SettingsCard title="Profile Information" description="Your identity across this workspace.">
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Role</p>
          <Badge variant="secondary">{ROLE_LABELS[profile.role]}</Badge>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Organization</p>
          <p className="text-sm text-foreground">{profile.organization}</p>
        </div>
      </div>

      <div className="mb-5">
        <SecretField
          label="API Key"
          value={maskApiKey(profile.api_key_last4)}
          description="Provisioned and rotated from Settings → Security."
        />
      </div>

      <form onSubmit={onSubmit} noValidate>
        <SettingsSection>
          <Controller
            control={control}
            name="avatar_url"
            render={({ field }) => (
              <ProfileAvatarField
                name={nameValue}
                avatarUrl={field.value}
                onAvatarUrlChange={field.onChange}
                disabled={!isEditing}
                error={errors.avatar_url?.message}
              />
            )}
          />

          <SettingsField label="Name" htmlFor="name" error={errors.name?.message}>
            <Input
              id="name"
              autoComplete="name"
              disabled={!isEditing}
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
          </SettingsField>

          <SettingsField label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              autoComplete="email"
              type="email"
              disabled={!isEditing}
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
          </SettingsField>
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
