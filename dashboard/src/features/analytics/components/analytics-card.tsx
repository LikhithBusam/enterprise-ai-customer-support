import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AnalyticsCardProps {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

/** Generic titled panel — the base "box" shared by chart panels, table panels, and the insights
 * row, so every Analytics section reads as one visual system instead of ad hoc cards. */
export function AnalyticsCard({ title, action, children, className, contentClassName }: AnalyticsCardProps) {
  return (
    <Card size="sm" className={className}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent className={cn(contentClassName)}>{children}</CardContent>
    </Card>
  )
}
