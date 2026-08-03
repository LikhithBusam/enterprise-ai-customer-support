import { Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface SecretFieldProps {
  label: string
  value: string
  description?: string
}

/** Read-only masked secret display with copy-to-clipboard. There is no "reveal" toggle: the
 * backend only ever returns the last 4 characters of an API key (see API_CONTRACT.md and Client
 * Management's identical maskApiKey() convention) — the full value never reaches the frontend, so
 * there is nothing behind the mask to reveal. */
export function SecretField({ label, value, description }: SecretFieldProps) {
  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(value)
    toast.success("Copied to clipboard")
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-1.5">
        <code className="flex-1 truncate rounded-md border border-input bg-muted/30 px-2.5 py-1.5 font-mono text-xs text-foreground">
          {value}
        </code>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Copy to clipboard" onClick={() => void handleCopy()}>
          <Copy className="size-3.5" />
        </Button>
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}
