import { z } from "zod"

const URL_PATTERN = /^https?:\/\/.+/

export const profileInfoSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Must be at most 80 characters"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  avatar_url: z
    .string()
    .trim()
    .max(500, "Must be at most 500 characters")
    .refine((value) => value.length === 0 || URL_PATTERN.test(value), "Enter a valid http(s) URL"),
})
export type ProfileInfoFormValues = z.infer<typeof profileInfoSchema>

export const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  language: z.string().min(1, "Select a language"),
  timezone: z.string().min(1, "Select a time zone"),
})
export type PreferencesFormValues = z.infer<typeof preferencesSchema>
