import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryFallbackProps {
  onReset: () => void
}

/** Shown in place of a crashed page's content — the sidebar/topbar around it stay intact (see
 * app-shell.tsx), so this only has to recover the page itself, not the whole app. "Try again"
 * re-renders the crashed subtree in place; "Reload page" is the guaranteed fallback for state that
 * "Try again" can't clear on its own. */
export function ErrorBoundaryFallback({ onReset }: ErrorBoundaryFallbackProps) {
  return (
    <div
      role="alert"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-medium text-foreground">This page hit an unexpected error</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Nothing else in the app was affected — you can try again, reload, or navigate elsewhere
          using the sidebar.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onReset}>
          Try again
        </Button>
        <Button size="sm" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </div>
  )
}
