import type {
  ExperimentArm,
  ExperimentArmMeta,
  ExperimentArmResult,
  ExperimentChartsResponse,
  ExperimentCiPoint,
  ExperimentFailureRate,
  ExperimentSeriesPoint,
  ExperimentSignificance,
  InsightItem,
} from "@/types/mocked"

/**
 * Every number in ARM_META/RESULTS/SIGNIFICANCE below is transcribed verbatim from this
 * repository's own research artifacts — nothing here is generated, randomized, or simulated:
 *
 *   - experiments/results/policy_memory_validation/report.md  (Table 1, Table 2, Table 3)
 *   - experiments/results/v2_full_ablation/report.md          (Table A1, Table A2, Table A4)
 *
 * Both reports were produced by scripts/policy_memory_validation.py and
 * scripts/v2_full_ablation.py running the real 200-ticket runs recorded in
 * experiments/results/{arm}_{failure_rate}.jsonl. If those reports are regenerated with new
 * runs, this file needs a matching manual update — there is no live pipeline importing them
 * automatically (see the approved architecture's "one-time import" note).
 */

export const EXPERIMENT_ARMS: ExperimentArm[] = [
  "memoryless",
  "static_react",
  "memory_augmented",
  "v2_full",
  "policy_memory",
]

export const EXPERIMENT_FAILURE_RATES: ExperimentFailureRate[] = ["0.0", "0.3", "0.7"]

export const ARM_META: ExperimentArmMeta[] = [
  {
    arm: "memoryless",
    label: "Memoryless",
    description: "LLM planner + critic, no memory of any kind — replans from scratch on every ticket.",
    source_files: [
      "experiments/results/memoryless_0.0.jsonl",
      "experiments/results/memoryless_0.3.jsonl",
      "experiments/results/memoryless_0.7.jsonl",
    ],
  },
  {
    arm: "static_react",
    label: "Static ReAct",
    description: "Fixed ReAct tool-call loop, no memory and no adaptive replanning.",
    source_files: [
      "experiments/results/static_react_0.0.jsonl",
      "experiments/results/static_react_0.3.jsonl",
      "experiments/results/static_react_0.7.jsonl",
    ],
  },
  {
    arm: "memory_augmented",
    label: "Memory Augmented",
    description: "Contribution 1 (frozen) — episodic and plan-success memory retrieval added to the planner/critic loop.",
    source_files: [
      "experiments/results/memory_augmented_0.0.jsonl",
      "experiments/results/memory_augmented_0.3.jsonl",
      "experiments/results/memory_augmented_0.7.jsonl",
    ],
  },
  {
    arm: "v2_full",
    label: "v2 Full",
    description:
      "Memory Augmented plus the v2 engineering line: failure-category-conditioned Critic, template-abstracted memory writes, and tool-reliability scoring — Policy Memory disabled, so this isolates what those engineering changes alone contribute.",
    source_files: ["experiments/results/v2_full_ablation/report.md (\"v2_full (no Policy Memory)\" rows)"],
  },
  {
    arm: "policy_memory",
    label: "Policy Memory",
    description:
      "Contribution 2 — v2 Full with reusable, upserted workflow templates (keyed by intent cluster) swapping in for episodic-only retrieval. The paper's central research question: does policy-based memory generalize better than ticket-based memory?",
    source_files: [
      "experiments/results/policy_memory_0.0.jsonl",
      "experiments/results/policy_memory_0.3.jsonl",
      "experiments/results/policy_memory_0.7.jsonl",
    ],
  },
]

