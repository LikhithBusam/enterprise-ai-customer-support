import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import { SETTINGS_NAV_ITEMS } from "@/features/settings/nav-config"
import type { SettingsSectionKey } from "@/types/mocked"

interface SettingsNavProps {
  active: SettingsSectionKey
  onSelect: (key: SettingsSectionKey) => void
}

/** Desktop: a vertical section list. Mobile (<768px): the same sections as a horizontally
 * scrollable Tabs strip, per the layout spec's "Navigation collapses into tabs" option — simpler
 * and more discoverable for basic section-switching than adding a drawer/Sheet interaction. */
export function SettingsNav({ active, onSelect }: SettingsNavProps) {
  const isMobile = useMediaQuery("(max-width: 767px)")

  if (isMobile) {
    return (
      <Tabs value={active} onValueChange={(value) => onSelect(value as SettingsSectionKey)}>
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            {SETTINGS_NAV_ITEMS.map((item) => (
              <TabsTrigger key={item.key} value={item.key} className="gap-1.5">
                <item.icon className="size-4" />
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
    )
  }

  return (
    <nav aria-label="Settings sections" className="space-y-0.5">
      {SETTINGS_NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelect(item.key)}
          aria-current={active === item.key ? "page" : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted",
            active === item.key ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          <item.icon className="size-4 shrink-0" />
          {item.label}
        </button>
      ))}
    </nav>
  )
}
