import { http, HttpResponse } from "msw"
import { API_BASE_URL } from "@/lib/constants"
import { computeAuditStats, getAuditLogDetailById, listAuditLogEntries } from "@/services/mock/fixtures/audit"
import type { AuditLogEntry } from "@/types/mocked"

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b
  if (a === null) return b === null ? 0 : -1
  if (b === null) return 1
  return String(a).localeCompare(String(b))
}

export const auditHandlers = [
  http.get(`${API_BASE_URL}/v1/audit/stats`, () => {
    return HttpResponse.json(computeAuditStats())
  }),

  http.get(`${API_BASE_URL}/v1/audit/:id`, ({ params }) => {
    const detail = getAuditLogDetailById(String(params.id))
    if (!detail) {
      return HttpResponse.json({ detail: "Audit log entry not found" }, { status: 404 })
    }
    return HttpResponse.json(detail)
  }),

  http.get(`${API_BASE_URL}/v1/audit`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get("page") ?? "1")
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20")
    const search = (url.searchParams.get("search") ?? "").toLowerCase().trim()
    const categoryFilter = url.searchParams.get("category")?.split(",").filter(Boolean) ?? []
    const actorFilter = url.searchParams.get("actor")?.split(",").filter(Boolean) ?? []
    const clientFilter = url.searchParams.get("client")?.split(",").filter(Boolean) ?? []
    const statusFilter = url.searchParams.get("status")?.split(",").filter(Boolean) ?? []
    const severityFilter = url.searchParams.get("severity")?.split(",").filter(Boolean) ?? []
    const dateFrom = url.searchParams.get("dateFrom")
    const dateTo = url.searchParams.get("dateTo")
    const sortBy = url.searchParams.get("sortBy") ?? "timestamp"
    const sortDir = url.searchParams.get("sortDir") ?? "desc"

    let results: AuditLogEntry[] = listAuditLogEntries()

    if (search) {
      results = results.filter(
        (entry) =>
          entry.actor.toLowerCase().includes(search) ||
          entry.action.toLowerCase().includes(search) ||
          entry.resource.toLowerCase().includes(search) ||
          entry.request_id.toLowerCase().includes(search),
      )
    }
    if (categoryFilter.length > 0) results = results.filter((entry) => categoryFilter.includes(entry.category))
    if (actorFilter.length > 0) results = results.filter((entry) => actorFilter.includes(entry.actor_email))
    if (clientFilter.length > 0) results = results.filter((entry) => clientFilter.includes(entry.client_id))
    if (statusFilter.length > 0) results = results.filter((entry) => statusFilter.includes(entry.status))
    if (severityFilter.length > 0) results = results.filter((entry) => severityFilter.includes(entry.severity))
    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      results = results.filter((entry) => new Date(entry.timestamp).getTime() >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86_400_000
      results = results.filter((entry) => new Date(entry.timestamp).getTime() <= to)
    }

    results = [...results].sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1
      return compareValues(a[sortBy as keyof AuditLogEntry], b[sortBy as keyof AuditLogEntry]) * direction
    })

    const total = results.length
    const start = (page - 1) * pageSize
    const paged = results.slice(start, start + pageSize)

    return HttpResponse.json({ data: paged, total })
  }),
]
