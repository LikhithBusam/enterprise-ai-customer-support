import { Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { PlanBadge } from "@/features/clients/components/plan-badge"
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge"
import type { ClientPlan, ClientStatus } from "@/types/mocked"

interface ClientCardProps {
  name: string
  clientId: string
  plan: ClientPlan
  status: ClientStatus
  size?: "sm" | "lg"
  className?: string
}

/** Client identity block — name, id, plan, status. Reused as the DataTable's compact "Client"
 * cell (size="sm") and the Client Detail panel's header (size="lg"). */
export function ClientCard({ name, clientId, plan, status, size = "sm", className }: ClientCardProps) {
  const iconSize = size === "lg" ? "size-10" : "size-8"

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <div className={cn("flex shrink-0 items-center justify-center rounded-md bg-muted", iconSize)}>
        <Building2 className={size === "lg" ? "size-5 text-muted-foreground" : "size-4 text-muted-foreground"} />
      </div>
      <div className="min-w-0">
        <p className={cn("truncate font-medium text-foreground", size === "lg" ? "text-base" : "text-sm")}>{name}</p>
        {size === "lg" ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="truncate font-mono text-xs text-muted-foreground">{clientId}</span>
            <PlanBadge plan={plan} />
            <ClientStatusBadge status={status} />
          </div>
        ) : (
          <p className="truncate text-xs text-muted-foreground">{clientId}</p>
        )}
      </div>
    </div>
  )
}
