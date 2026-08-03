import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>
  title: string
  className?: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn("text-xs font-medium text-muted-foreground", className)}>{title}</div>
  }

  const sorted = column.getIsSorted()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("-ml-2.5 h-7 gap-1 text-xs font-medium text-muted-foreground data-[state=open]:bg-muted", className)}
        >
          <span>{title}</span>
          {sorted === "desc" ? (
            <ArrowDown className="size-3.5" />
          ) : sorted === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ChevronsUpDown className="size-3.5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => column.toggleSorting(false)}>
          <ArrowUp className="size-3.5" />
          Asc
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => column.toggleSorting(true)}>
          <ArrowDown className="size-3.5" />
          Desc
        </DropdownMenuItem>
        {column.getCanHide() && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => column.toggleVisibility(false)}>
              <EyeOff className="size-3.5" />
              Hide column
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
