import { cn } from "@/lib/utils"
import type { AuditSeverity } from "@/types/mocked"

const CONFIG: Record<AuditSeverity, { label: string; dotClassName: string; textClassName: string }> = {
  info: { label: "Info", dotClassName: "bg-muted-foreground", textClassName: "text-muted-foreground" },
  low: { label: "Low", dotClassName: "bg-success", textClassName: "text-success" },
  medium: { label: "Medium", dotClassName: "bg-warning", textClassName: "text-warning" },
  high: { label: "High", dotClassName: "bg-destructive", textClassName: "text-destructive" },
  critical: { label: "Critical", dotClassName: "bg-destructive", textClassName: "text-destructive" },
}

interface SeverityBadgeProps {
  severity: AuditSeverity
  className?: string
}

/** Fixed, escalating severity → color mapping (info/low/medium green-to-red, critical adds a
 * pulse) — same dot+label shape as every other status badge in the app. */
export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = CONFIG[severity]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium",
        config.textClassName,
        className,
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", config.dotClassName, severity === "critical" && "animate-pulse")}
        aria-hidden="true"
      />
      {config.label}
    </span>
  )
}
