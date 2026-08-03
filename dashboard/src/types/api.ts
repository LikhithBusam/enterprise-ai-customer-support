/**
 * Types mirroring the REAL backend contract (src/api/schemas.py, src/api/main.py) exactly.
 * These two endpoints are wired to the actual FastAPI backend — everything else in `types/`
 * lives in `types/mocked.ts` and is documented in API_CONTRACT.md as a future contract.
 */

export interface TicketToolCall {
  tool_name: string
  params: Record<string, unknown>
  success: boolean
  failure_type: string | null
  data: Record<string, unknown> | null
  iteration?: number
}

export interface TicketRequest {
  ticket_id: string
  customer_id: string
  customer_message: string
  intent_label?: string
}

export interface TicketResponse {
  ticket_id: string
  resolved: boolean
  escalate: boolean
  response_message: string
  replanning_count: number
  memory_hit: boolean
  iteration: number
  tool_calls_made: TicketToolCall[]
  replayed: boolean
}

export interface HealthResponse {
  status: string
}

export interface ApiErrorPayload {
  detail: string
}
