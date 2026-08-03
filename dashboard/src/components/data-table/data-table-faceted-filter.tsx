import type { LucideIcon } from "lucide-react"
import { CheckIcon, PlusCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

export interface FacetedFilterOption {
  label: string
  value: string
  icon?: LucideIcon
}

interface DataTableFacetedFilterProps {
  title: string
  options: FacetedFilterOption[]
  selected: string[]
  onChange: (values: string[]) => void
}

export function DataTableFacetedFilter({
  title,
  options,
  selected,
  onChange,
}: DataTableFacetedFilterProps) {
  const selectedSet = new Set(selected)

  function toggle(value: string): void {
    const next = new Set(selectedSet)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    onChange(Array.from(next))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-dashed">
          <PlusCircle className="size-3.5" />
          {title}
          {selectedSet.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1.5 font-normal lg:hidden">
                {selectedSet.size}
              </Badge>
              <div className="hidden gap-1 lg:flex">
                {selectedSet.size > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1.5 font-normal">
                    {selectedSet.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedSet.has(option.value))
                    .map((option) => (
                      <Badge key={option.value} variant="secondary" className="rounded-sm px-1.5 font-normal">
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value)
                return (
                  <CommandItem key={option.value} onSelect={() => toggle(option.value)}>
                    <div
                      className={cn(
                        "flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <CheckIcon className="size-3" />
                    </div>
                    {option.icon && <option.icon className="size-4 text-muted-foreground" />}
                    <span>{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
