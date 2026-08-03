import { cn } from "@/lib/utils"
import { CATEGORY_ICONS } from "@/features/help/category-icons"
import type { HelpCategory, HelpCategoryKey } from "@/types/mocked"

interface HelpCategoriesProps {
  categories: HelpCategory[]
  active: HelpCategoryKey | ""
  onSelect: (category: HelpCategoryKey | "") => void
}

export function HelpCategories({ categories, active, onSelect }: HelpCategoriesProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {categories.map((category) => {
        const Icon = CATEGORY_ICONS[category.key]
        const isActive = active === category.key
        return (
          <button
            key={category.key}
            type="button"
            onClick={() => onSelect(isActive ? "" : category.key)}
            aria-pressed={isActive}
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive && "border-primary bg-accent/70",
            )}
          >
            <Icon className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">{category.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{category.description}</p>
            </div>
            <span className="text-xs text-muted-foreground">{category.article_count} articles</span>
          </button>
        )
      })}
    </div>
  )
}
