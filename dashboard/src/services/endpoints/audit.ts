/** Mocked today (MSW) — documented in API_CONTRACT.md as the future real-backend contract. */
import { apiRequest } from "@/services/client"
import type { AuditSearchParams } from "@/features/audit-logs/search-params"
import type { AuditLogDetail, AuditLogEntry, AuditStats } from "@/types/mocked"

export interface ListAuditLogsResponse {
  data: AuditLogEntry[]
  total: number
}

export function listAuditLogs(params: AuditSearchParams, signal?: AbortSignal): Promise<ListAuditLogsResponse> {
  const query = new URLSearchParams()
  query.set("page", String(params.page))
  query.set("pageSize", String(params.pageSize))
  if (params.search) query.set("search", params.search)
  if (params.category.length > 0) query.set("category", params.category.join(","))
  if (params.actor.length > 0) query.set("actor", params.actor.join(","))
  if (params.client.length > 0) query.set("client", params.client.join(","))
  if (params.status.length > 0) query.set("status", params.status.join(","))
  if (params.severity.length > 0) query.set("severity", params.severity.join(","))
  if (params.dateFrom) query.set("dateFrom", params.dateFrom)
  if (params.dateTo) query.set("dateTo", params.dateTo)
  query.set("sortBy", params.sortBy)
  query.set("sortDir", params.sortDir)

  return apiRequest<ListAuditLogsResponse>(`/v1/audit?${query.toString()}`, { signal })
}

export function getAuditLog(id: string, signal?: AbortSignal): Promise<AuditLogDetail> {
  return apiRequest<AuditLogDetail>(`/v1/audit/${id}`, { signal })
}

export function getAuditStats(signal?: AbortSignal): Promise<AuditStats> {
  return apiRequest<AuditStats>("/v1/audit/stats", { signal })
}
