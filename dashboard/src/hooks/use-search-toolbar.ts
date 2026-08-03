import { useEffect, useState } from "react"
import { useDebounce } from "@/hooks/use-debounce"

/** The debounced-local-input + external-resync pattern every toolbar's search box uses: type
 * locally without re-filtering on every keystroke, propagate the debounced value up via
 * `onSearchChange`, and resync the visible input whenever `search` changes for a reason other
 * than this component's own typing (a Reset button clearing the URL param, back/forward
 * navigation) — otherwise the box keeps showing stale text after the underlying filter has
 * already cleared. Previously duplicated identically across six toolbars (Audit Logs, Client
 * Management, Conversations, Help Center, Memory Explorer, Tool Monitoring); extracted here so a
 * future fix to this logic is a one-file change instead of six. */
export function useSearchToolbar(
  search: string,
  onSearchChange: (value: string) => void,
  delayMs = 300,
): readonly [string, (value: string) => void] {
  const [localSearch, setLocalSearch] = useState(search)
  const debouncedSearch = useDebounce(localSearch, delayMs)

  useEffect(() => {
    onSearchChange(debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only fire when the debounced value itself changes
  }, [debouncedSearch])

  useEffect(() => {
    setLocalSearch(search)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resync when the external `search` prop itself changes
  }, [search])

  return [localSearch, setLocalSearch] as const
}
