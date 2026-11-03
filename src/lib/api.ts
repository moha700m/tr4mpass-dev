import type { AnalyticsPost, ScheduledPost, TweetPart } from '../types'

export class ApiError extends Error {
  status: number
  setup?: boolean
  remaining?: number
  freeFallback?: boolean

  constructor(
    message: string,
    status: number,
    extra?: { setup?: boolean; remaining?: number; freeFallback?: boolean },
  ) {
    super(message)
    this.status = status
    this.setup = extra?.setup
    this.remaining = extra?.remaining
    this.freeFallback = extra?.freeFallback
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers || {}),
    },
    ...init,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(data.error || 'حدث خطأ', res.status, {
      setup: data.setup,
      remaining: data.remaining,
      freeFallback: data.freeFallback,
    })
  }
  return data as T
}

export interface SessionResponse {
  isAuthenticated: boolean
  plan: 'free' | 'pro'
  aiAttemptsUsed: number
  bulkImportsUsed?: number
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

export interface UsageInfo {
  aiAttemptsUsed: number
  bulkImportsUsed: number
}

export const api = {
  me: () => request<SessionResponse>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  disconnect: (accountId: string) =>
    request<SessionResponse & { ok: boolean }>('/api/accounts/disconnect', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    }),
  setActive: (accountId: string) =>
    request<SessionResponse>('/api/accounts/active', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    }),
  publish: (parts: Array<string | TweetPart>, accountId?: string) =>
    request<{ ok: boolean; tweetIds: string[]; url: string | null }>('/api/posts/publish', {
      method: 'POST',
      body: JSON.stringify({ parts, accountId }),
    }),
  recordManualPublish: (parts: TweetPart[], tweetIds: string[], accountId?: string) =>
    request<{ ok: boolean; url: string | null; postId: string }>('/api/posts/publish-manual', {
      method: 'POST',
      body: JSON.stringify({ parts, tweetIds, accountId }),
    }),
  listPosts: () => request<{ posts: ScheduledPost[]; slots: number[] }>('/api/posts'),
  schedule: (parts: TweetPart[], scheduledAt: string, accountId?: string) =>
    request<{ post: ScheduledPost }>('/api/posts/schedule', {
      method: 'POST',
      body: JSON.stringify({ parts, scheduledAt, accountId }),
    }),
  reschedule: (id: string, scheduledAt: string) =>
    request<{ post: ScheduledPost }>('/api/posts/reschedule', {
      method: 'POST',
      body: JSON.stringify({ id, scheduledAt }),
    }),
  nextSlot: () => request<{ slot: string; slots: number[] }>('/api/posts/next-slot'),
  aiThread: (idea: string) =>
    request<{ parts: string[]; usage: UsageInfo }>('/api/ai/thread', {
      method: 'POST',
      body: JSON.stringify({ idea }),
    }),
  aiImprove: (text: string) =>
    request<{ text: string; usage: UsageInfo }>('/api/ai/improve', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  aiSaudi: (text: string) =>
    request<{ text: string; usage: UsageInfo }>('/api/ai/saudi', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  aiImport: (url: string, keepMedia = true, accountId?: string) =>
    request<{ parts: TweetPart[]; usage: UsageInfo }>('/api/ai/import', {
      method: 'POST',
      body: JSON.stringify({ url, keepMedia, accountId }),
    }),
  uploadMedia: (base64: string, mimeType: string, accountId?: string) =>
    request<{ mediaId: string }>('/api/media/upload', {
      method: 'POST',
      body: JSON.stringify({ base64, mimeType, accountId }),
    }),
  bulkImport: (payload: {
    links: string[]
    accountId?: string
    rewrite?: boolean
    keepMedia?: boolean
    promoText?: string
    promoPlace?: 'start' | 'end'
    rewritePromo?: boolean
  }) =>
    request<{
      posts: ScheduledPost[]
      usage: UsageInfo
      remaining: number | null
    }>('/api/import/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  analytics: (range: string, sort: string) =>
    request<{
      posts: AnalyticsPost[]
      totals: {
        views: number
        likes: number
        replies: number
        reposts: number
        bookmarks: number
      }
    }>(`/api/analytics?range=${range}&sort=${sort}`),
}

export function startXLogin() {
  window.location.href = '/api/auth/x/start'
}
