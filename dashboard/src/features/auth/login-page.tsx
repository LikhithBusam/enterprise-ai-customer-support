import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate, useLocation } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { loginSchema, type LoginFormValues } from "@/features/auth/schema"
import { useAuth } from "@/features/auth/auth-context"
import { APP_NAME } from "@/lib/constants"

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  function onSubmit(values: LoginFormValues): void {
    setSubmitError(null)
    try {
      signIn(values.email, values.apiKey)
      const redirectTo = (location.state as { from?: string } | null)?.from ?? "/"
      navigate(redirectTo, { replace: true })
    } catch {
      setSubmitError("Something went wrong signing in. Please try again.")
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold">
            SC
          </div>
          <CardTitle className="text-xl">Sign in to {APP_NAME}</CardTitle>
          <CardDescription>Use your workspace email and API key</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
              />
              {errors.email && (
                <p id="email-error" className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="apiKey">API key</Label>
              <Input
                id="apiKey"
                type="password"
                autoComplete="current-password"
                placeholder="sk_live_…"
                aria-invalid={Boolean(errors.apiKey)}
                aria-describedby={errors.apiKey ? "api-key-error" : undefined}
                {...register("apiKey")}
              />
              {errors.apiKey && (
                <p id="api-key-error" className="text-xs text-destructive">
                  {errors.apiKey.message}
                </p>
              )}
            </div>

            {submitError && <p className="text-sm text-destructive">{submitError}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
