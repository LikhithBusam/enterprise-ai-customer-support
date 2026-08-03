/** Renders only the last 4 characters the API ever exposes for a client's key — the full key
 * itself never reaches the frontend, mirroring how a real API key management UI would behave. */
export function maskApiKey(last4: string): string {
  return `sk_live_••••••••${last4}`
}
