import { NavLink } from "react-router-dom"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { NAV_GROUPS } from "@/components/layout/nav-config"
import { APP_NAME } from "@/lib/constants"

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <aside
      aria-label="Primary"
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">
          SC
        </div>
        {!collapsed && <span className="truncate text-sm font-semibold">{APP_NAME}</span>}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <h3 className="mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground">
                {group.label}
              </h3>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.path}>
                  <SidebarLink
                    path={item.path}
                    label={item.label}
                    icon={<item.icon className="size-4 shrink-0" />}
                    collapsed={collapsed}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="icon"
          className="w-full"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>
    </aside>
  )
}

interface SidebarLinkProps {
  path: string
  label: string
  icon: React.ReactNode
  collapsed: boolean
}

function SidebarLink({ path, label, icon, collapsed }: SidebarLinkProps) {
  const link = (
    <NavLink
      to={path}
      end={path === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80",
          collapsed && "justify-center px-0",
        )
      }
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
