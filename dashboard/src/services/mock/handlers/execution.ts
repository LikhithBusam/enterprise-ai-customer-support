import { http, HttpResponse } from "msw"
import { API_BASE_URL } from "@/lib/constants"
import {
  getExecutionTimeline,
  getExecutionToolCalls,
  getExecutionTrace,
} from "@/services/mock/fixtures/execution"

export const executionHandlers = [
  http.get(`${API_BASE_URL}/v1/conversations/:ticketId/execution`, ({ params }) => {
    const trace = getExecutionTrace(String(params.ticketId))
    if (!trace) {
      return HttpResponse.json({ detail: "Conversation not found" }, { status: 404 })
    }
    return HttpResponse.json(trace)
  }),

  http.get(`${API_BASE_URL}/v1/conversations/:ticketId/timeline`, ({ params }) => {
    const timeline = getExecutionTimeline(String(params.ticketId))
    if (!timeline) {
      return HttpResponse.json({ detail: "Conversation not found" }, { status: 404 })
    }
    return HttpResponse.json(timeline)
  }),

  http.get(`${API_BASE_URL}/v1/conversations/:ticketId/tool-calls`, ({ params }) => {
    const toolCalls = getExecutionToolCalls(String(params.ticketId))
    if (!toolCalls) {
      return HttpResponse.json({ detail: "Conversation not found" }, { status: 404 })
    }
    return HttpResponse.json(toolCalls)
  }),
]
