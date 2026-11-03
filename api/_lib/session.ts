import { EncryptJWT, jwtDecrypt } from 'jose'
import { getSessionSecret } from './env'
import { randomishId } from './crypto'
import type { SessionData } from './types'

const COOKIE = 'hudu_session'
const OAUTH_COOKIE = 'hudu_oauth'
const TTL = '30d'

async function secretKey() {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(getSessionSecret()),
  )
  return new Uint8Array(digest)
}

export function parseCookies(header: string | null) {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (!k) continue
    out[k] = decodeURIComponent(rest.join('=') || '')
  }
  return out
}

function cookieFlags() {
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
  return [`Path=/`, `HttpOnly`, `SameSite=Lax`, secure ? 'Secure' : ''].filter(Boolean)
}

export function sessionCookie(value: string, maxAge = 60 * 60 * 24 * 30) {
  return [`${COOKIE}=${encodeURIComponent(value)}`, `Max-Age=${maxAge}`, ...cookieFlags()].join('; ')
}

export function clearSessionCookie() {
  return [`${COOKIE}=`, 'Max-Age=0', ...cookieFlags()].join('; ')
}

export function oauthCookie(value: string) {
  return [`${OAUTH_COOKIE}=${encodeURIComponent(value)}`, 'Max-Age=600', ...cookieFlags()].join('; ')
}

export function clearOauthCookie() {
  return [`${OAUTH_COOKIE}=`, 'Max-Age=0', ...cookieFlags()].join('; ')
}

async function seal(payload: Record<string, unknown>) {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .encrypt(await secretKey())
}

async function unseal<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtDecrypt(token, await secretKey())
    return payload as T
  } catch {
    return null
  }
}

export async function loadSession(req: Request): Promise<SessionData | null> {
  const cookies = parseCookies(req.headers.get('cookie'))
  const raw = cookies[COOKIE]
  if (!raw) return null
  const data = await unseal<SessionData>(raw)
  if (!data?.id || !Array.isArray(data.accounts)) return null
  return data
}

export async function createSession(): Promise<SessionData> {
  return {
    id: randomishId('ses'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    accounts: [],
    activeAccountId: null,
    plan: 'free',
    aiAttemptsUsed: 0,
  }
}

export async function requireSession(req: Request) {
  return (await loadSession(req)) || (await createSession())
}

export async function encodeSession(session: SessionData) {
  session.updatedAt = new Date().toISOString()
  return seal({ ...session })
}

export function publicSession(session: SessionData) {
  return {
    isAuthenticated: session.accounts.length > 0,
    plan: session.plan,
    aiAttemptsUsed: session.aiAttemptsUsed,
    activeAccountId: session.activeAccountId,
    accounts: session.accounts.map((acc) => ({
      id: acc.id,
      handle: acc.handle,
      name: acc.name,
      avatarUrl: acc.avatarUrl,
      connectedAt: acc.connectedAt,
    })),
  }
}

export async function encodeOauthState(payload: Record<string, string>) {
  return seal(payload)
}

export async function decodeOauthState(req: Request) {
  const cookies = parseCookies(req.headers.get('cookie'))
  const raw = cookies[OAUTH_COOKIE]
  if (!raw) return null
  return unseal<Record<string, string>>(raw)
}
