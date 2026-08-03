import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface SettingsCardProps {
  title: string
  description?: string
  children: ReactNode
}

/** Outer shell every Settings section uses — title/description header plus content. Each
 * section's own <form> (fields + SettingsActions) is passed as children. */
export function SettingsCard({ title, description, children }: SettingsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
