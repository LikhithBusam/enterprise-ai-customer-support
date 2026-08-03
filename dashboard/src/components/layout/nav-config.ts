import {
  LayoutDashboard,
  MessagesSquare,
  Radio,
  BrainCircuit,
  Wrench,
  BarChart3,
  FlaskConical,
  Building2,
  ScrollText,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  /** Single-letter (or short) key for the "g then x" go-to shortcut. */
  shortcutKey: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", path: "/", icon: LayoutDashboard, shortcutKey: "d" }],
  },
  {
    label: "Operations",
    items: [
      { label: "Conversations", path: "/conversations", icon: MessagesSquare, shortcutKey: "c" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Memory Explorer", path: "/memory", icon: BrainCircuit, shortcutKey: "m" },
      { label: "Tool Monitoring", path: "/tools", icon: Wrench, shortcutKey: "t" },
      { label: "Analytics", path: "/analytics", icon: BarChart3, shortcutKey: "a" },
    ],
  },
  {
    label: "Research",
    items: [
      { label: "Experiment Dashboard", path: "/experiments", icon: FlaskConical, shortcutKey: "e" },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Client Management", path: "/clients", icon: Building2, shortcutKey: "l" },
      { label: "Audit Logs", path: "/audit-logs", icon: ScrollText, shortcutKey: "u" },
      { label: "Settings", path: "/settings", icon: SettingsIcon, shortcutKey: "s" },
    ],
  },
]

/** The Live Agent Execution route is intentionally excluded from this static nav list — it's
 * reached contextually from a conversation, not from the sidebar (per the approved IA). */
export const LIVE_EXECUTION_ICON = Radio
