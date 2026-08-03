import { Loader2 } from "lucide-react"

/** Suspense fallback for lazy-loaded routes (see routes.tsx). Deliberately generic rather than
 * shaped like any one page — it can't know which page is loading, and a skeleton shaped for the
 * wrong page reads as more broken than a plain spinner. On a fast connection this chunk fetch is
 * usually sub-100ms, so this is rarely on screen long enough to matter — it exists for the slow-
 * network case, not as a design centerpiece. */
export function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Loading page…</span>
    </div>
  )
}