export const EXPERIMENT_RESULTS: ExperimentArmResult[] = [
  // --- Memoryless (Table 1) ---
  {
    arm: "memoryless",
    failure_rate: "0.0",
    resolved: 188,
    total: 200,
    resolution_rate: 0.94,
    avg_tool_calls: 5.15,
    avg_replans: 0.32,
    memory_hit_rate: null,
    retrieval_distance: null,
    avg_latency_ms: null,
    policy_retrieval_rate: null,
    policy_reuse_rate: null,
    resolution_rate_policy_hit: null,
    resolution_rate_no_hit: null,
    distinct_policies_used: null,
    ci_low: null,
    ci_high: null,
  },
  {
    arm: "memoryless",
    failure_rate: "0.3",
    resolved: 84,
    total: 200,
    resolution_rate: 0.42,
    avg_tool_calls: 5.06,
    avg_replans: 1.44,
    memory_hit_rate: null,
    retrieval_distance: null,
    avg_latency_ms: null,
    policy_retrieval_rate: null,
    policy_reuse_rate: null,
    resolution_rate_policy_hit: null,
    resolution_rate_no_hit: null,
    distinct_policies_used: null,
    ci_low: null,
    ci_high: null,
  },
  {
    arm: "memoryless",
    failure_rate: "0.7",
    resolved: 91,
    total: 200,
    resolution_rate: 0.455,
    avg_tool_calls: 5.82,
    avg_replans: 1.55,
    memory_hit_rate: null,
    retrieval_distance: null,
    avg_latency_ms: null,
    policy_retrieval_rate: null,
    policy_reuse_rate: null,
    resolution_rate_policy_hit: null,
    resolution_rate_no_hit: null,
    distinct_policies_used: null,
    ci_low: null,
    ci_high: null,
  },
  // --- Static ReAct (Table 1) ---
  {
    arm: "static_react",
    failure_rate: "0.0",
    resolved: 118,
    total: 200,
    resolution_rate: 0.59,
    avg_tool_calls: 1.37,
    avg_replans: 0.0,
    memory_hit_rate: null,
    retrieval_distance: null,
    avg_latency_ms: null,
    policy_retrieval_rate: null,
    policy_reuse_rate: null,
    resolution_rate_policy_hit: null,
    resolution_rate_no_hit: null,
    distinct_policies_used: null,
    ci_low: null,
    ci_high: null,
  },
  {
    arm: "static_react",
    failure_rate: "0.3",
    resolved: 102,
    total: 200,
    resolution_rate: 0.51,
    avg_tool_calls: 1.98,
    avg_replans: 0.0,
    memory_hit_rate: null,
    retrieval_distance: null,
    avg_latency_ms: null,
    policy_retrieval_rate: null,
    policy_reuse_rate: null,
    resolution_rate_policy_hit: null,
    resolution_rate_no_hit: null,
    distinct_policies_used: null,
    ci_low: null,
    ci_high: null,
  },
  {
    arm: "static_react",
    failure_rate: "0.7",
    resolved: 20,
    total: 200,
    resolution_rate: 0.1,
    avg_tool_calls: 1.35,
    avg_replans: 0.34,
    memory_hit_rate: null,
    retrieval_distance: null,
    avg_latency_ms: null,
    policy_retrieval_rate: null,
    policy_reuse_rate: null,
    resolution_rate_policy_hit: null,
    resolution_rate_no_hit: null,
    distinct_policies_used: null,
    ci_low: null,
    ci_high: null,
  },
  // --- Memory Augmented (Table 1) ---
  {
    arm: "memory_augmented",
    failure_rate: "0.0",
    resolved: 193,
    total: 200,
    resolution_rate: 0.965,
    avg_tool_calls: 2.69,
    avg_replans: 0.09,
    memory_hit_rate: 0.729,
    retrieval_distance: null,
    avg_latency_ms: null,
    policy_retrieval_rate: null,
    policy_reuse_rate: null,
    resolution_rate_policy_hit: null,
    resolution_rate_no_hit: null,
    distinct_policies_used: null,
    ci_low: null,
    ci_high: null,
  },
  {
    arm: "memory_augmented",
    failure_rate: "0.3",
    resolved: 146,
    total: 200,
    resolution_rate: 0.73,
    avg_tool_calls: 4.01,
    avg_replans: 1.3,
    memory_hit_rate: 0.84,
    retrieval_distance: null,
    avg_latency_ms: null,
    policy_retrieval_rate: null,
    policy_reuse_rate: null,
    resolution_rate_policy_hit: null,
    resolution_rate_no_hit: null,
    distinct_policies_used: null,
    ci_low: null,
    ci_high: null,
  },
  {
    arm: "memory_augmented",
    failure_rate: "0.7",
    resolved: 96,
    total: 200,
    resolution_rate: 0.48,
    avg_tool_calls: 4.85,
    avg_replans: 2.0,
    memory_hit_rate: 0.95,
    retrieval_distance: null,
    avg_latency_ms: null,
    policy_retrieval_rate: null,
    policy_reuse_rate: null,
    resolution_rate_policy_hit: null,
    resolution_rate_no_hit: null,
    distinct_policies_used: null,
    ci_low: null,
    ci_high: null,
  },
  // --- v2 Full (Table A1 + A2, "v2_full (no Policy Memory)" rows) ---
  {
    arm: "v2_full",
    failure_rate: "0.0",
    resolved: 194,
    total: 200,
    resolution_rate: 0.97,
    avg_tool_calls: 3.15,
    avg_replans: 0.09,
    memory_hit_rate: 0.995,
    retrieval_distance: 1.0032,
    avg_latency_ms: 4653,
    policy_retrieval_rate: null,
    policy_reuse_rate: null,
    resolution_rate_policy_hit: null,
    resolution_rate_no_hit: null,
    distinct_policies_used: null,
    ci_low: 0.936,
    ci_high: 0.986,
  },
  {
    arm: "v2_full",
    failure_rate: "0.3",
    resolved: 190,
    total: 200,
    resolution_rate: 0.95,
    avg_tool_calls: 5.38,
    avg_replans: 1.62,
    memory_hit_rate: 0.995,
    retrieval_distance: 1.0492,
    avg_latency_ms: 11451,
    policy_retrieval_rate: null,
    policy_reuse_rate: null,
    resolution_rate_policy_hit: null,
    resolution_rate_no_hit: null,
    distinct_policies_used: null,
    ci_low: 0.91,
    ci_high: 0.973,
  },
  {
    arm: "v2_full",
    failure_rate: "0.7",
    resolved: 87,
    total: 200,
    resolution_rate: 0.435,
    avg_tool_calls: 5.33,
    avg_replans: 2.53,
    memory_hit_rate: 0.975,
    retrieval_distance: 1.1803,
    avg_latency_ms: 11790,
    policy_retrieval_rate: null,
    policy_reuse_rate: null,
    resolution_rate_policy_hit: null,
    resolution_rate_no_hit: null,
    distinct_policies_used: null,
    ci_low: 0.368,
    ci_high: 0.504,
  },
  // --- Policy Memory (Table 1, Table 2, Table A1) ---
  {
    arm: "policy_memory",
    failure_rate: "0.0",
    resolved: 194,
    total: 200,
    resolution_rate: 0.97,
    avg_tool_calls: 2.81,
    avg_replans: 0.09,
    memory_hit_rate: 0.995,
    retrieval_distance: 1.5898,
    avg_latency_ms: 5048,
    policy_retrieval_rate: 0.995,
    policy_reuse_rate: 0.834,
    resolution_rate_policy_hit: 0.97,
    resolution_rate_no_hit: 1.0,
    distinct_policies_used: 13,
    ci_low: 0.936,
    ci_high: 0.986,
  },
  {
    arm: "policy_memory",
    failure_rate: "0.3",
    resolved: 180,
    total: 200,
    resolution_rate: 0.9,
    avg_tool_calls: 4.89,
    avg_replans: 1.6,
    memory_hit_rate: 0.995,
    retrieval_distance: 1.5694,
    avg_latency_ms: 16058,
    policy_retrieval_rate: 0.98,
    policy_reuse_rate: 0.694,
    resolution_rate_policy_hit: 0.913,
    resolution_rate_no_hit: 0.25,
    distinct_policies_used: 18,
    ci_low: 0.851,
    ci_high: 0.934,
  },
  {
    arm: "policy_memory",
    failure_rate: "0.7",
    resolved: 75,
    total: 200,
    resolution_rate: 0.375,
    avg_tool_calls: 5.25,
    avg_replans: 2.56,
    memory_hit_rate: 0.995,
    retrieval_distance: 1.7313,
    avg_latency_ms: 18311,
    policy_retrieval_rate: 0.985,
    policy_reuse_rate: 0.827,
    resolution_rate_policy_hit: 0.376,
    resolution_rate_no_hit: 0.333,
    distinct_policies_used: 7,
    ci_low: 0.311,
    ci_high: 0.444,
  },
]

