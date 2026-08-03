import { Database } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MemoryTypeCard } from "@/features/memory-explorer/components/memory-type-card"
import { MEMORY_TYPES, MEMORY_TYPE_DESCRIPTIONS, MEMORY_TYPE_ICONS, MEMORY_TYPE_LABELS } from "@/lib/memory-types"
import type { MemoryTypeBreakdown } from "@/types/mocked"

interface MemoryTypeNavProps {
  byType: MemoryTypeBreakdown[]
  totalCount: number
  selectedTypes: string[]
  onSelectType: (type: string | null) => void
}

/** Left panel — Memory Type Navigation. Selecting a category sets the table's `types` filter to
 * exactly that type; the toolbar's Type filter reads/writes the same URL param, so the two stay
 * in sync without any extra coordination. */
export function MemoryTypeNav({ byType, totalCount, selectedTypes, onSelectType }: MemoryTypeNavProps) {
  const countFor = (type: string) => byType.find((entry) => entry.memory_type === type)?.count ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Memory Types</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <MemoryTypeCard
          icon={Database}
          label="All Types"
          description="Every memory entry stored for this client."
          count={totalCount}
          active={selectedTypes.length === 0}
          onClick={() => onSelectType(null)}
        />
        {MEMORY_TYPES.map((type) => (
          <MemoryTypeCard
            key={type}
            icon={MEMORY_TYPE_ICONS[type]}
            label={MEMORY_TYPE_LABELS[type]}
            description={MEMORY_TYPE_DESCRIPTIONS[type]}
            count={countFor(type)}
            active={selectedTypes.length === 1 && selectedTypes[0] === type}
            isResearch={type === "policy"}
            onClick={() => onSelectType(type)}
          />
        ))}
      </CardContent>
    </Card>
  )
}
