import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { MetaRow } from "@/components/meta-row"
import { formatNumber } from "@/lib/format"
import type { ClientRateLimits } from "@/types/mocked"

interface RateLimitCardProps {
  rateLimits: ClientRateLimits
}

/** Current request rate against its per-minute and burst limits — used by both the Client Detail
 * panel's Current Limits section and the Client Inspector's configuration section. */
export function RateLimitCard({ rateLimits }: RateLimitCardProps) {
  const pct = Math.round((rateLimits.requests_per_minute / rateLimits.requests_per_minute_limit) * 100)

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Rate limits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Current rate</span>
            <span className="font-medium tabular-nums">
              {formatNumber(rateLimits.requests_per_minute)} / {formatNumber(rateLimits.requests_per_minute_limit)} req/min
            </span>
          </div>
          <Progress value={Math.min(100, pct)} />
        </div>
        <MetaRow label="Burst limit" value={`${formatNumber(rateLimits.burst_limit)} req/min`} />
      </CardContent>
    </Card>
  )
}
