import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/constants"
import { getClient, getClientStats, listClients } from "@/services/endpoints/clients"
import type { ClientsSearchParams } from "@/features/clients/search-params"

export function useClientsList(params: ClientsSearchParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.clients, params],
    queryFn: ({ signal }) => listClients(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useClient(clientId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.client(clientId ?? ""),
    queryFn: ({ signal }) => getClient(clientId!, signal),
    enabled: Boolean(clientId),
  })
}

export function useClientStats() {
  return useQuery({
    queryKey: QUERY_KEYS.clientStats,
    queryFn: ({ signal }) => getClientStats(signal),
  })
}
