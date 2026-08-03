import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/constants"
import { getAvailableModels, getSettings, updateSettingsSection } from "@/services/endpoints/settings"
import type { UpdateSettingsRequest } from "@/types/mocked"

export function useSettings() {
  return useQuery({
    queryKey: QUERY_KEYS.settings,
    queryFn: ({ signal }) => getSettings(signal),
  })
}

export function useAvailableModels() {
  return useQuery({
    queryKey: QUERY_KEYS.settingsModels,
    queryFn: ({ signal }) => getAvailableModels(signal),
  })
}

export function useUpdateSettingsSection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: UpdateSettingsRequest) => updateSettingsSection(request),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.settings, updated)
    },
  })
}
