export type ThemeMode = 'light' | 'dark' | 'system'
export type PlanId = 'free' | 'pro'
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'needs_attention' | 'failed'
export type AnalyticsSort = 'views' | 'newest'
export type AnalyticsRange = '30d' | '90d' | '1y'

export interface XAccount {
  id: string
  handle: string
  name: string
  avatarUrl: string
  connectedAt: string
}

export interface MediaAttachment {
  id: string
  type: 'image' | 'video' | 'gif'
  url: string
  name: string
  mediaId?: string
  mimeType?: string
  base64?: string
}

export interface TweetPart {
  id: string
  text: string
  media: MediaAttachment[]
}

export interface AnalyticsMetrics {
  views: number
  likes: number
  replies: number
  reposts: number
  bookmarks: number
  collectedAt?: string
}

export interface ScheduledPost {
  id: string
  accountId: string
  parts: TweetPart[]
  scheduledAt: string
  status: PostStatus
  publishedAt?: string
  createdAt: string
  tweetIds?: string[]
  metrics?: AnalyticsMetrics | null
  metricsCollectedAt?: string
}

export interface AnalyticsPost extends ScheduledPost {
  metrics: AnalyticsMetrics
}

export interface PlanLimits {
  id: PlanId
  name: string
  maxAccounts: number
  maxScheduled: number | 'unlimited'
  scheduleDays: number
  aiAttempts: number | 'unlimited'
  videoGif: boolean
  bulkImportUnlimited: boolean
}

export interface UserState {
  isAuthenticated: boolean
  plan: PlanId
  aiAttemptsUsed: number
  accounts: XAccount[]
  activeAccountId: string | null
}
