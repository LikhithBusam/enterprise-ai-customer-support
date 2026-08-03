import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

/**
 * SECURITY NOTE: the API key is stored in localStorage, not an httpOnly cookie. This is a
 * deliberate, documented tradeoff, not an oversight: the verified real backend
 * (src/api/auth.py) authenticates purely via a client-sent `X-API-Key` header on every request —
 * there is no session/cookie endpoint, and adding one is a backend change out of scope for this
 * frontend-only build (see API_CONTRACT.md). httpOnly cookies aren't achievable against the
 * current auth model without that backend work. Flagged here so it isn't silently carried
 * forward as an accepted pattern once a real session mechanism exists.
 */

export interface AuthSession {
  email: string
}

interface AuthContextValue {
  session: AuthSession | null
  isAuthenticated: boolean
  signIn: (email: string, apiKey: string) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY_EMAIL = "user_email"
const STORAGE_KEY_API_KEY = "api_key"

function loadInitialSession(): AuthSession | null {
  const email = localStorage.getItem(STORAGE_KEY_EMAIL)
  const apiKey = localStorage.getItem(STORAGE_KEY_API_KEY)
  if (email && apiKey) {
    return { email }
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(loadInitialSession)

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: session !== null,
      signIn: (email: string, apiKey: string) => {
        localStorage.setItem(STORAGE_KEY_EMAIL, email)
        localStorage.setItem(STORAGE_KEY_API_KEY, apiKey)
        setSession({ email })
      },
      signOut: () => {
        localStorage.removeItem(STORAGE_KEY_EMAIL)
        localStorage.removeItem(STORAGE_KEY_API_KEY)
        setSession(null)
      },
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
