import { Link } from "react-router-dom"
import { ArrowRight, Search } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/status/empty-state"
import type { HelpQuickLink } from "@/types/mocked"

interface HelpQuickLinksProps {
  links: HelpQuickLink[]
}

export function HelpQuickLinks({ links }: HelpQuickLinksProps) {
  if (links.length === 0) {
    return <EmptyState icon={Search} title="No quick links match your search" />
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((link) => (
        <Card key={link.id} className="transition-colors hover:border-primary/50">
          <CardContent>
            <Link
              to={link.path}
              className="flex items-start justify-between gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{link.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{link.description}</p>
              </div>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
