import {
  Compass,
  MessagesSquare,
  BrainCircuit,
  Wrench,
  BarChart3,
  FlaskConical,
  Building2,
  ShieldCheck,
  Settings as SettingsIcon,
  Plug,
  type LucideIcon,
} from "lucide-react"
import type { HelpCategoryKey } from "@/types/mocked"

/** Mirrors nav-config.ts's per-section icon where a section maps 1:1 to a sidebar item (memory,
 * tools, analytics, experiments, clients, settings); the remaining categories don't have a direct
 * nav equivalent and get their own icon. */
export const CATEGORY_ICONS: Record<HelpCategoryKey, LucideIcon> = {
  getting_started: Compass,
  conversations: MessagesSquare,
  memory: BrainCircuit,
  tools: Wrench,
  analytics: BarChart3,
  experiments: FlaskConical,
  clients: Building2,
  audit_security: ShieldCheck,
  settings: SettingsIcon,
  api_integrations: Plug,
}
