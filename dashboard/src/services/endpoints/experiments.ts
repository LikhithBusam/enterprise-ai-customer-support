/** Mocked today (MSW) — documented in API_CONTRACT.md as the future real-backend contract. */
import { apiRequest } from "@/services/client"
import type { ExperimentSearchParams } from "@/features/experiments/search-params"
import type { ExperimentChartsResponse, ExperimentCompareResponse, ExperimentListResponse } from "@/types/mocked"

function buildQuery(params: Pick<ExperimentSearchParams, "arms" | "failureRates">): URLSearchParams {
  const query = new URLSearchParams()
  query.set("arms", params.arms.join(","))
  query.set("failureRates", params.failureRates.join(","))
  return query
}

export function listExperiments(signal?: AbortSignal): Promise<ExperimentListResponse> {
  return apiRequest<ExperimentListResponse>("/v1/experiments", { signal })
}

export function compareExperiments(
  params: Pick<ExperimentSearchParams, "arms" | "failureRates">,
  signal?: AbortSignal,
): Promise<ExperimentCompareResponse> {
  return apiRequest<ExperimentCompareResponse>(`/v1/experiments/compare?${buildQuery(params).toString()}`, { signal })
}

export function getExperimentCharts(
  params: Pick<ExperimentSearchParams, "arms" | "failureRates">,
  signal?: AbortSignal,
): Promise<ExperimentChartsResponse> {
  return apiRequest<ExperimentChartsResponse>(`/v1/experiments/charts?${buildQuery(params).toString()}`, { signal })
}
