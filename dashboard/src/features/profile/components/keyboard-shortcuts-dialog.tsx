import { useState } from "react"
import { Keyboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { NAV_GROUPS } from "@/components/layout/nav-config"

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
      {children}
    </kbd>
  )
}

const GO_TO_SHORTCUTS = NAV_GROUPS.flatMap((group) => group.items)

/** A static reference for the shortcuts app-shell.tsx and command-palette.tsx already implement —
 * not a new capability, just making the existing ones discoverable from Profile → Preferences. */
export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Keyboard className="size-3.5" />
          View keyboard shortcuts
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Available anywhere in the app, except while typing in a field.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-foreground">Open command palette</span>
            <Kbd>⌘K</Kbd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-foreground">Close a dialog or drawer</span>
            <Kbd>Esc</Kbd>
          </div>
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Go to page — press G, then:</p>
            <div className="space-y-2">
              {GO_TO_SHORTCUTS.map((item) => (
                <div key={item.path} className="flex items-center justify-between gap-4">
                  <span className="text-foreground">{item.label}</span>
                  <Kbd>{item.shortcutKey.toUpperCase()}</Kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
