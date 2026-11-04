import { getXClientId, getXClientSecret } from './env'
import type { ConnectedAccount, SessionData } from './types'

export interface XTokenResponse {
  token_type: string
  expires_in: number
  access_token: string
  scope: string
  refresh_token?: string
}

export interface XUser {
  id: string
  name: string
  username: string
  profile_image_url?: string
}

function basicAuthHeader() {
  const id = getXClientId()
  const secret = getXClientSecret()
  if (!secret) return null
  return `Basic ${btoa(`${id}:${secret}`)}`
}

export async function exchangeCodeForToken(params: {
  code: string
  redirectUri: string
  codeVerifier: string
}): Promise<XTokenResponse> {
  const body = new URLSearchParams({
    code: params.code,
    grant_type: 'authorization_code',
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  })
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  const basic = basicAuthHeader()
  if (basic) headers.Authorization = basic
  else body.set('client_id', getXClientId())

  const res = await fetch('https://api.x.com/2/oauth2/token', { method: 'POST', headers, body })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'فشل تبادل رمز X')
  return data as XTokenResponse
}

export async function refreshAccessToken(refreshToken: string): Promise<XTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  const basic = basicAuthHeader()
  if (basic) headers.Authorization = basic
  else body.set('client_id', getXClientId())

  const res = await fetch('https://api.x.com/2/oauth2/token', { method: 'POST', headers, body })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'فشل تجديد توكن X')
  return data as XTokenResponse
}

export async function revokeToken(token: string) {
  const body = new URLSearchParams({ token })
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  const basic = basicAuthHeader()
  if (basic) headers.Authorization = basic
  else body.set('client_id', getXClientId())
  await fetch('https://api.x.com/2/oauth2/revoke', { method: 'POST', headers, body })
}

export async function fetchXUser(accessToken: string): Promise<XUser> {
  const res = await fetch(
    'https://api.x.com/2/users/me?user.fields=profile_image_url,name,username',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.title || 'فشل جلب حساب X')
  return data.data as XUser
}

export async function ensureFreshAccount(session: SessionData, accountId: string) {
  const account = session.accounts.find((a) => a.id === accountId)
  if (!account) throw new Error('الحساب غير موجود')

  const needsRefresh =
    account.refreshToken && account.expiresAt && account.expiresAt < Date.now() + 60_000
  if (!needsRefresh) return account

  const tokens = await refreshAccessToken(account.refreshToken!)
  account.accessToken = tokens.access_token
  account.refreshToken = tokens.refresh_token || account.refreshToken
  account.expiresAt = Date.now() + tokens.expires_in * 1000
  account.scope = tokens.scope
  return account
}

async function createTweet(accessToken: string, text: string, replyToId?: string) {
  const payload: Record<string, unknown> = { text }
  if (replyToId) payload.reply = { in_reply_to_tweet_id: replyToId }

  const res = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.title || 'فشل نشر المنشور')
  return data.data as { id: string; text: string }
}

export async function createThread(accessToken: string, parts: string[]) {
  const ids: string[] = []
  let previousId: string | undefined
  for (const text of parts) {
    const trimmed = text.trim()
    if (!trimmed) continue
    const tweet = await createTweet(accessToken, trimmed, previousId)
    ids.push(tweet.id)
    previousId = tweet.id
  }
  return ids
}

export type { ConnectedAccount }
