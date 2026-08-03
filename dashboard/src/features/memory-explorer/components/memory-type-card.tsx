import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

interface MemoryTypeCardProps {
  icon: LucideIcon
  label: string
  description: string
  count: number
  active: boolean
  isResearch?: boolean
  onClick: () => void
}

/** One row in the Memory Type Navigation — icon, count, and description per category. Also the
 * app's reusable "MemoryCard" building block (icon/count/description), just rendered compactly
 * enough to stack as a left-panel list rather than a full grid card. */
export function MemoryTypeCard({
  icon: Icon,
  label,
  description,
  count,
  active,
  isResearch,
  onClick,
}: MemoryTypeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-primary/30 bg-muted ring-1 ring-primary/20"
          : "border-transparent hover:bg-muted/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
          <span className="truncate text-sm font-medium text-foreground">{label}</span>
          {isResearch && (
            <Badge variant="outline" className="shrink-0 font-normal text-[10px]">
              Research
            </Badge>
          )}
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {formatNumber(count)}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
    </button>
  )
}
