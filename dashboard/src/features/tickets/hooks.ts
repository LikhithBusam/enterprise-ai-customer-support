import { useMutation } from "@tanstack/react-query"
import { submitTicket } from "@/services/endpoints/tickets"
import type { TicketRequest } from "@/types/api"

/** Calls the REAL backend (POST /v1/tickets) — not MSW. See services/endpoints/tickets.ts. */
export function useSubmitTicket() {
  return useMutation({
    mutationFn: (request: TicketRequest) => submitTicket(request),
  })
}
