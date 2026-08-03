import { http, HttpResponse } from "msw"
import { API_BASE_URL } from "@/lib/constants"
import {
  EXPERIMENT_ARMS,
  EXPERIMENT_FAILURE_RATES,
  compareExperiments,
  computeExperimentCharts,
  listExperiments,
} from "@/services/mock/fixtures/experiments"
import type { ExperimentArm, ExperimentFailureRate } from "@/types/mocked"

function parseArms(url: URL): ExperimentArm[] {
  const raw = url.searchParams.get("arms")?.split(",").filter(Boolean) ?? []
  const valid = raw.filter((value): value is ExperimentArm => (EXPERIMENT_ARMS as string[]).includes(value))
  return valid.length > 0 ? valid : EXPERIMENT_ARMS
}

function parseFailureRates(url: URL): ExperimentFailureRate[] {
  const raw = url.searchParams.get("failureRates")?.split(",").filter(Boolean) ?? []
  const valid = raw.filter((value): value is ExperimentFailureRate => (EXPERIMENT_FAILURE_RATES as string[]).includes(value))
  return valid.length > 0 ? valid : EXPERIMENT_FAILURE_RATES
}

export const experimentsHandlers = [
  http.get(`${API_BASE_URL}/v1/experiments/compare`, ({ request }) => {
    const url = new URL(request.url)
    return HttpResponse.json(compareExperiments(parseArms(url), parseFailureRates(url)))
  }),

  http.get(`${API_BASE_URL}/v1/experiments/charts`, ({ request }) => {
    const url = new URL(request.url)
    return HttpResponse.json(computeExperimentCharts(parseArms(url), parseFailureRates(url)))
  }),

  http.get(`${API_BASE_URL}/v1/experiments`, () => {
    return HttpResponse.json(listExperiments())
  }),
]
