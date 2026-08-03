import { dashboardHandlers } from "@/services/mock/handlers/dashboard"
import { conversationsHandlers } from "@/services/mock/handlers/conversations"
import { executionHandlers } from "@/services/mock/handlers/execution"
import { memoryHandlers } from "@/services/mock/handlers/memory"
import { toolsHandlers } from "@/services/mock/handlers/tools"
import { analyticsHandlers } from "@/services/mock/handlers/analytics"
import { experimentsHandlers } from "@/services/mock/handlers/experiments"
import { clientsHandlers } from "@/services/mock/handlers/clients"
import { settingsHandlers } from "@/services/mock/handlers/settings"
import { auditHandlers } from "@/services/mock/handlers/audit"
import { profileHandlers } from "@/services/mock/handlers/profile"
import { helpHandlers } from "@/services/mock/handlers/help"

/**
 * Combined MSW handler list. `/health` and `/v1/tickets` are deliberately NOT mocked here —
 * they hit the real backend (src/api/main.py) and pass through unhandled by MSW
 * (see services/mock/browser.ts's onUnhandledRequest: "bypass").
 *
 * Add one array per resource here as each feature is built (see the Implementation Strategy in
 * the approved plan).
 */
export const handlers = [
  ...dashboardHandlers,
  ...conversationsHandlers,
  ...executionHandlers,
  ...memoryHandlers,
  ...toolsHandlers,
  ...analyticsHandlers,
  ...experimentsHandlers,
  ...clientsHandlers,
  ...settingsHandlers,
  ...auditHandlers,
  ...profileHandlers,
  ...helpHandlers,
]
