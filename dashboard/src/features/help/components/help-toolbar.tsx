import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useSearchToolbar } from "@/hooks/use-search-toolbar"

interface HelpToolbarProps {
  search: string
  onSearchChange: (value: string) => void
}

/** Free-text search only — category filtering is a row of clickable cards (HelpCategories), not
 * a faceted-filter dropdown, since there are only 10 fixed categories. */
export function HelpToolbar({ search, onSearchChange }: HelpToolbarProps) {
  const [localSearch, setLocalSearch] = useSearchToolbar(search, onSearchChange)

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        name="help-search"
        placeholder="Search FAQs, troubleshooting, and quick links…"
        value={localSearch}
        onChange={(event) => setLocalSearch(event.target.value)}
        className="h-10 pl-9"
        aria-label="Search Help Center"
      />
      {localSearch && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1.5 -translate-y-1/2"
          aria-label="Clear search"
          onClick={() => setLocalSearch("")}
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
