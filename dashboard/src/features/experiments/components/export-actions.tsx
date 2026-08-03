import { useState, type RefObject } from "react"
import { Download, FileText, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { downloadTextFile, exportSvgAsPng, rowsToCsv, rowsToMarkdown } from "@/features/experiments/export"
import type { ExperimentTableRow } from "@/features/experiments/columns"

interface ExportActionsProps {
  rows: ExperimentTableRow[]
  chartContainerRef: RefObject<HTMLDivElement | null>
}

/** CSV, PNG chart, and Markdown summary export — all client-side (Blob download / canvas
 * rasterization), no backend endpoint involved, operating only on data already loaded on the
 * page. */
export function ExportActions({ rows, chartContainerRef }: ExportActionsProps) {
  const [isExportingPng, setIsExportingPng] = useState(false)
  const hasRows = rows.length > 0

  function handleCsvExport(): void {
    downloadTextFile(rowsToCsv(rows), "experiment-comparison.csv", "text/csv;charset=utf-8")
    toast.success("CSV exported")
  }

  function handleMarkdownExport(): void {
    downloadTextFile(rowsToMarkdown(rows), "experiment-comparison.md", "text/markdown;charset=utf-8")
    toast.success("Markdown summary exported")
  }

  async function handlePngExport(): Promise<void> {
    // The container also holds small <svg> legend swatch icons (Legend iconType="circle") —
    // querySelector("svg") would grab whichever one is first in the DOM, not necessarily the
    // chart itself. Pick the largest by rendered area instead.
    const candidates = Array.from(chartContainerRef.current?.querySelectorAll("svg") ?? [])
    const svg = candidates.reduce<SVGSVGElement | null>((largest, current) => {
      const currentArea = current.getBoundingClientRect().width * current.getBoundingClientRect().height
      const largestArea = largest ? largest.getBoundingClientRect().width * largest.getBoundingClientRect().height : 0
      return currentArea > largestArea ? current : largest
    }, null)
    if (!svg) {
      toast.error("Chart isn't ready yet")
      return
    }
    setIsExportingPng(true)
    try {
      await exportSvgAsPng(svg, "resolution-rate-comparison.png")
      toast.success("Chart exported")
    } catch {
      toast.error("Could not export chart")
    } finally {
      setIsExportingPng(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCsvExport} disabled={!hasRows} aria-label="Export CSV">
        <Download className="size-3.5" />
        <span className="hidden sm:inline">CSV</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => void handlePngExport()}
        disabled={isExportingPng}
        aria-label="Export chart as PNG"
      >
        <ImageIcon className="size-3.5" />
        <span className="hidden sm:inline">PNG chart</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={handleMarkdownExport}
        disabled={!hasRows}
        aria-label="Export Markdown summary"
      >
        <FileText className="size-3.5" />
        <span className="hidden sm:inline">Markdown</span>
      </Button>
    </div>
  )
}