/** Table 3 (memoryless/static_react/memory_augmented vs policy_memory) + Table A4 (v2_full vs
 * policy_memory) — chi-square test of independence, resolved vs. failed, exactly as the real
 * scripts computed it. `policy_memory` itself has no row since it's the reference arm in both
 * source tables. */
export const EXPERIMENT_SIGNIFICANCE: ExperimentSignificance[] = [
  { arm_a: "memoryless", arm_b: "policy_memory", failure_rate: "0.0", p_value: 0.22783, significant: false },
  { arm_a: "memoryless", arm_b: "policy_memory", failure_rate: "0.3", p_value: 0.0, significant: true },
  { arm_a: "memoryless", arm_b: "policy_memory", failure_rate: "0.7", p_value: 0.12797, significant: false },
  { arm_a: "static_react", arm_b: "policy_memory", failure_rate: "0.0", p_value: 0.0, significant: true },
  { arm_a: "static_react", arm_b: "policy_memory", failure_rate: "0.3", p_value: 0.0, significant: true },
  { arm_a: "static_react", arm_b: "policy_memory", failure_rate: "0.7", p_value: 0.0, significant: true },
  { arm_a: "memory_augmented", arm_b: "policy_memory", failure_rate: "0.0", p_value: 1.0, significant: false },
  { arm_a: "memory_augmented", arm_b: "policy_memory", failure_rate: "0.3", p_value: 0.00002, significant: true },
  { arm_a: "memory_augmented", arm_b: "policy_memory", failure_rate: "0.7", p_value: 0.04324, significant: true },
  { arm_a: "v2_full", arm_b: "policy_memory", failure_rate: "0.0", p_value: 1.0, significant: false },
  { arm_a: "v2_full", arm_b: "policy_memory", failure_rate: "0.3", p_value: 0.08755, significant: false },
  { arm_a: "v2_full", arm_b: "policy_memory", failure_rate: "0.7", p_value: 0.26254, significant: false },
]

