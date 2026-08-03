import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { NAV_GROUPS } from "@/components/layout/nav-config"

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  function goTo(path: string): void {
    setOpen(false)
    navigate(path)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      {/* CommandDialog's DialogContent does not itself provide cmdk's Command (store) context —
          CommandInput/CommandList need an explicit <Command> ancestor or they crash trying to
          subscribe to an undefined store. */}
      <Command shouldFilter>
        <CommandInput placeholder="Search pages, tickets, clients…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {NAV_GROUPS.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => (
                <CommandItem key={item.path} onSelect={() => goTo(item.path)}>
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
