import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/constants"
import { getAuditLog, getAuditStats, listAuditLogs } from "@/services/endpoints/audit"
import type { AuditSearchParams } from "@/features/audit-logs/search-params"

export function useAuditLogsList(params: AuditSearchParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.auditLogs, params],
    queryFn: ({ signal }) => listAuditLogs(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useAuditLog(id: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.auditLogDetail(id ?? ""),
    queryFn: ({ signal }) => getAuditLog(id!, signal),
    enabled: Boolean(id),
  })
}

export function useAuditStats() {
  return useQuery({
    queryKey: QUERY_KEYS.auditLogStats,
    queryFn: ({ signal }) => getAuditStats(signal),
  })
}