/** Root-cause figures from v2_full_ablation/report.md's "Root-Cause Comparison at FR = 0.7"
 * section — used only by the insight generator below (FR=0.7 is the only rate this deep-dive
 * was run at in the real report), not modeled as a first-class chartable series. */
const ROOT_CAUSE_FR07 = {
  v2_full: { unresolvedTickets: 113, avgReplansUnresolved: 3.0, criticAccuracy: 1.0 },
  policy_memory: { unresolvedTickets: 125, avgReplansUnresolved: 2.98, criticAccuracy: 0.97 },
}

function getResult(arm: ExperimentArm, failureRate: ExperimentFailureRate): ExperimentArmResult {
  const found = EXPERIMENT_RESULTS.find((row) => row.arm === arm && row.failure_rate === failureRate)
  if (!found) throw new Error(`No fixture result for ${arm} @ ${failureRate}`)
  return found
}

export function listExperiments(): { arms: ExperimentArmMeta[]; results: ExperimentArmResult[] } {
  return { arms: ARM_META, results: EXPERIMENT_RESULTS }
}

export function compareExperiments(arms: ExperimentArm[], failureRates: ExperimentFailureRate[]) {
  const results = EXPERIMENT_RESULTS.filter((row) => arms.includes(row.arm) && failureRates.includes(row.failure_rate))
  const significance = EXPERIMENT_SIGNIFICANCE.filter(
    (row) => arms.includes(row.arm_a) && arms.includes(row.arm_b) && failureRates.includes(row.failure_rate),
  )
  return { results, significance, insights: computeExperimentInsights(arms, failureRates) }
}

