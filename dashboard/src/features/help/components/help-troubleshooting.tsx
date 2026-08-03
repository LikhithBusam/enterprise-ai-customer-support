import { Wrench } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/status/empty-state"
import type { TroubleshootingEntry } from "@/types/mocked"

interface HelpTroubleshootingProps {
  entries: TroubleshootingEntry[]
}

export function HelpTroubleshooting({ entries }: HelpTroubleshootingProps) {
  if (entries.length === 0) {
    return <EmptyState icon={Wrench} title="No troubleshooting entries match your search" />
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <Card key={entry.id}>
          <CardContent className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{entry.issue}</p>
            <p className="text-sm text-muted-foreground">{entry.solution}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
