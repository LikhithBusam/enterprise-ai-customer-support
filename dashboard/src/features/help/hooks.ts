import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/constants"
import { getHelp } from "@/services/endpoints/help"

export function useHelp() {
  return useQuery({
    queryKey: QUERY_KEYS.help,
    queryFn: ({ signal }) => getHelp(signal),
  })
}
