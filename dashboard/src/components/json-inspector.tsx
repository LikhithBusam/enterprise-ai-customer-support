import { useState } from "react"
import { ChevronRight, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface JsonInspectorProps {
  title: string
  data: unknown
  defaultOpen?: boolean
}

/** A lightweight, self-contained collapsible — not built on shadcn's Accordion/Collapsible
 * primitives, since a single disclosure block doesn't need that primitive's group-management
 * overhead, and it avoids introducing another untested Radix wrapper for one simple toggle.
 * Shared across Conversation Detail and Live Agent Execution's Node Inspector. */
export function JsonInspector({ title, data, defaultOpen = false }: JsonInspectorProps) {
  const [open, setOpen] = useState(defaultOpen)
  const json = JSON.stringify(data, null, 2)

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(json)
    toast.success("Copied to clipboard")
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium">
        <button
          type="button"
          className="flex items-center gap-1.5 text-left"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
          {title}
        </button>
        {open && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Copy JSON"
            onClick={() => void handleCopy()}
          >
            <Copy className="size-3.5" />
          </Button>
        )}
      </div>
      {open && (
        <pre className="max-h-80 overflow-auto border-t border-border bg-muted/30 p-3 text-xs">
          {json}
        </pre>
      )}
    </div>
  )
}
