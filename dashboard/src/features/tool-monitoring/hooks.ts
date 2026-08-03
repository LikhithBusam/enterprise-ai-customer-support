import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/constants"
import { getTool, getToolHistory, getToolStats, listTools } from "@/services/endpoints/tools"
import type { ToolSearchParams } from "@/features/tool-monitoring/search-params"

export function useToolsList(params: ToolSearchParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.tools, params],
    queryFn: ({ signal }) => listTools(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useTool(toolName: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.toolDetail(toolName ?? ""),
    queryFn: ({ signal }) => getTool(toolName!, signal),
    enabled: Boolean(toolName),
  })
}

export function useToolStats() {
  return useQuery({
    queryKey: QUERY_KEYS.toolStats,
    queryFn: ({ signal }) => getToolStats(signal),
  })
}

export function useToolHistory(toolName: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.toolHistory(toolName ?? ""),
    queryFn: ({ signal }) => getToolHistory(toolName!, signal),
    enabled: Boolean(toolName),
  })
}
