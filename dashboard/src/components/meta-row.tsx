import type { ReactNode } from "react"

interface MetaRowProps {
  label: string
  value: ReactNode
}

/** Label/value row used in metadata panels — Conversation Detail's ticket metadata card, Live
 * Agent Execution's overview sidebar and Node Inspector. */
export function MetaRow({ label, value }: MetaRowProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
