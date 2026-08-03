import { z } from "zod"
import type { HelpCategoryKey } from "@/types/mocked"

const helpSearchSchema = z.object({
  search: z.string().catch(""),
  category: z.string().catch(""),
})

export interface HelpSearchParams {
  search: string
  category: HelpCategoryKey | ""
}

export function parseHelpSearchParams(params: URLSearchParams): HelpSearchParams {
  const parsed = helpSearchSchema.parse({
    search: params.get("search") ?? "",
    category: params.get("category") ?? "",
  })
  return { search: parsed.search, category: parsed.category as HelpCategoryKey | "" }
}

export function buildHelpSearchParams(params: HelpSearchParams): URLSearchParams {
  const next = new URLSearchParams()
  if (params.search) next.set("search", params.search)
  if (params.category) next.set("category", params.category)
  return next
}
