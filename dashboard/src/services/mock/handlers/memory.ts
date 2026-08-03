import { http, HttpResponse } from "msw"
import { API_BASE_URL } from "@/lib/constants"
import { computeMemoryStats, memoryFixture } from "@/services/mock/fixtures/memory"
import type { MemoryEntryBase } from "@/types/mocked"

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b
  if (a === null) return b === null ? 0 : -1
  if (b === null) return 1
  return String(a).localeCompare(String(b))
}

export const memoryHandlers = [
  http.get(`${API_BASE_URL}/v1/memory/stats`, ({ request }) => {
    const url = new URL(request.url)
    const type = url.searchParams.get("type")
    const scoped = type ? memoryFixture.filter((entry) => entry.memory_type === type) : memoryFixture
    return HttpResponse.json(computeMemoryStats(scoped))
  }),

  http.get(`${API_BASE_URL}/v1/memory/:id`, ({ params }) => {
    const entry = memoryFixture.find((item) => item.id === params.id)
    if (!entry) {
      return HttpResponse.json({ detail: "Memory entry not found" }, { status: 404 })
    }
    return HttpResponse.json(entry)
  }),

  http.get(`${API_BASE_URL}/v1/memory`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get("page") ?? "1")
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20")
    const search = (url.searchParams.get("search") ?? "").toLowerCase().trim()
    const typeFilter = url.searchParams.get("types")?.split(",").filter(Boolean) ?? []
    const statusFilter = url.searchParams.get("status")?.split(",").filter(Boolean) ?? []
    const simMin = url.searchParams.get("simMin")
    const simMax = url.searchParams.get("simMax")
    const usageMin = url.searchParams.get("usageMin")
    const usageMax = url.searchParams.get("usageMax")
    const dateFrom = url.searchParams.get("dateFrom")
    const dateTo = url.searchParams.get("dateTo")
    const sortBy = url.searchParams.get("sortBy") ?? "timestamp"
    const sortDir = url.searchParams.get("sortDir") ?? "desc"

    let results: MemoryEntryBase[] = memoryFixture

    if (search) {
      results = results.filter(
        (item) =>
          item.id.toLowerCase().includes(search) ||
          item.summary.toLowerCase().includes(search) ||
          item.tags.some((tag) => tag.toLowerCase().includes(search)),
      )
    }
    if (typeFilter.length > 0) {
      results = results.filter((item) => typeFilter.includes(item.memory_type))
    }
    if (statusFilter.length > 0) {
      results = results.filter((item) => statusFilter.includes(item.status))
    }
    if (simMin) {
      const min = Number(simMin)
      results = results.filter((item) => item.similarity_score !== null && item.similarity_score >= min)
    }
    if (simMax) {
      const max = Number(simMax)
      results = results.filter((item) => item.similarity_score !== null && item.similarity_score <= max)
    }
    if (usageMin) {
      results = results.filter((item) => item.usage_count >= Number(usageMin))
    }
    if (usageMax) {
      results = results.filter((item) => item.usage_count <= Number(usageMax))
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      results = results.filter((item) => new Date(item.timestamp).getTime() >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86_400_000
      results = results.filter((item) => new Date(item.timestamp).getTime() <= to)
    }

    results = [...results].sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1
      return compareValues(a[sortBy as keyof MemoryEntryBase], b[sortBy as keyof MemoryEntryBase]) * direction
    })

    const total = results.length
    const start = (page - 1) * pageSize
    const paged = results.slice(start, start + pageSize)

    return HttpResponse.json({ data: paged, total })
  }),
]