function buildSeries(arms: ExperimentArm[], failureRates: ExperimentFailureRate[], pick: (row: ExperimentArmResult) => number | null): ExperimentSeriesPoint[] {
  const points: ExperimentSeriesPoint[] = []
  for (const arm of arms) {
    for (const failureRate of failureRates) {
      points.push({ arm, failure_rate: failureRate, value: pick(getResult(arm, failureRate)) })
    }
  }
  return points
}

export function computeExperimentCharts(arms: ExperimentArm[], failureRates: ExperimentFailureRate[]): ExperimentChartsResponse {
  const ciArms = arms.filter((arm) => arm === "v2_full" || arm === "policy_memory")
  const confidence_interval: ExperimentCiPoint[] = []
  for (const arm of ciArms) {
    for (const failureRate of failureRates) {
      const row = getResult(arm, failureRate)
      if (row.ci_low === null || row.ci_high === null) continue
      confidence_interval.push({ arm, failure_rate: failureRate, value: row.resolution_rate, ci_low: row.ci_low, ci_high: row.ci_high })
    }
  }

  return {
    resolution_rate: buildSeries(arms, failureRates, (row) => row.resolution_rate),
    latency: buildSeries(arms, failureRates, (row) => row.avg_latency_ms),
    memory_hit: buildSeries(arms, failureRates, (row) => row.memory_hit_rate),
    tool_calls: buildSeries(arms, failureRates, (row) => row.avg_tool_calls),
    retries: buildSeries(arms, failureRates, (row) => row.avg_replans),
    policy_retrieval: buildSeries(
      arms.filter((arm) => arm === "policy_memory"),
      failureRates,
      (row) => row.policy_retrieval_rate,
    ),
    retrieval_distance: buildSeries(
      arms.filter((arm) => arm === "v2_full" || arm === "policy_memory"),
      failureRates,
      (row) => row.retrieval_distance,
    ),
    confidence_interval,
  }
}

/** Deterministic, data-gated insights — every branch below only fires when the underlying real
 * numbers actually support the claim at the currently-selected arms/failure rates, per "Only
 * show insights supported by the experiment data." */
