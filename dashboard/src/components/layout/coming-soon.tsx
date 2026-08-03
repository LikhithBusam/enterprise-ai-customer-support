import { Construction } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/status/empty-state"

interface ComingSoonProps {
  title: string
}

/** Placeholder for routes not yet built, per the approved feature-by-feature build order. */
export function ComingSoon({ title }: ComingSoonProps) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="p-6">
        <EmptyState
          icon={Construction}
          title={`${title} is being built`}
          description="This feature is scheduled in the current build order — check back soon."
        />
      </div>
    </div>
  )
}
