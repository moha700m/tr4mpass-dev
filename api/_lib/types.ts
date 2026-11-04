export interface XAccountPublic {
  id: string
  handle: string
  name: string
  avatarUrl: string
  connectedAt: string
}

export interface ConnectedAccount extends XAccountPublic {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  scope?: string
}

export interface SessionData {
  id: string
  createdAt: string
  updatedAt: string
  accounts: ConnectedAccount[]
  activeAccountId: string | null
  plan: 'free' | 'pro'
  aiAttemptsUsed: number
}

export const PLANS = {
  free: { maxAccounts: 1 },
  pro: { maxAccounts: 3 },
} as const
