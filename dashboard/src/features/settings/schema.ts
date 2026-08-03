import { z } from "zod"

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
// One IPv4/IPv6 literal, optionally with a /nn CIDR suffix — good enough for a mock allow list;
// a real backend would validate this server-side too.
const CIDR_PATTERN = /^([0-9a-fA-F.:]+)(\/\d{1,3})?$/

export const TIME_ZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (New York)" },
  { value: "America/Chicago", label: "Central Time (Chicago)" },
  { value: "America/Denver", label: "Mountain Time (Denver)" },
  { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Asia/Kolkata", label: "India Standard Time" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Sydney", label: "Sydney" },
]

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
]

export const DATE_FORMAT_OPTIONS = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (07/31/2026)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/07/2026)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-07-31)" },
]

export const NUMBER_FORMAT_OPTIONS = [
  { value: "1,234.56", label: "1,234.56" },
  { value: "1.234,56", label: "1.234,56" },
  { value: "1 234.56", label: "1 234,56" },
]

export const generalSettingsSchema = z.object({
  organization_name: z.string().trim().min(2, "Must be at least 2 characters").max(80),
  organization_slug: z
    .string()
    .trim()
    .min(2, "Must be at least 2 characters")
    .max(60)
    .regex(SLUG_PATTERN, "Lowercase letters, numbers, and single hyphens only"),
  time_zone: z.string().min(1, "Select a time zone"),
  default_language: z.string().min(1, "Select a language"),
})
export type GeneralFormValues = z.infer<typeof generalSettingsSchema>

export const aiModelSettingsSchema = z.object({
  default_llm: z.string().min(1, "Select a default LLM"),
  temperature: z.number().min(0, "Must be at least 0").max(2, "Must be at most 2"),
  max_tokens: z
    .number()
    .int("Must be a whole number")
    .min(1, "Must be at least 1")
    .max(128_000, "Must be at most 128,000"),
  embedding_model: z.string().min(1, "Select an embedding model"),
  tool_timeout_seconds: z
    .number()
    .int("Must be a whole number")
    .min(1, "Must be at least 1 second")
    .max(300, "Must be at most 300 seconds"),
})
export type AiModelFormValues = z.infer<typeof aiModelSettingsSchema>

export const memorySettingsSchema = z.object({
  memory_enabled: z.boolean(),
  memory_retention_days: z
    .number()
    .int("Must be a whole number")
    .min(1, "Must be at least 1 day")
    .max(3650, "Must be at most 3650 days"),
  similarity_threshold: z.number().min(0, "Must be at least 0").max(1, "Must be at most 1"),
  max_memories: z
    .number()
    .int("Must be a whole number")
    .min(1, "Must be at least 1")
    .max(100_000, "Must be at most 100,000"),
  auto_cleanup: z.boolean(),
})
export type MemoryFormValues = z.infer<typeof memorySettingsSchema>

export const securitySettingsSchema = z.object({
  session_timeout_minutes: z
    .number()
    .int("Must be a whole number")
    .min(5, "Must be at least 5 minutes")
    .max(1440, "Must be at most 1440 minutes (24h)"),
  mfa_enabled: z.boolean(),
  ip_allow_list: z
    .string()
    .transform((value) =>
      value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .refine(
      (entries) => entries.every((entry) => CIDR_PATTERN.test(entry)),
      "One IP or CIDR range per line (e.g. 203.0.113.0/24)",
    ),
  audit_logging_enabled: z.boolean(),
})
export type SecurityFormValues = z.infer<typeof securitySettingsSchema>
// The form field is a single newline-delimited textarea; the saved/API shape is string[].
export type SecurityFormInput = Omit<SecurityFormValues, "ip_allow_list"> & { ip_allow_list: string }

export const notificationSettingsSchema = z.object({
  email_alerts: z.boolean(),
  slack_notifications: z.boolean(),
  failure_alerts: z.boolean(),
  weekly_reports: z.boolean(),
})
export type NotificationFormValues = z.infer<typeof notificationSettingsSchema>

export const appearanceSettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  density: z.enum(["comfortable", "compact"]),
  date_format: z.string().min(1, "Select a date format"),
  number_format: z.string().min(1, "Select a number format"),
})
export type AppearanceFormValues = z.infer<typeof appearanceSettingsSchema>
