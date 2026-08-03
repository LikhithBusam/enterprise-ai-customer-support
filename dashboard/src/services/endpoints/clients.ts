/** Mocked today (MSW) — documented in API_CONTRACT.md as the future real-backend contract. */
import { apiRequest } from "@/services/client"
import type { ClientsSearchParams } from "@/features/clients/search-params"
import type { ClientDetail, ClientRecord, ClientStats } from "@/types/mocked"

export interface ListClientsResponse {
  data: ClientRecord[]
  total: number
}

export function listClients(params: ClientsSearchParams, signal?: AbortSignal): Promise<ListClientsResponse> {
  const query = new URLSearchParams()
  query.set("page", String(params.page))
  query.set("pageSize", String(params.pageSize))
  if (params.search) query.set("search", params.search)
  if (params.plan.length > 0) query.set("plan", params.plan.join(","))
  if (params.status.length > 0) query.set("status", params.status.join(","))
  if (params.usageMin > 0) query.set("usageMin", String(params.usageMin))
  if (params.usageMax < 120) query.set("usageMax", String(params.usageMax))
  if (params.retentionMin > 0) query.set("retentionMin", String(params.retentionMin))
  if (params.retentionMax < 400) query.set("retentionMax", String(params.retentionMax))
  if (params.dateFrom) query.set("dateFrom", params.dateFrom)
  if (params.dateTo) query.set("dateTo", params.dateTo)
  query.set("sortBy", params.sortBy)
  query.set("sortDir", params.sortDir)

  return apiRequest<ListClientsResponse>(`/v1/clients?${query.toString()}`, { signal })
}

export function getClient(clientId: string, signal?: AbortSignal): Promise<ClientDetail> {
  return apiRequest<ClientDetail>(`/v1/clients/${clientId}`, { signal })
}

export function getClientStats(signal?: AbortSignal): Promise<ClientStats> {
  return apiRequest<ClientStats>("/v1/clients/stats", { signal })
}
