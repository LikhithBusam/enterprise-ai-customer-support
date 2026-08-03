import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DataTablePaginationProps {
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  selectedCount?: number
  pageSizeOptions?: number[]
}

export function DataTablePagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  selectedCount,
  pageSizeOptions = [10, 20, 50, 100],
}: DataTablePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalCount)

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 py-1 text-sm">
      <div className="text-muted-foreground">
        {selectedCount ? (
          <span>{selectedCount} selected</span>
        ) : (
          <span>
            {rangeStart}–{rangeEnd} of {totalCount}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="hidden text-muted-foreground sm:inline">Rows per page</span>
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger size="sm" className="w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-muted-foreground">
          Page {page} of {pageCount}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="First page"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Last page"
            disabled={page >= pageCount}
            onClick={() => onPageChange(pageCount)}
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
