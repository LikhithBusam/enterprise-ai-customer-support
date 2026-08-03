import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AuditFiltersProps {
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
}

/** Date range filter row, separated from AuditToolbar's faceted filters since a date range is a
 * different control shape (paired inputs, not a popover multi-select). */
export function AuditFilters({ dateFrom, onDateFromChange, dateTo, onDateToChange }: AuditFiltersProps) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="audit-date-from">
            Occurred from
          </Label>
          <Input
            id="audit-date-from"
            name="audit-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className="h-7 w-36"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="audit-date-to">
            Occurred to
          </Label>
          <Input
            id="audit-date-to"
            name="audit-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            className="h-7 w-36"
          />
        </div>
      </CardContent>
    </Card>
  )
}
