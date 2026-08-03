import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

export interface ClientOption {
  clientId: string
  name: string
}

/** Placeholder list — replaced by a real query against the Client Management feature's
 * endpoint once that feature is built (see the approved plan's build order). */
const PLACEHOLDER_CLIENTS: ClientOption[] = [
  { clientId: "acme-retail", name: "Acme Retail" },
  { clientId: "nova-goods", name: "Nova Goods" },
  { clientId: "brightpath", name: "BrightPath Inc." },
]

interface ClientContextValue {
  clients: ClientOption[]
  activeClientId: string
  setActiveClientId: (clientId: string) => void
}

const ClientContext = createContext<ClientContextValue | null>(null)

export function ClientProvider({ children }: { children: ReactNode }) {
  const [activeClientId, setActiveClientId] = useState<string>(
    PLACEHOLDER_CLIENTS[0]?.clientId ?? "",
  )

  const value = useMemo<ClientContextValue>(
    () => ({ clients: PLACEHOLDER_CLIENTS, activeClientId, setActiveClientId }),
    [activeClientId],
  )

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>
}

export function useActiveClient(): ClientContextValue {
  const context = useContext(ClientContext)
  if (!context) {
    throw new Error("useActiveClient must be used within a ClientProvider")
  }
  return context
}
