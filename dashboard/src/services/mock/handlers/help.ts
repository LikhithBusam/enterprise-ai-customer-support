import { http, HttpResponse } from "msw"
import { API_BASE_URL } from "@/lib/constants"
import { getHelp } from "@/services/mock/fixtures/help"

export const helpHandlers = [
  http.get(`${API_BASE_URL}/v1/help`, () => {
    return HttpResponse.json(getHelp())
  }),
]
