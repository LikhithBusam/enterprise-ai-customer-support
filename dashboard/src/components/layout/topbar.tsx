import { Bell, ChevronsUpDown, LogOut, Search, User as UserIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { useActiveClient } from "@/app/client-context"
import { useAuth } from "@/features/auth/auth-context"
import { useNavigate } from "react-router-dom"

export function Topbar() {
  const { clients, activeClientId, setActiveClientId } = useActiveClient()
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const activeClient = clients.find((c) => c.clientId === activeClientId)

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border px-4">
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <span className="max-w-40 truncate">{activeClient?.name ?? "Select client"}</span>
              <ChevronsUpDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Switch client</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {clients.map((client) => (
              <DropdownMenuItem key={client.clientId} onSelect={() => setActiveClientId(client.clientId)}>
                {client.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="hidden flex-1 max-w-md justify-start gap-2 text-muted-foreground sm:flex"
        onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </Button>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="User menu">
              <Avatar className="size-7">
                <AvatarFallback className="text-xs">
                  {session?.email?.slice(0, 2).toUpperCase() ?? "??"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="truncate">{session?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/profile")}>
              <UserIcon className="size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/help")}>Help Center</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                signOut()
                navigate("/login")
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
