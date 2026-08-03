import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SettingsSectionProps {
  children: ReactNode
  className?: string
}

/** Vertical field-group spacing shared by every section card's form body. */
export function SettingsSection({ children, className }: SettingsSectionProps) {
  return <div className={cn("space-y-4", className)}>{children}</div>
}
