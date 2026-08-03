import type { ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { ThemeProvider } from "next-themes"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { queryClient } from "@/lib/query-client"
import { AuthProvider } from "@/features/auth/auth-context"
import { ClientProvider } from "@/app/client-context"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          <AuthProvider>
            <ClientProvider>
              {children}
              <Toaster richColors position="top-right" />
            </ClientProvider>
          </AuthProvider>
        </TooltipProvider>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ThemeProvider>
  )
}
