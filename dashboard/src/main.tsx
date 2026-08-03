import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import "./index.css"
import { AppProviders } from "@/app/providers"
import { router } from "@/app/routes"
import { ErrorBoundary } from "@/components/error-boundary"
import { RootErrorFallback } from "@/app/root-error-fallback"

/** Mocks are on by default in development and off by default in production — an explicit
 * VITE_ENABLE_MOCKS=true/false always wins (e.g. a staging build that still needs mocks), but an
 * unset var falls back to import.meta.env.DEV rather than defaulting "on" everywhere, which is
 * what let MSW ship active in `npm run build` output with no way to tell it apart from a real
 * backend. */
function shouldEnableMocks(): boolean {
  const override = import.meta.env.VITE_ENABLE_MOCKS
  if (override === "true") return true
  if (override === "false") return false
  return import.meta.env.DEV
}

async function bootstrap(): Promise<void> {
  const enableMocks = shouldEnableMocks()
  if (enableMocks) {
    const { startMockWorker } = await import("@/services/mock/browser")
    await startMockWorker()
  }

  const rootElement = document.getElementById("root")
  if (!rootElement) {
    throw new Error("Root element (#root) not found")
  }

  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary fallback={() => <RootErrorFallback />}>
        <AppProviders>
          <RouterProvider router={router} />
        </AppProviders>
      </ErrorBoundary>
    </StrictMode>,
  )
}

void bootstrap()
