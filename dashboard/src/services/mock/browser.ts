import { setupWorker } from "msw/browser"
import { handlers } from "@/services/mock/handlers"

export const worker = setupWorker(...handlers)

/** Starts MSW. Real, unmocked requests (`/health`, `/v1/tickets`) pass through to the actual
 * backend untouched — only requests matching a registered handler are intercepted. */
export async function startMockWorker(): Promise<void> {
  await worker.start({
    onUnhandledRequest: "bypass",
    quiet: true,
  })
}
