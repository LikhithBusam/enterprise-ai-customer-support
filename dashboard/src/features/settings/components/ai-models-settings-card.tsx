import { Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { SettingsCard } from "@/features/settings/components/settings-card"
import { SettingsSection } from "@/features/settings/components/settings-section"
import { SelectField } from "@/features/settings/components/select-field"
import { SliderField } from "@/features/settings/components/slider-field"
import { NumberField } from "@/features/settings/components/number-field"
import { SettingsActions } from "@/features/settings/components/settings-actions"
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form"
import { useAvailableModels, useUpdateSettingsSection } from "@/features/settings/hooks"
import { aiModelSettingsSchema, type AiModelFormValues } from "@/features/settings/schema"
import type { AiModelSettings } from "@/types/mocked"

interface AiModelsSettingsCardProps {
  settings: AiModelSettings
}

function toOptions(values: string[]): Array<{ value: string; label: string }> {
  return values.map((value) => ({ value, label: value }))
}

export function AiModelsSettingsCard({ settings }: AiModelsSettingsCardProps) {
  const updateMutation = useUpdateSettingsSection()
  const modelsQuery = useAvailableModels()

  async function handleSave(data: AiModelFormValues): Promise<boolean> {
    try {
      await updateMutation.mutateAsync({ section: "ai_models", data })
      toast.success("AI model settings saved")
      return true
    } catch {
      toast.error("Couldn't save AI model settings. Please try again.")
      return false
    }
  }

  const { form, isEditing, startEditing, handleCancel, handleReset, onSubmit } = useSettingsSectionForm({
    resolver: zodResolver(aiModelSettingsSchema),
    defaultValues: settings,
    onSave: handleSave,
  })
  const {
    control,
    formState: { errors, isDirty, isSubmitting },
  } = form

  // Guarantees the currently-saved value always has a matching option even before the models
  // query resolves (or if the saved value has since been retired from the catalog).
  const llmOptions = toOptions(
    Array.from(new Set([settings.default_llm, ...(modelsQuery.data?.llms ?? [])])),
  )
  const embeddingOptions = toOptions(
    Array.from(new Set([settings.embedding_model, ...(modelsQuery.data?.embedding_models ?? [])])),
  )

  return (
    <SettingsCard title="AI Models" description="Default model, generation, and tool-call behavior for this workspace.">
      <form onSubmit={onSubmit} noValidate>
        <SettingsSection>
          <Controller
            control={control}
            name="default_llm"
            render={({ field }) => (
              <SelectField
                label="Default LLM"
                id="default_llm"
                value={field.value}
                onValueChange={field.onChange}
                options={llmOptions}
                disabled={!isEditing}
                error={errors.default_llm?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="temperature"
            render={({ field }) => (
              <SliderField
                label="Temperature"
                description="Higher values produce more varied responses."
                id="temperature"
                value={field.value}
                onValueChange={field.onChange}
                min={0}
                max={2}
                step={0.05}
                formatValue={(value) => value.toFixed(2)}
                disabled={!isEditing}
              />
            )}
          />

          <Controller
            control={control}
            name="max_tokens"
            render={({ field }) => (
              <NumberField
                label="Max Tokens"
                id="max_tokens"
                value={field.value}
                onChange={field.onChange}
                min={1}
                max={128_000}
                step={1}
                disabled={!isEditing}
                error={errors.max_tokens?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="embedding_model"
            render={({ field }) => (
              <SelectField
                label="Embedding Model"
                id="embedding_model"
                value={field.value}
                onValueChange={field.onChange}
                options={embeddingOptions}
                disabled={!isEditing}
                error={errors.embedding_model?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="tool_timeout_seconds"
            render={({ field }) => (
              <NumberField
                label="Tool Timeout"
                id="tool_timeout_seconds"
                value={field.value}
                onChange={field.onChange}
                min={1}
                max={300}
                step={1}
                suffix="sec"
                disabled={!isEditing}
                error={errors.tool_timeout_seconds?.message}
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
