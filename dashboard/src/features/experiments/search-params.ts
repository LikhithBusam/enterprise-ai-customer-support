import { z } from "zod"

export const EXPERIMENT_ARM_VALUES = ["memoryless", "static_react", "memory_augmented", "v2_full", "policy_memory"] as const
export const EXPERIMENT_FAILURE_RATE_VALUES = ["0.0", "0.3", "0.7"] as const

const DEFAULT_ARMS = ["memory_augmented", "v2_full", "policy_memory"] as const
const DEFAULT_FAILURE_RATES = ["0.0", "0.3", "0.7"] as const

export const experimentSearchSchema = z.object({
  arms: z.array(z.enum(EXPERIMENT_ARM_VALUES)).catch([...DEFAULT_ARMS]),
  failureRates: z.array(z.enum(EXPERIMENT_FAILURE_RATE_VALUES)).catch([...DEFAULT_FAILURE_RATES]),
  /** Which single failure rate the Ablation Studies ladder and Summary row focus on — separate
   * from the multi-select `failureRates` that scope the charts/table. */
  ablationRate: z.enum(EXPERIMENT_FAILURE_RATE_VALUES).catch("0.3"),
})

export type ExperimentSearchParams = z.infer<typeof experimentSearchSchema>

const DEFAULTS: ExperimentSearchParams = {
  arms: [...DEFAULT_ARMS],
  failureRates: [...DEFAULT_FAILURE_RATES],
  ablationRate: "0.3",
}

function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value))
}

export function parseExperimentSearchParams(params: URLSearchParams): ExperimentSearchParams {
  const raw = {
    arms: params.get("arms")?.split(",").filter(Boolean) ?? undefined,
    failureRates: params.get("failureRates")?.split(",").filter(Boolean) ?? undefined,
    ablationRate: params.get("ablationRate") ?? undefined,
  }
  return experimentSearchSchema.parse(raw)
}

export function buildExperimentSearchParams(value: ExperimentSearchParams): URLSearchParams {
  const params = new URLSearchParams()
  if (!sameMembers(value.arms, DEFAULTS.arms)) params.set("arms", value.arms.join(","))
  if (!sameMembers(value.failureRates, DEFAULTS.failureRates)) params.set("failureRates", value.failureRates.join(","))
  if (value.ablationRate !== DEFAULTS.ablationRate) params.set("ablationRate", value.ablationRate)
  return params
}
