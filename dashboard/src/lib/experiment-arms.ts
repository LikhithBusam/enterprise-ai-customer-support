import type { ExperimentArm, ExperimentFailureRate } from "@/types/mocked"

export const EXPERIMENT_ARM_ORDER: ExperimentArm[] = [
  "memoryless",
  "static_react",
  "memory_augmented",
  "v2_full",
  "policy_memory",
]

export const EXPERIMENT_FAILURE_RATE_ORDER: ExperimentFailureRate[] = ["0.0", "0.3", "0.7"]

/** The fixed 4-arm ablation ladder the spec asks for — Memoryless as the true from-scratch
 * reference, then each arm that adds one more real capability on top of it. */
export const ABLATION_ARMS: ExperimentArm[] = ["memoryless", "memory_augmented", "v2_full", "policy_memory"]

export const EXPERIMENT_ARM_LABELS: Record<ExperimentArm, string> = {
  memoryless: "Memoryless",
  static_react: "Static ReAct",
  memory_augmented: "Memory Augmented",
  v2_full: "v2 Full",
  policy_memory: "Policy Memory",
}

export function experimentArmLabel(arm: ExperimentArm): string {
  return EXPERIMENT_ARM_LABELS[arm] ?? arm
}

/**
 * Fixed categorical color per arm, drawn from the app's existing 5-slot --color-chart-{1..5}
 * ramp (validate_palette.js flags this ramp as a genuinely weak categorical set in dark mode —
 * two pairs read close together for red-green and blue-violet colorblind users; see
 * ExperimentCharts's doc comment for the mitigations applied). Order is deliberately NOT
 * alphabetical or "sophistication ladder" — it's chosen so the two worst-offending pairs
 * (chart-2/chart-3 and chart-1/chart-4) never sit next to each other in a grouped bar chart,
 * where every selected arm's bars render adjacent within each failure-rate cluster.
 */
export const EXPERIMENT_ARM_COLORS: Record<ExperimentArm, string> = {
  memoryless: "var(--color-chart-4)",
  static_react: "var(--color-chart-5)",
  memory_augmented: "var(--color-chart-2)",
  v2_full: "var(--color-chart-1)",
  policy_memory: "var(--color-chart-3)",
}

export function experimentArmColor(arm: ExperimentArm): string {
  return EXPERIMENT_ARM_COLORS[arm] ?? "var(--color-muted-foreground)"
}
