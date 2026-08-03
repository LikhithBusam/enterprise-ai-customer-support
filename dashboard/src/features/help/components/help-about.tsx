import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AboutInfo } from "@/types/mocked"

interface HelpAboutProps {
  about: AboutInfo
}

export function HelpAbout({ about }: HelpAboutProps) {
  const rows: Array<[string, string]> = [
    ["Application", about.app_name],
    ["Version", about.version],
    ["License", about.license],
    ["Environment", about.environment],
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">About this application</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-foreground">{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
