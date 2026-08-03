import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { getConversation, listConversations } from "@/services/endpoints/conversations"
import type { ConversationsSearchParams } from "@/features/conversations/search-params"

export function useConversations(params: ConversationsSearchParams) {
  return useQuery({
    queryKey: ["conversations", "list", params],
    queryFn: ({ signal }) => listConversations(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useConversation(ticketId: string | undefined) {
  return useQuery({
    queryKey: ["conversations", "detail", ticketId],
    queryFn: ({ signal }) => getConversation(ticketId!, signal),
    enabled: Boolean(ticketId),
  })
}
