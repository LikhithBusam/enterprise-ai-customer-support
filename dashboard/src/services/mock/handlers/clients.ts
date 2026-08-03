import { http, HttpResponse } from "msw"
import { API_BASE_URL } from "@/lib/constants"
import { computeClientStats, getClientDetailById, listClientRecords } from "@/services/mock/fixtures/clients"
import type { ClientRecord } from "@/types/mocked"

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b
  if (a === null) return b === null ? 0 : -1
  if (b === null) return 1
  return String(a).localeCompare(String(b))
}

function usagePct(client: ClientRecord): number {
  return client.monthly_ticket_limit === 0 ? 0 : (client.monthly_ticket_usage / client.monthly_ticket_limit) * 100
}

export const clientsHandlers = [
  http.get(`${API_BASE_URL}/v1/clients/stats`, () => {
    return HttpResponse.json(computeClientStats())
  }),

  http.get(`${API_BASE_URL}/v1/clients/:id`, ({ params }) => {
    const detail = getClientDetailById(String(params.id))
    if (!detail) {
      return HttpResponse.json({ detail: "Client not found" }, { status: 404 })
    }
    return HttpResponse.json(detail)
  }),

  http.get(`${API_BASE_URL}/v1/clients`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get("page") ?? "1")
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20")
    const search = (url.searchParams.get("search") ?? "").toLowerCase().trim()
    const planFilter = url.searchParams.get("plan")?.split(",").filter(Boolean) ?? []
    const statusFilter = url.searchParams.get("status")?.split(",").filter(Boolean) ?? []
    const usageMin = url.searchParams.get("usageMin")
    const usageMax = url.searchParams.get("usageMax")
    const retentionMin = url.searchParams.get("retentionMin")
    const retentionMax = url.searchParams.get("retentionMax")
    const dateFrom = url.searchParams.get("dateFrom")
    const dateTo = url.searchParams.get("dateTo")
    const sortBy = url.searchParams.get("sortBy") ?? "created_at"
    const sortDir = url.searchParams.get("sortDir") ?? "desc"

    let results: ClientRecord[] = listClientRecords()

    if (search) {
      results = results.filter(
        (client) => client.name.toLowerCase().includes(search) || client.client_id.toLowerCase().includes(search),
      )
    }
    if (planFilter.length > 0) {
      results = results.filter((client) => planFilter.includes(client.plan))
    }
    if (statusFilter.length > 0) {
      results = results.filter((client) => statusFilter.includes(client.status))
    }
    if (usageMin) results = results.filter((client) => usagePct(client) >= Number(usageMin))
    if (usageMax) results = results.filter((client) => usagePct(client) <= Number(usageMax))
    if (retentionMin) results = results.filter((client) => client.memory_retention_days >= Number(retentionMin))
    if (retentionMax) results = results.filter((client) => client.memory_retention_days <= Number(retentionMax))
    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      results = results.filter((client) => new Date(client.created_at).getTime() >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86_400_000
      results = results.filter((client) => new Date(client.created_at).getTime() <= to)
    }

    results = [...results].sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1
      return compareValues(a[sortBy as keyof ClientRecord], b[sortBy as keyof ClientRecord]) * direction
    })

    const total = results.length
    const start = (page - 1) * pageSize
    const paged = results.slice(start, start + pageSize)

    return HttpResponse.json({ data: paged, total })
  }),
]
