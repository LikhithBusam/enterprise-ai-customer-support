import { Link } from "react-router-dom"
import { ShieldCheck, ShieldX } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatRelativeTime } from "@/lib/format"
import type { ProfileSecuritySummary } from "@/types/mocked"

interface SecuritySummaryCardProps {
  security: ProfileSecuritySummary
}

/** Read-only — organization-wide security policy (MFA enforcement, IP allow list, session
 * timeout) lives on Settings → Security; this card only reports this account's current status. */
export function SecuritySummaryCard({ security }: SecuritySummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Security Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Multi-factor authentication</span>
          {security.mfa_enabled ? (
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="size-3" />
              Enabled
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <ShieldX className="size-3" />
              Disabled
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Last sign-in</span>
          <span className="text-xs font-medium text-foreground">{formatRelativeTime(security.last_login_at)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Last password change</span>
          <span className="text-xs font-medium text-foreground">
            {formatRelativeTime(security.last_password_change_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Active sessions</span>
          <span className="text-xs font-medium text-foreground">{security.active_sessions}</span>
        </div>
        <div className="pt-1">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/settings?section=security">Manage security settings</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
