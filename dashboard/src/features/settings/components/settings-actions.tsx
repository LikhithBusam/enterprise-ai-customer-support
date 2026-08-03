import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SettingsActionsProps {
  isEditing: boolean
  isDirty: boolean
  isSubmitting: boolean
  onEdit: () => void
  onCancel: () => void
  onReset: () => void
}

/** Footer action row every Settings section shares: an "Edit" trigger when read-only, or
 * Reset/Cancel/Save once editing — Save and Reset both require a dirty form. */
export function SettingsActions({ isEditing, isDirty, isSubmitting, onEdit, onCancel, onReset }: SettingsActionsProps) {
  if (!isEditing) {
    return (
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={!isDirty || isSubmitting}>
        Reset
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button type="submit" size="sm" disabled={!isDirty || isSubmitting}>
        {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
        Save
      </Button>
    </div>
  )
}
