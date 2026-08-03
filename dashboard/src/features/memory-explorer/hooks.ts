import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/constants"
import { getMemoryEntry, getMemoryStats, listMemory } from "@/services/endpoints/memory"
import type { MemorySearchParams } from "@/features/memory-explorer/search-params"

export function useMemoryList(params: MemorySearchParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.memoryList, params],
    queryFn: ({ signal }) => listMemory(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useMemoryEntry(id: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.memoryDetail(id ?? ""),
    queryFn: ({ signal }) => getMemoryEntry(id!, signal),
    enabled: Boolean(id),
  })
}

export function useMemoryStats(type: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.memoryStats(type ?? "all"),
    queryFn: ({ signal }) => getMemoryStats(type, signal),
    placeholderData: keepPreviousData,
  })
}
