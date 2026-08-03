import { Suspense, useEffect, useRef, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { CommandPalette } from "@/components/layout/command-palette"
import { NAV_GROUPS } from "@/components/layout/nav-config"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ErrorBoundary } from "@/components/error-boundary"
import { ErrorBoundaryFallback } from "@/components/status/error-boundary-fallback"
import { RouteLoadingFallback } from "@/components/status/route-loading-fallback"

const GO_TO_TIMEOUT_MS = 1000

/** True while any Radix-driven overlay (Dialog, AlertDialog, Sheet — which is built on Dialog —
 * DropdownMenu, Select, or a Command palette/combobox popover) is open. Radix unmounts closed
 * overlay content rather than just hiding it, so presence of one of these roles in the DOM is
 * itself the "is something open" signal — no separate open/closed state to keep in sync. */
function isOverlayOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]') !== null
}

export function AppShell() {
  const isTablet = useMediaQuery("(max-width: 1279px)")
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const pendingGoTo = useRef(false)

  useEffect(() => {
    setCollapsed(isTablet)
  }, [isTablet])

  // "g then x" section navigation (Linear-style), ignored while typing in a form field.
  useEffect(() => {
    const shortcutMap = new Map(
      NAV_GROUPS.flatMap((group) => group.items).map((item) => [item.shortcutKey, item.path]),
    )

    function handleKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable
      if (isTyping || event.metaKey || event.ctrlKey || event.altKey || isOverlayOpen()) return

      if (event.key.toLowerCase() === "g") {
        pendingGoTo.current = true
        window.setTimeout(() => {
          pendingGoTo.current = false
        }, GO_TO_TIMEOUT_MS)
        return
      }

      if (pendingGoTo.current) {
        const path = shortcutMap.get(event.key.toLowerCase())
        if (path) {
          pendingGoTo.current = false
          navigate(path)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [navigate])

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((value) => !value)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
          {/* Keyed on pathname so navigating away from a crashed page (via the sidebar, which
              stays interactive because this boundary doesn't wrap it) mounts a fresh boundary
              instead of carrying a stale crashed state into the next route. */}
          <ErrorBoundary key={location.pathname} fallback={(reset) => <ErrorBoundaryFallback onReset={reset} />}>
            <Suspense fallback={<RouteLoadingFallback />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
