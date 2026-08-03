import { Bell, Building2, Cpu, Database, Palette, ShieldCheck, type LucideIcon } from "lucide-react"
import type { SettingsSectionKey } from "@/types/mocked"

export interface SettingsNavItem {
  key: SettingsSectionKey
  label: string
  icon: LucideIcon
}

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { key: "general", label: "General", icon: Building2 },
  { key: "ai_models", label: "AI Models", icon: Cpu },
  { key: "memory", label: "Memory", icon: Database },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "appearance", label: "Appearance", icon: Palette },
]
