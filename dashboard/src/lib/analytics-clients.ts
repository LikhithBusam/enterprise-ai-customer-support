/** Mirrors the placeholder tenant list in app/client-context.tsx (id/name pairs only — that
 * context isn't wired to any real data yet, so this file intentionally doesn't import it).
 * Analytics buckets each mocked conversation into one of these so the "Client" filter has
 * something real and consistent to filter by, without inventing a fourth client. */
export interface AnalyticsClientOption {
  id: string
  name: string
}

export const ANALYTICS_CLIENTS: AnalyticsClientOption[] = [
  { id: "acme-retail", name: "Acme Retail" },
  { id: "nova-goods", name: "Nova Goods" },
  { id: "brightpath", name: "BrightPath Inc." },
]

export function analyticsClientName(clientId: string): string {
  return ANALYTICS_CLIENTS.find((client) => client.id === clientId)?.name ?? clientId
}
