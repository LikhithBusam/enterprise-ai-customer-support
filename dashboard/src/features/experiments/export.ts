import { experimentArmLabel } from "@/lib/experiment-arms"
import { formatDuration } from "@/lib/format"
import type { ExperimentTableRow } from "@/features/experiments/columns"

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

const CSV_HEADERS = [
  "Experiment",
  "Failure Rate",
  "Resolved",
  "Total",
  "Resolution Rate",
  "Avg Latency (ms)",
  "Avg Retries",
  "Avg Tool Calls",
  "Memory Hit Rate",
  "Retrieval Distance",
  "Policy Retrieval Rate",
  "Policy Reuse Rate",
  "P-value",
  "Significant",
]

export function rowsToCsv(rows: ExperimentTableRow[]): string {
  const lines = [CSV_HEADERS.join(",")]
  for (const row of rows) {
    const cells = [
      experimentArmLabel(row.arm),
      row.failure_rate,
      String(row.resolved),
      String(row.total),
      row.resolution_rate.toFixed(4),
      row.avg_latency_ms === null ? "" : String(row.avg_latency_ms),
      row.avg_replans.toFixed(2),
      row.avg_tool_calls.toFixed(2),
      row.memory_hit_rate === null ? "" : row.memory_hit_rate.toFixed(4),
      row.retrieval_distance === null ? "" : row.retrieval_distance.toFixed(4),
      row.policy_retrieval_rate === null ? "" : row.policy_retrieval_rate.toFixed(4),
      row.policy_reuse_rate === null ? "" : row.policy_reuse_rate.toFixed(4),
      row.p_value === null ? "" : row.p_value.toFixed(5),
      row.significant === null ? "" : String(row.significant),
    ]
    lines.push(cells.map(csvEscape).join(","))
  }
  return lines.join("\n")
}

export function rowsToMarkdown(rows: ExperimentTableRow[]): string {
  const header = "| Experiment | Failure Rate | Resolution | Avg Latency | Avg Retries | Avg Tool Calls | Memory Hits | P-value | Significant? |"
  const divider = "|---|---|---|---|---|---|---|---|---|"
  const lines = ["# Experiment Comparison", "", header, divider]
  for (const row of rows) {
    lines.push(
      `| ${experimentArmLabel(row.arm)} | ${row.failure_rate} | ${row.resolved}/${row.total} (${(row.resolution_rate * 100).toFixed(1)}%) | ` +
        `${row.avg_latency_ms === null ? "n/a" : formatDuration(row.avg_latency_ms)} | ${row.avg_replans.toFixed(2)} | ${row.avg_tool_calls.toFixed(2)} | ` +
        `${row.memory_hit_rate === null ? "n/a" : `${(row.memory_hit_rate * 100).toFixed(1)}%`} | ` +
        `${row.p_value === null ? "—" : row.p_value.toFixed(5)} | ${row.significant === null ? "—" : row.significant ? "yes" : "no"} |`,
    )
  }
  lines.push("", "_Source: experiments/results/{policy_memory_validation,v2_full_ablation}/report.md — Support Console export._")
  return lines.join("\n")
}

export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

/** Every fill/stroke in these charts is a CSS custom property reference (e.g.
 * `var(--color-chart-2)`) so it repaints correctly on a theme switch — but that reference only
 * resolves inside the live document. Once the SVG is serialized to a standalone string and
 * loaded into an <img>, there's no cascade left to resolve it against, so bars/text/gridlines
 * silently render black. Walk the live tree first and bake each element's *computed* (already
 * resolved) fill/stroke into the clone we actually serialize. */
function inlineComputedPaint(liveSvg: SVGSVGElement, cloneSvg: SVGSVGElement): void {
  const liveElements = [liveSvg, ...liveSvg.querySelectorAll<SVGElement>("*")]
  const clonedElements = [cloneSvg, ...cloneSvg.querySelectorAll<SVGElement>("*")]
  liveElements.forEach((liveEl, index) => {
    const clonedEl = clonedElements[index]
    if (!clonedEl) return
    const computed = getComputedStyle(liveEl)
    if (liveEl.getAttribute("fill") && liveEl.getAttribute("fill") !== "none") {
      clonedEl.setAttribute("fill", computed.fill)
    }
    if (liveEl.getAttribute("stroke") && liveEl.getAttribute("stroke") !== "none") {
      clonedEl.setAttribute("stroke", computed.stroke)
    }
  })
}

/** Rasterizes a Recharts SVG to a PNG and triggers a download — no chart-export library needed,
 * just XMLSerializer + an offscreen <img> + <canvas>. Fills the canvas with the current theme's
 * card surface color first since the SVG itself has no opaque background. */
export async function exportSvgAsPng(svg: SVGSVGElement, filename: string): Promise<void> {
  const rect = svg.getBoundingClientRect()
  const scale = 2

  const clone = svg.cloneNode(true) as SVGSVGElement
  inlineComputedPaint(svg, clone)

  let svgString = new XMLSerializer().serializeToString(clone)
  if (!svgString.includes("xmlns=")) {
    svgString = svgString.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')
  }

  const svgUrl = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("Failed to rasterize chart"))
      image.src = svgUrl
    })

    const canvas = document.createElement("canvas")
    canvas.width = rect.width * scale
    canvas.height = rect.height * scale
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas 2D not supported")

    const isDark = document.documentElement.classList.contains("dark")
    ctx.scale(scale, scale)
    ctx.fillStyle = isDark ? "#171717" : "#ffffff"
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.drawImage(image, 0, 0, rect.width, rect.height)

    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
    if (!pngBlob) throw new Error("Failed to encode PNG")

    const link = document.createElement("a")
    link.href = URL.createObjectURL(pngBlob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}
