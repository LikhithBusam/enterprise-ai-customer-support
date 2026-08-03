import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { SettingsField } from "@/features/settings/components/settings-field"

interface ProfileAvatarFieldProps {
  name: string
  avatarUrl: string
  onAvatarUrlChange: (value: string) => void
  disabled: boolean
  error?: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "??"
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

/** Avatar image preview (falls back to initials on a missing/broken URL) plus the URL input that
 * drives it — there is no real file-upload backend, so an image URL is the only avatar source
 * this dashboard can honestly support (see API_CONTRACT.md). */
export function ProfileAvatarField({ name, avatarUrl, onAvatarUrlChange, disabled, error }: ProfileAvatarFieldProps) {
  return (
    <div className="flex items-start gap-4">
      <Avatar size="lg" className="size-16">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
        <AvatarFallback className="text-base">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <SettingsField
          label="Avatar URL"
          description="Link to an image. Leave empty to use your initials."
          htmlFor="avatar_url"
          error={error}
        >
          <Input
            id="avatar_url"
            name="avatar_url"
            autoComplete="url"
            placeholder="https://…"
            value={avatarUrl}
            onChange={(event) => onAvatarUrlChange(event.target.value)}
            disabled={disabled}
            aria-invalid={Boolean(error)}
          />
        </SettingsField>
      </div>
    </div>
  )
}
