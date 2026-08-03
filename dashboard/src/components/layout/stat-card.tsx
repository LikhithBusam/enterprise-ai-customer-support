import type { LucideIcon } from "lucide-react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

interface StatCardProps {
  label: string
  value: string
  icon?: LucideIcon
  trend?: {
    direction: "up" | "down"
    value: string
    /** Whether an upward trend is good (e.g. resolution rate) or bad (e.g. escalation rate). */
    isPositive: boolean
  }
}

export function StatCard({ label, value, icon: Icon, trend }: StatCardProps) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="px-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {Icon && <Icon className="size-4 text-muted-foreground" />}
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {trend && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                trend.isPositive ? "text-success" : "text-destructive",
              )}
            >
              {trend.direction === "up" ? (
                <ArrowUp className="size-3" />
              ) : (
                <ArrowDown className="size-3" />
              )}
              {trend.value}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
