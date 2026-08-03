import { Link } from "react-router-dom"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/status/empty-state"
import { ErrorState } from "@/components/status/error-state"
import { NodeInspectorSkeleton } from "@/components/status/skeletons"
import { JsonInspector } from "@/components/json-inspector"
import { MetaRow } from "@/components/meta-row"
import { ConfidenceBadge } from "@/features/memory-explorer/components/confidence-badge"
import { SimilarityBadge } from "@/features/memory-explorer/components/similarity-badge"
import { MemoryStatusBadge } from "@/features/memory-explorer/components/memory-status-badge"
import { MEMORY_TYPE_LABELS } from "@/lib/memory-types"
import { formatRelativeTime } from "@/lib/format"
import type { MemoryEntryBase } from "@/types/mocked"

interface MemoryInspectorProps {
  entry: MemoryEntryBase | null
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

/** Right panel of Memory Explorer — full detail for whichever memory entry is currently
 * selected in the table. */
export function MemoryInspector({ entry, isLoading, isError, onRetry }: MemoryInspectorProps) {
  if (isError) {
    return <ErrorState title="Couldn't load this memory entry" onRetry={onRetry} />
  }

  if (isLoading) {
    return <NodeInspectorSkeleton />
  }

  if (!entry) {
    return (
      <Card>
        <CardContent className="pt-4">
          <EmptyState
            icon={Search}
            title="No memory selected"
            description="Select a row in the table to inspect its full detail."
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="font-mono text-sm font-medium">{entry.id}</CardTitle>
            <MemoryStatusBadge status={entry.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          <MetaRow label="Type" value={MEMORY_TYPE_LABELS[entry.memory_type]} />
          <MetaRow label="Source" value={entry.source} />
          <MetaRow label="Timestamp" value={formatRelativeTime(entry.timestamp)} />
          <MetaRow
            label="Retrieved count"
            value={<span className="tabular-nums">{entry.usage_count}</span>}
          />
          <MetaRow label="Similarity" value={<SimilarityBadge value={entry.similarity_score} />} />
          <MetaRow label="Confidence" value={<ConfidenceBadge value={entry.confidence} />} />
          <MetaRow
            label="Related ticket"
            value={
              entry.related_ticket_id ? (
                <Link
                  to={`/conversations/${entry.related_ticket_id}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {entry.related_ticket_id}
                </Link>
              ) : (
                "—"
              )
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">{entry.summary}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Why this memory matters</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">{entry.explanation}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Tags</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {entry.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="font-normal">
              {tag}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <JsonInspector title="Raw JSON" data={entry} />
    </div>
  )
}
