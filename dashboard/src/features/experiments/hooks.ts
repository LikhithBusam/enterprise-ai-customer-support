import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/constants"
import { compareExperiments, getExperimentCharts, listExperiments } from "@/services/endpoints/experiments"
import type { ExperimentSearchParams } from "@/features/experiments/search-params"

export function useExperimentsList() {
  return useQuery({
    queryKey: QUERY_KEYS.experiments,
    queryFn: ({ signal }) => listExperiments(signal),
  })
}

export function useExperimentCompare(params: Pick<ExperimentSearchParams, "arms" | "failureRates">) {
  return useQuery({
    queryKey: [...QUERY_KEYS.experimentCompare, params],
    queryFn: ({ signal }) => compareExperiments(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useExperimentCharts(params: Pick<ExperimentSearchParams, "arms" | "failureRates">) {
  return useQuery({
    queryKey: [...QUERY_KEYS.experimentCharts, params],
    queryFn: ({ signal }) => getExperimentCharts(params, signal),
    placeholderData: keepPreviousData,
  })
}
