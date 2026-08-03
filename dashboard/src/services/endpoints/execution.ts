/** Mocked today (MSW) — documented in API_CONTRACT.md as the future real-backend contract. */
import { apiRequest } from "@/services/client"
import type { ExecutionTimelineEvent, ExecutionToolCallRecord, ExecutionTrace } from "@/types/mocked"

export function getExecutionTrace(ticketId: string, signal?: AbortSignal): Promise<ExecutionTrace> {
  return apiRequest<ExecutionTrace>(`/v1/conversations/${ticketId}/execution`, { signal })
}

export function getExecutionTimeline(
  ticketId: string,
  signal?: AbortSignal,
): Promise<ExecutionTimelineEvent[]> {
  return apiRequest<ExecutionTimelineEvent[]>(`/v1/conversations/${ticketId}/timeline`, { signal })
}

export function getExecutionToolCalls(
  ticketId: string,
  signal?: AbortSignal,
): Promise<ExecutionToolCallRecord[]> {
  return apiRequest<ExecutionToolCallRecord[]>(`/v1/conversations/${ticketId}/tool-calls`, { signal })
}
