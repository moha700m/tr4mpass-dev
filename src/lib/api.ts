export class ApiError extends Error {
  status: number
  setup?: boolean

  constructor(message: string, status: number, setup?: boolean) {
    super(message)
    this.status = status
    this.setup = setup
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(data.error || 'حدث خطأ', res.status, data.setup)
  }
  return data as T
}

export interface SessionResponse {
  isAuthenticated: boolean
  plan: 'free' | 'pro'
  aiAttemptsUsed: number
  activeAccountId: string | null
  accounts: Array<{
    id: string
    handle: string
    name: string
    avatarUrl: string
    connectedAt: string
  }>
  xConfigured: boolean
}

export const api = {
  me: () => request<SessionResponse>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  disconnect: (accountId: string) =>
    request<{ ok: boolean }>('/api/accounts/disconnect', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    }),
  setActive: (accountId: string) =>
    request<SessionResponse>('/api/accounts/active', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    }),
  publish: (parts: string[], accountId?: string) =>
    request<{ ok: boolean; tweetIds: string[]; url: string | null }>('/api/posts/publish', {
      method: 'POST',
      body: JSON.stringify({ parts, accountId }),
    }),
}

export function startXLogin() {
  window.location.href = '/api/auth/x/start'
}
