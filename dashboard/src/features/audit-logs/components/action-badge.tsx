import { Cog, Database, KeyRound, Server, ShieldAlert, UserCheck, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AuditCategory } from "@/types/mocked"

const CONFIG: Record<AuditCategory, { label: string; icon: LucideIcon; textClassName: string }> = {
  security: { label: "Security", icon: ShieldAlert, textClassName: "text-destructive" },
  configuration: { label: "Configuration", icon: Cog, textClassName: "text-info" },
  authentication: { label: "Authentication", icon: UserCheck, textClassName: "text-primary" },
  api_key: { label: "API Key", icon: KeyRound, textClassName: "text-warning" },
  data: { label: "Data", icon: Database, textClassName: "text-success" },
  system: { label: "System", icon: Server, textClassName: "text-muted-foreground" },
}

interface ActionBadgeProps {
  category: AuditCategory
  className?: string
}

/** Fixed category → icon+color mapping — the audit-log analog of PlanBadge/HealthBadge, labeling
 * *what kind* of action an entry represents (security/configuration/authentication/...). */
export function ActionBadge({ category, className }: ActionBadgeProps) {
  const config = CONFIG[category]
  const Icon = config.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium",
        config.textClassName,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {config.label}
    </span>
  )
}
