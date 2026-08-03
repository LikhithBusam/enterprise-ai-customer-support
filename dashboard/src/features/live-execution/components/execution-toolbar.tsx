import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"
import { Panel, useReactFlow } from "@xyflow/react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface ExecutionToolbarProps {
  onReset: () => void
}

/** Overlay controls for the execution graph — zoom, fit-to-screen, and reset (fit view + clear
 * node selection). Must render inside a <ReactFlow> tree so useReactFlow() resolves. */
export function ExecutionToolbar({ onReset }: ExecutionToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  function handleReset(): void {
    onReset()
    void fitView({ duration: 300 })
  }

  return (
    <Panel position="top-right" className="flex gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={() => void zoomIn()}>
            <ZoomIn className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom in</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={() => void zoomOut()}>
            <ZoomOut className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom out</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Fit to screen"
            onClick={() => void fitView({ duration: 300 })}
          >
            <Maximize2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Fit to screen</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Reset view" onClick={handleReset}>
            <RotateCcw className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reset view</TooltipContent>
      </Tooltip>
    </Panel>
  )
}
