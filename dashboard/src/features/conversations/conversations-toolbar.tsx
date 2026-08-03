import type { Table } from "@tanstack/react-table"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useSearchToolbar } from "@/hooks/use-search-toolbar"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter"
import type { ConversationSummary } from "@/types/mocked"

const STATUS_OPTIONS = [
  { label: "Resolved", value: "resolved" },
  { label: "Escalated", value: "escalated" },
  { label: "Pending", value: "pending" },
  { label: "In progress", value: "in_progress" },
  { label: "Failed", value: "failed" },
]

const INTENT_OPTIONS = [
  { label: "Refund request", value: "refund_request" },
  { label: "Order status", value: "order_status" },
  { label: "Billing dispute", value: "billing_dispute" },
  { label: "Account issue", value: "account_issue" },
  { label: "Complaint escalation", value: "complaint_escalation" },
  { label: "General inquiry", value: "general_inquiry" },
]

interface ConversationsToolbarProps {
  table: Table<ConversationSummary>
  search: string
  onSearchChange: (value: string) => void
  status: string[]
  onStatusChange: (value: string[]) => void
  intent: string[]
  onIntentChange: (value: string[]) => void
}

export function ConversationsToolbar({
  table,
  search,
  onSearchChange,
  status,
  onStatusChange,
  intent,
  onIntentChange,
}: ConversationsToolbarProps) {
  const [localSearch, setLocalSearch] = useSearchToolbar(search, onSearchChange)

  const hasFilters = status.length > 0 || intent.length > 0 || search.length > 0
  const isFiltered = hasFilters

  function resetFilters(): void {
    setLocalSearch("")
    onSearchChange("")
    onStatusChange([])
    onIntentChange([])
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search ticket ID, customer, message…"
        value={localSearch}
        onChange={(event) => setLocalSearch(event.target.value)}
        className="h-8 w-56"
        aria-label="Search conversations"
      />
      <DataTableFacetedFilter
        title="Status"
        options={STATUS_OPTIONS}
        selected={status}
        onChange={onStatusChange}
      />
      <DataTableFacetedFilter
        title="Intent"
        options={INTENT_OPTIONS}
        selected={intent}
        onChange={onIntentChange}
      />
      {isFiltered && (
        <Button variant="ghost" size="sm" className="gap-1" onClick={resetFilters}>
          Reset
          <X className="size-3.5" />
        </Button>
      )}
      <div className="ml-auto">
        <DataTableViewOptions table={table} />
      </div>
    </div>
  )
}
