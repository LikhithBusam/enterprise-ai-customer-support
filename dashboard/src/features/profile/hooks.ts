import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/constants"
import { getProfile, updateProfile } from "@/services/endpoints/profile"
import type { UpdateProfileRequest } from "@/types/mocked"

export function useProfile() {
  return useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: ({ signal }) => getProfile(signal),
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: UpdateProfileRequest) => updateProfile(request),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.profile, updated)
    },
  })
}