function computeExperimentInsights(arms: ExperimentArm[], failureRates: ExperimentFailureRate[]): InsightItem[] {
  const insights: InsightItem[] = []
  const has = (arm: ExperimentArm) => arms.includes(arm)

  if (has("policy_memory") && has("memory_augmented")) {
    for (const fr of failureRates) {
      const policy = getResult("policy_memory", fr)
      const augmented = getResult("memory_augmented", fr)
      const deltaPts = (policy.resolution_rate - augmented.resolution_rate) * 100
      if (Math.abs(deltaPts) >= 5) {
        insights.push({
          id: `policy-vs-augmented-${fr}`,
          tone: deltaPts > 0 ? "positive" : "negative",
          title: `Policy Memory ${deltaPts > 0 ? "improves" : "underperforms"} at FR=${fr}`,
          description: `${(policy.resolution_rate * 100).toFixed(1)}% vs Memory Augmented's ${(augmented.resolution_rate * 100).toFixed(1)}% (${deltaPts > 0 ? "+" : ""}${deltaPts.toFixed(1)} pts).`,
        })
      }
    }
  }

  if (has("v2_full") && has("policy_memory")) {
    for (const fr of failureRates) {
      const sig = EXPERIMENT_SIGNIFICANCE.find((row) => row.arm_a === "v2_full" && row.arm_b === "policy_memory" && row.failure_rate === fr)
      if (!sig || sig.p_value === null) continue
      if (!sig.significant) {
        insights.push({
          id: `v2-vs-policy-similar-${fr}`,
          tone: "neutral",
          title: `v2 Full and Policy Memory are statistically similar at FR=${fr}`,
          description: `Chi-square p=${sig.p_value.toFixed(sig.p_value < 0.001 ? 5 : 3)} — not significant at p<0.05.`,
        })
      }
    }
  }

  if (has("v2_full") && has("memory_augmented")) {
    for (const fr of failureRates) {
      const augmented = getResult("memory_augmented", fr)
      const v2 = getResult("v2_full", fr)
      const engineeringGainPts = (v2.resolution_rate - augmented.resolution_rate) * 100
      if (has("policy_memory")) {
        const policy = getResult("policy_memory", fr)
        const policyGainPts = (policy.resolution_rate - v2.resolution_rate) * 100
        if (Math.abs(engineeringGainPts) >= 10 && Math.abs(engineeringGainPts) > Math.abs(policyGainPts)) {
          insights.push({
            id: `template-abstraction-${fr}`,
            tone: engineeringGainPts > 0 ? "positive" : "warning",
            title: `v2 Full's engineering changes explain most of the movement at FR=${fr}`,
            description: `Memory Augmented → v2 Full: ${engineeringGainPts > 0 ? "+" : ""}${engineeringGainPts.toFixed(1)} pts. v2 Full → Policy Memory: ${policyGainPts > 0 ? "+" : ""}${policyGainPts.toFixed(1)} pts.`,
          })
        }
      }
    }
  }

  if (has("policy_memory")) {
    const rates = failureRates.map((fr) => getResult("policy_memory", fr).policy_retrieval_rate).filter((v): v is number => v !== null)
    if (rates.length === failureRates.length && rates.length > 0 && rates.every((rate) => rate >= 0.95)) {
      insights.push({
        id: "policy-retrieval-stable",
        tone: "positive",
        title: "Policy retrieval rate stays above 95% across every selected failure rate",
        description: `${rates.map((rate) => `${(rate * 100).toFixed(1)}%`).join(", ")} — the retrieval mechanism itself doesn't degrade under injected tool failures.`,
      })
    }
  }

  if (has("policy_memory") && failureRates.includes("0.7") && arms.some((arm) => arm === "v2_full")) {
    const policy07 = getResult("policy_memory", "0.7")
    if (policy07.resolution_rate < getResult("v2_full", "0.7").resolution_rate) {
      insights.push({
        id: "root-cause-fr07",
        tone: "warning",
        title: "Policy Memory degrades faster than v2 Full at FR=0.7",
        description: `${ROOT_CAUSE_FR07.policy_memory.unresolvedTickets} unresolved tickets vs v2 Full's ${ROOT_CAUSE_FR07.v2_full.unresolvedTickets}; Critic diagnosis accuracy drops to ${(ROOT_CAUSE_FR07.policy_memory.criticAccuracy * 100).toFixed(0)}% (v2 Full: ${(ROOT_CAUSE_FR07.v2_full.criticAccuracy * 100).toFixed(0)}%).`,
      })
    }
  }

  if (has("policy_memory")) {
    const fr03 = getResult("policy_memory", "0.3")
    if (fr03.resolution_rate_policy_hit !== null && fr03.resolution_rate_no_hit !== null) {
      const gapPts = (fr03.resolution_rate_policy_hit - fr03.resolution_rate_no_hit) * 100
      if (gapPts >= 20 && failureRates.includes("0.3")) {
        insights.push({
          id: "policy-hit-gap-0.3",
          tone: "warning",
          title: "Resolution depends heavily on getting a policy hit at FR=0.3",
          description: `${(fr03.resolution_rate_policy_hit * 100).toFixed(1)}% resolved on a policy hit vs only ${(fr03.resolution_rate_no_hit * 100).toFixed(1)}% without one.`,
        })
      }
    }
  }

  return insights
}
