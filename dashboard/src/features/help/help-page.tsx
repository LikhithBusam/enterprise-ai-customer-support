import { useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { PageHeader } from "@/components/layout/page-header"
import { ErrorState } from "@/components/status/error-state"
import { NodeInspectorSkeleton } from "@/components/status/skeletons"
import { HelpToolbar } from "@/features/help/components/help-toolbar"
import { HelpCategories } from "@/features/help/components/help-categories"
import { HelpQuickLinks } from "@/features/help/components/help-quick-links"
import { HelpFaq } from "@/features/help/components/help-faq"
import { HelpTroubleshooting } from "@/features/help/components/help-troubleshooting"
import { HelpApiDocs } from "@/features/help/components/help-api-docs"
import { HelpSupportContact } from "@/features/help/components/help-support-contact"
import { HelpAbout } from "@/features/help/components/help-about"
import { KeyboardShortcutsDialog } from "@/features/profile/components/keyboard-shortcuts-dialog"
import { useHelp } from "@/features/help/hooks"
import { filterHelpContent } from "@/features/help/filter-help"
import { buildHelpSearchParams, parseHelpSearchParams, type HelpSearchParams } from "@/features/help/search-params"
import type { HelpCategoryKey } from "@/types/mocked"

export function HelpPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseHelpSearchParams(searchParams), [searchParams])
  const helpQuery = useHelp()

  function updateParams(patch: Partial<HelpSearchParams>): void {
    setSearchParams(buildHelpSearchParams({ ...params, ...patch }), { replace: true })
  }

  const filtered = useMemo(
    () => (helpQuery.data ? filterHelpContent(helpQuery.data, params) : null),
    [helpQuery.data, params],
  )

  return (
    <div>
      <PageHeader
        title="Help Center"
        description="Documentation, troubleshooting, and support for this workspace"
      />
      <div className="p-6">
        {helpQuery.isError ? (
          <ErrorState title="Couldn't load the Help Center" onRetry={() => helpQuery.refetch()} />
        ) : !helpQuery.data || !filtered ? (
          <NodeInspectorSkeleton />
        ) : (
          <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
            <div className="min-w-0 space-y-6">
              <HelpToolbar search={params.search} onSearchChange={(value) => updateParams({ search: value })} />

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Categories</h2>
                <HelpCategories
                  categories={helpQuery.data.categories}
                  active={params.category}
                  onSelect={(category: HelpCategoryKey | "") => updateParams({ category })}
                />
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Quick Links</h2>
                <HelpQuickLinks links={filtered.quickLinks} />
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Frequently Asked Questions</h2>
                <HelpFaq faqs={filtered.faqs} />
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Troubleshooting</h2>
                <HelpTroubleshooting entries={filtered.troubleshooting} />
              </section>
            </div>

            <div className="min-w-0 space-y-6">
              <KeyboardShortcutsDialog />

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">API Documentation</h2>
                <HelpApiDocs docs={helpQuery.data.api_docs} />
              </section>

              <HelpSupportContact contacts={helpQuery.data.support_contacts} />
              <HelpAbout about={helpQuery.data.about} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
