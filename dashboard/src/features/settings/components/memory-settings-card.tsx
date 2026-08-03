import { Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { SettingsCard } from "@/features/settings/components/settings-card"
import { SettingsSection } from "@/features/settings/components/settings-section"
import { ToggleField } from "@/features/settings/components/toggle-field"
import { SliderField } from "@/features/settings/components/slider-field"
import { NumberField } from "@/features/settings/components/number-field"
import { SettingsActions } from "@/features/settings/components/settings-actions"
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form"
import { useUpdateSettingsSection } from "@/features/settings/hooks"
import { memorySettingsSchema, type MemoryFormValues } from "@/features/settings/schema"
import { formatPercent } from "@/lib/format"
import type { MemorySettings } from "@/types/mocked"

interface MemorySettingsCardProps {
  settings: MemorySettings
}

export function MemorySettingsCard({ settings }: MemorySettingsCardProps) {
  const updateMutation = useUpdateSettingsSection()

  async function handleSave(data: MemoryFormValues): Promise<boolean> {
    try {
      await updateMutation.mutateAsync({ section: "memory", data })
      toast.success("Memory settings saved")
      return true
    } catch {
      toast.error("Couldn't save memory settings. Please try again.")
      return false
    }
  }

  const { form, isEditing, startEditing, handleCancel, handleReset, onSubmit } = useSettingsSectionForm({
    resolver: zodResolver(memorySettingsSchema),
    defaultValues: settings,
    onSave: handleSave,
  })
  const {
    control,
    formState: { errors, isDirty, isSubmitting },
  } = form

  return (
    <SettingsCard title="Memory" description="How the agent pipeline retrieves and retains memory entries.">
      <form onSubmit={onSubmit} noValidate>
        <SettingsSection>
          <Controller
            control={control}
            name="memory_enabled"
            render={({ field }) => (
              <ToggleField
                label="Memory Enabled"
                description="Turn off to run every ticket memoryless."
                id="memory_enabled"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!isEditing}
              />
            )}
          />

          <Controller
            control={control}
            name="memory_retention_days"
            render={({ field }) => (
              <NumberField
                label="Memory Retention"
                id="memory_retention_days"
                value={field.value}
                onChange={field.onChange}
                min={1}
                max={3650}
                suffix="days"
                disabled={!isEditing}
                error={errors.memory_retention_days?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="similarity_threshold"
            render={({ field }) => (
              <SliderField
                label="Similarity Threshold"
                description="Minimum similarity score required for a memory retrieval to count as a hit."
                id="similarity_threshold"
                value={field.value}
                onValueChange={field.onChange}
                min={0}
                max={1}
                step={0.01}
                formatValue={(value) => formatPercent(value, 0)}
                disabled={!isEditing}
              />
            )}
          />

          <Controller
            control={control}
            name="max_memories"
            render={({ field }) => (
              <NumberField
                label="Max Memories"
                description="Upper bound on stored entries per client before pruning."
                id="max_memories"
                value={field.value}
                onChange={field.onChange}
                min={1}
                max={100_000}
                disabled={!isEditing}
                error={errors.max_memories?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="auto_cleanup"
            render={({ field }) => (
              <ToggleField
                label="Auto Cleanup"
                description="Automatically prune memories past the retention window."
                id="auto_cleanup"
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
