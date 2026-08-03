import { http, HttpResponse } from "msw"
import { API_BASE_URL } from "@/lib/constants"
import { conversationsFixture, toSummary } from "@/services/mock/fixtures/conversations"

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b))
}

export const conversationsHandlers = [
  http.get(`${API_BASE_URL}/v1/conversations`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get("page") ?? "1")
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20")
    const search = (url.searchParams.get("search") ?? "").toLowerCase().trim()
    const statusFilter = url.searchParams.get("status")?.split(",").filter(Boolean) ?? []
    const intentFilter = url.searchParams.get("intent")?.split(",").filter(Boolean) ?? []
    const sortBy = url.searchParams.get("sortBy") ?? "created_at"
    const sortDir = url.searchParams.get("sortDir") ?? "desc"

    let results = conversationsFixture.map(toSummary)

    if (search) {
      results = results.filter(
        (item) =>
          item.ticket_id.toLowerCase().includes(search) ||
          item.customer_name.toLowerCase().includes(search) ||
          item.customer_message.toLowerCase().includes(search),
      )
    }
    if (statusFilter.length > 0) {
      results = results.filter((item) => statusFilter.includes(item.status))
    }
    if (intentFilter.length > 0) {
      results = results.filter((item) => intentFilter.includes(item.intent_label))
    }

    results = [...results].sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1
      return compareValues(a[sortBy as keyof typeof a], b[sortBy as keyof typeof b]) * direction
    })

    const total = results.length
    const start = (page - 1) * pageSize
    const paged = results.slice(start, start + pageSize)

    return HttpResponse.json({ data: paged, total })
  }),

  http.get(`${API_BASE_URL}/v1/conversations/:ticketId`, ({ params }) => {
    const conversation = conversationsFixture.find((item) => item.ticket_id === params.ticketId)
    if (!conversation) {
      return HttpResponse.json({ detail: "Conversation not found" }, { status: 404 })
    }
    return HttpResponse.json(conversation)
  }),
]
