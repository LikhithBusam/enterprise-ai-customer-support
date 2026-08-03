import { useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { PageHeader } from "@/components/layout/page-header"
import { ErrorState } from "@/components/status/error-state"
import { NodeInspectorSkeleton } from "@/components/status/skeletons"
import { SettingsNav } from "@/features/settings/components/settings-nav"
import { GeneralSettingsCard } from "@/features/settings/components/general-settings-card"
import { AiModelsSettingsCard } from "@/features/settings/components/ai-models-settings-card"
import { MemorySettingsCard } from "@/features/settings/components/memory-settings-card"
import { SecuritySettingsCard } from "@/features/settings/components/security-settings-card"
import { NotificationsSettingsCard } from "@/features/settings/components/notifications-settings-card"
import { AppearanceSettingsCard } from "@/features/settings/components/appearance-settings-card"
import { useSettings } from "@/features/settings/hooks"
import { SETTINGS_NAV_ITEMS } from "@/features/settings/nav-config"
import type { SettingsSectionKey } from "@/types/mocked"

const SECTION_KEYS = SETTINGS_NAV_ITEMS.map((item) => item.key)
const DEFAULT_SECTION: SettingsSectionKey = "general"

function parseSection(value: string | null): SettingsSectionKey {
  return (SECTION_KEYS as string[]).includes(value ?? "") ? (value as SettingsSectionKey) : DEFAULT_SECTION
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = useMemo(() => parseSection(searchParams.get("section")), [searchParams])
  const settingsQuery = useSettings()

  function handleSelectSection(key: SettingsSectionKey): void {
    const next = new URLSearchParams(searchParams)
    if (key === DEFAULT_SECTION) {
      next.delete("section")
    } else {
      next.set("section", key)
    }
    setSearchParams(next, { replace: true })
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure your organization, models, memory, security, and notifications"
      />
      <div className="p-6">
        {settingsQuery.isError ? (
          <ErrorState title="Couldn't load settings" onRetry={() => settingsQuery.refetch()} />
        ) : !settingsQuery.data ? (
          <NodeInspectorSkeleton />
        ) : (
          <div className="grid min-w-0 gap-6 md:grid-cols-[200px_1fr] md:items-start">
            <div className="min-w-0 md:sticky md:top-6">
              <SettingsNav active={activeSection} onSelect={handleSelectSection} />
            </div>
            <div className="min-w-0">
              {activeSection === "general" && <GeneralSettingsCard settings={settingsQuery.data.general} />}
              {activeSection === "ai_models" && <AiModelsSettingsCard settings={settingsQuery.data.ai_models} />}
              {activeSection === "memory" && <MemorySettingsCard settings={settingsQuery.data.memory} />}
              {activeSection === "security" && <SecuritySettingsCard settings={settingsQuery.data.security} />}
              {activeSection === "notifications" && (
                <NotificationsSettingsCard settings={settingsQuery.data.notifications} />
              )}
              {activeSection === "appearance" && <AppearanceSettingsCard settings={settingsQuery.data.appearance} />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
