import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  apiKey: z.string().min(1, "API key is required"),
})

export type LoginFormValues = z.infer<typeof loginSchema>
