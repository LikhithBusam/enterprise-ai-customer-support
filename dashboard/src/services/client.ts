import { API_BASE_URL } from "@/lib/constants"

export class ApiError extends Error {
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = "ApiError"
    this.status = status
    this.detail = detail
  }
}

function getApiKey(): string | null {
  return localStorage.getItem("api_key")
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  signal?: AbortSignal
}

export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const apiKey = getApiKey()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (apiKey) {
    headers["X-API-Key"] = apiKey
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })

  if (!response.ok) {
    let detail = response.statusText
    try {
      const payload = (await response.json()) as { detail?: string }
      detail = payload.detail ?? detail
    } catch {
      // Response body wasn't JSON — fall back to statusText.
    }
    throw new ApiError(response.status, detail)
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  return (await response.json()) as TResponse
}
