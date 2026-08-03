import { BookOpen, FlaskConical, ListChecks, ShieldAlert, Wrench, type LucideIcon } from "lucide-react"
import type { MemoryType } from "@/types/mocked"

/** Mirrors src/memory/*.py's 5 memory entry schemas — shared across the Memory Explorer's
 * navigation, fixture generator, and inspector so labels never drift between them. */
export const MEMORY_TYPES: MemoryType[] = [
  "episodic",
  "plan_success",
  "tool_failure",
  "escalation",
  "policy",
]

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  episodic: "Episodic Memory",
  plan_success: "Plan Success Memory",
  tool_failure: "Tool Failure Memory",
  escalation: "Escalation Memory",
  policy: "Policy Memory",
}

export const MEMORY_TYPE_DESCRIPTIONS: Record<MemoryType, string> = {
  episodic: "Individual past ticket outcomes retrieved for similar future tickets.",
  plan_success: "Successful tool-call plans reused when a similar intent recurs.",
  tool_failure: "Recorded tool failures used to adjust reliability scoring.",
  escalation: "Tickets that needed human correction after auto-resolution failed.",
  policy: "Reusable workflow templates keyed by intent cluster (Contribution 2 research).",
}

export const MEMORY_TYPE_ICONS: Record<MemoryType, LucideIcon> = {
  episodic: BookOpen,
  plan_success: ListChecks,
  tool_failure: Wrench,
  escalation: ShieldAlert,
  policy: FlaskConical,
}
