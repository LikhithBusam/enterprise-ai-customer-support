/**
 * Calls the REAL backend — `GET /health` and `POST /v1/tickets`
 * (src/api/main.py, verified). Not mocked.
 */
import { apiRequest } from "@/services/client"
import type { HealthResponse, TicketRequest, TicketResponse } from "@/types/api"

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("/health", { signal })
}

export function submitTicket(request: TicketRequest): Promise<TicketResponse> {
  return apiRequest<TicketResponse>("/v1/tickets", { method: "POST", body: request })
}
