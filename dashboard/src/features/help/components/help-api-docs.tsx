import { ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ApiDocLink } from "@/types/mocked"

interface HelpApiDocsProps {
  docs: ApiDocLink[]
}

const METHOD_BADGE_VARIANT: Record<string, "secondary" | "outline"> = {
  GET: "secondary",
  POST: "outline",
}

export function HelpApiDocs({ docs }: HelpApiDocsProps) {
  return (
    <div className="space-y-2">
      {docs.map((doc) => (
        <Card key={doc.id}>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {doc.method && (
                  <Badge variant={METHOD_BADGE_VARIANT[doc.method] ?? "outline"} className="font-mono">
                    {doc.method}
                  </Badge>
                )}
                <p className="truncate text-sm font-medium text-foreground">{doc.label}</p>
              </div>
              {doc.path && <code className="mt-1 block font-mono text-xs text-muted-foreground">{doc.path}</code>}
              <p className="mt-1 text-xs text-muted-foreground">{doc.description}</p>
            </div>
            {doc.url && (
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Open
                <ExternalLink className="size-3" />
              </a>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
