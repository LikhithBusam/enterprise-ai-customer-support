import { History } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/status/empty-state"
import { formatRelativeTime } from "@/lib/format"
import type { ProfileActivityEntry } from "@/types/mocked"

interface RecentActivityCardProps {
  activity: ProfileActivityEntry[]
}

/** Same row shape/visual language as Client Management's recent-activity list
 * (client-detail.tsx) — substituting IP address for actor, since every entry here is this
 * account's own activity. */
export function RecentActivityCard({ activity }: RecentActivityCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {activity.length === 0 ? (
          <EmptyState icon={History} title="No recent activity" />
        ) : (
          activity.slice(0, 8).map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{entry.action}</p>
                <p className="truncate text-muted-foreground">{entry.ip_address}</p>
              </div>
              <time className="shrink-0 text-muted-foreground">{formatRelativeTime(entry.timestamp)}</time>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
