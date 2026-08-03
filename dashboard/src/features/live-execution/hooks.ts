import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/constants"
import {
  getExecutionTimeline,
  getExecutionToolCalls,
  getExecutionTrace,
} from "@/services/endpoints/execution"

export function useExecutionTrace(ticketId: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEYS.liveExecution(ticketId ?? ""), "trace"],
    queryFn: ({ signal }) => getExecutionTrace(ticketId!, signal),
    enabled: Boolean(ticketId),
  })
}

export function useExecutionTimeline(ticketId: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEYS.liveExecution(ticketId ?? ""), "timeline"],
    queryFn: ({ signal }) => getExecutionTimeline(ticketId!, signal),
    enabled: Boolean(ticketId),
  })
}

export function useExecutionToolCalls(ticketId: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEYS.liveExecution(ticketId ?? ""), "tool-calls"],
    queryFn: ({ signal }) => getExecutionToolCalls(ticketId!, signal),
    enabled: Boolean(ticketId),
  })
}
