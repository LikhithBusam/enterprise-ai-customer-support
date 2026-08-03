import type { FaqEntry, HelpQuickLink, HelpResponse, TroubleshootingEntry } from "@/types/mocked"
import type { HelpSearchParams } from "@/features/help/search-params"

function matches(haystack: string[], needle: string): boolean {
  const lower = needle.trim().toLowerCase()
  if (!lower) return true
  return haystack.some((value) => value.toLowerCase().includes(lower))
}

export interface FilteredHelpContent {
  faqs: FaqEntry[]
  troubleshooting: TroubleshootingEntry[]
  quickLinks: HelpQuickLink[]
  isFiltering: boolean
}

/** Search and category filtering both happen client-side over the single GET /v1/help payload —
 * there's no dedicated search endpoint since the whole dataset is small and static (see
 * HelpResponse's doc comment in types/mocked.ts). Category only scopes FAQs/Troubleshooting,
 * since Quick Links aren't category-tagged; search applies everywhere it has a category or field. */
export function filterHelpContent(data: HelpResponse, params: HelpSearchParams): FilteredHelpContent {
  const { search, category } = params
  const isFiltering = search.trim().length > 0 || category.length > 0

  const faqs = data.faqs.filter(
    (faq) => (!category || faq.category === category) && matches([faq.question, faq.answer], search),
  )

  const troubleshooting = data.troubleshooting.filter(
    (entry) =>
      (!category || entry.category === category) && matches([entry.issue, entry.solution], search),
  )

  const quickLinks = data.quick_links.filter((link) => matches([link.label, link.description], search))

  return { faqs, troubleshooting, quickLinks, isFiltering }
}
