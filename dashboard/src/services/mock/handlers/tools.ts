import { http, HttpResponse } from "msw"
import { API_BASE_URL } from "@/lib/constants"
import {
  computeToolStats,
  getToolDetailById,
  getToolHistory,
  listToolHealth,
} from "@/services/mock/fixtures/tools"
import type { ToolHealth } from "@/types/mocked"

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b
  if (a === null) return b === null ? 0 : -1
  if (b === null) return 1
  return String(a).localeCompare(String(b))
}

export const toolsHandlers = [
  http.get(`${API_BASE_URL}/v1/tools/stats`, () => {
    return HttpResponse.json(computeToolStats())
  }),

  http.get(`${API_BASE_URL}/v1/tools/:id/history`, ({ params }) => {
    const history = getToolHistory(String(params.id))
    if (!history) {
      return HttpResponse.json({ detail: "Tool not found" }, { status: 404 })
    }
    return HttpResponse.json(history)
  }),

  http.get(`${API_BASE_URL}/v1/tools/:id`, ({ params }) => {
    const detail = getToolDetailById(String(params.id))
    if (!detail) {
      return HttpResponse.json({ detail: "Tool not found" }, { status: 404 })
    }
    return HttpResponse.json(detail)
  }),

  http.get(`${API_BASE_URL}/v1/tools`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get("page") ?? "1")
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20")
    const search = (url.searchParams.get("search") ?? "").toLowerCase().trim()
    const statusFilter = url.searchParams.get("status")?.split(",").filter(Boolean) ?? []
    const latencyMin = url.searchParams.get("latencyMin")
    const latencyMax = url.searchParams.get("latencyMax")
    const successMin = url.searchParams.get("successMin")
    const failureMax = url.searchParams.get("failureMax")
    const dateFrom = url.searchParams.get("dateFrom")
    const dateTo = url.searchParams.get("dateTo")
    const sortBy = url.searchParams.get("sortBy") ?? "tool_name"
    const sortDir = url.searchParams.get("sortDir") ?? "asc"

    let results: ToolHealth[] = listToolHealth()

    if (search) {
      results = results.filter(
        (tool) =>
          tool.tool_name.toLowerCase().includes(search) || tool.description.toLowerCase().includes(search),
      )
    }
    if (statusFilter.length > 0) {
      results = results.filter((tool) => statusFilter.includes(tool.status))
    }
    if (latencyMin) results = results.filter((tool) => tool.avg_latency_ms >= Number(latencyMin))
    if (latencyMax) results = results.filter((tool) => tool.avg_latency_ms <= Number(latencyMax))
    if (successMin) results = results.filter((tool) => tool.success_rate >= Number(successMin) / 100)
    if (failureMax) results = results.filter((tool) => tool.failure_rate <= Number(failureMax) / 100)
    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      results = results.filter((tool) => tool.last_used_at !== null && new Date(tool.last_used_at).getTime() >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86_400_000
      results = results.filter((tool) => tool.last_used_at !== null && new Date(tool.last_used_at).getTime() <= to)
    }

    results = [...results].sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1
      return compareValues(a[sortBy as keyof ToolHealth], b[sortBy as keyof ToolHealth]) * direction
    })

    const total = results.length
    const start = (page - 1) * pageSize
    const paged = results.slice(start, start + pageSize)

    return HttpResponse.json({ data: paged, total })
  }),
]
