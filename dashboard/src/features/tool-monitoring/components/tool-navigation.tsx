import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ToolHealthCard } from "@/features/tool-monitoring/components/tool-health-card"
import type { ToolHealth } from "@/types/mocked"

interface ToolNavigationProps {
  tools: ToolHealth[]
  selectedToolName: string | null
  onSelectTool: (toolName: string) => void
}

/** Left panel — every tool the multi-agent system can call, each showing status/latency/success
 * rate/error count at a glance. Selecting one highlights it here and opens it in the inspector. */
export function ToolNavigation({ tools, selectedToolName, onSelectTool }: ToolNavigationProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Tools</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {tools.map((tool) => (
          <ToolHealthCard
            key={tool.tool_name}
            tool={tool}
            active={tool.tool_name === selectedToolName}
            onClick={() => onSelectTool(tool.tool_name)}
          />
        ))}
      </CardContent>
    </Card>
  )
}
