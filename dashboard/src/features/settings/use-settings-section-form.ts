import { useEffect, useState } from "react"
import { useForm, type DefaultValues, type FieldValues, type Resolver } from "react-hook-form"

interface UseSettingsSectionFormOptions<T extends FieldValues> {
  /** Built by the caller via `zodResolver(schema)` — resolving the generic at the concrete call
   * site (where the schema's real type is known) avoids a resolver-overload ambiguity that shows
   * up when a schema type parameter is threaded generically through this hook instead. */
  resolver: Resolver<T>
  defaultValues: T
  /** Returns whether the save succeeded — the hook only exits edit mode on `true`, so a failed
   * save (network error, etc.) leaves the form dirty and in edit mode for the user to retry. The
   * caller is responsible for its own success/error toast. */
  onSave: (data: T) => Promise<boolean>
}

/** Shared Edit/Cancel/Save/Reset + dirty-state mechanics for a single Settings section form —
 * every section card (General, AI Models, Memory, Notifications, Appearance) uses this
 * identically. Security's form has a text\<->array transform between its field value and its
 * saved value, so it manages its own form state directly instead of through this hook. */
export function useSettingsSectionForm<T extends FieldValues>({
  resolver,
  defaultValues,
  onSave,
}: UseSettingsSectionFormOptions<T>) {
  const [isEditing, setIsEditing] = useState(false)
  // Casts here are a known friction point when a generic T extends FieldValues is threaded
  // through RHF's own generic-constrained APIs (DefaultValues<T>, the handleSubmit callback) —
  // TS can't verify a not-yet-resolved T against those mapped/inferred types even though every
  // concrete call site (one per section card) is fully type-checked end to end.
  const form = useForm<T>({ resolver, defaultValues: defaultValues as DefaultValues<T> })

  useEffect(() => {
    if (!isEditing) form.reset(defaultValues)
    // Re-sync only when the server-derived defaults change while not mid-edit — resetting while
    // isEditing would discard in-progress user input every time the settings query refetches.
    // isEditing is included so this also fires the moment editing ends (Cancel), not just when
    // defaultValues itself changes — a successful Save re-baselines directly in onSubmit below
    // instead of relying on this effect, since the query-driven defaultValues update and the
    // isEditing flip are two separate renders and can land in either order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues, isEditing])

  const onSubmit = form.handleSubmit(async (data) => {
    const success = await onSave(data as T)
    if (success) {
      // Re-baseline against what was actually just submitted, rather than waiting for the
      // mutation's query-cache update to flow back down as a new `defaultValues` prop — that
      // update and this `setIsEditing(false)` land in separate renders, and relying on the effect
      // above to catch it left a window where isDirty stayed stuck true after a successful save.
      form.reset(data)
      setIsEditing(false)
    }
  })

  function handleCancel(): void {
    form.reset(defaultValues)
    setIsEditing(false)
  }

  function handleReset(): void {
    form.reset(defaultValues)
  }

  return {
    form,
    isEditing,
    startEditing: () => setIsEditing(true),
    handleCancel,
    handleReset,
    onSubmit,
  }
}
