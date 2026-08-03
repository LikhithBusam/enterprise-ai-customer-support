/** Mocked today (MSW) — documented in API_CONTRACT.md as the future real-backend contract. */
import { apiRequest } from "@/services/client"
import type { ConversationsSearchParams } from "@/features/conversations/search-params"
import type { ConversationDetail, ConversationSummary } from "@/types/mocked"

export interface ListConversationsResponse {
  data: ConversationSummary[]
  total: number
}

export function listConversations(
  params: ConversationsSearchParams,
  signal?: AbortSignal,
): Promise<ListConversationsResponse> {
  const query = new URLSearchParams()
  query.set("page", String(params.page))
  query.set("pageSize", String(params.pageSize))
  if (params.search) query.set("search", params.search)
  if (params.status.length > 0) query.set("status", params.status.join(","))
  if (params.intent.length > 0) query.set("intent", params.intent.join(","))
  query.set("sortBy", params.sortBy)
  query.set("sortDir", params.sortDir)

  return apiRequest<ListConversationsResponse>(`/v1/conversations?${query.toString()}`, { signal })
}

export function getConversation(ticketId: string, signal?: AbortSignal): Promise<ConversationDetail> {
  return apiRequest<ConversationDetail>(`/v1/conversations/${ticketId}`, { signal })
}
