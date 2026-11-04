import { getStore } from '@netlify/blobs'
import type { XAccount } from '../../../src/types'
import { randomishId } from './crypto'

export interface ConnectedAccount extends XAccount {
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

const COOKIE = 'trenda_session'
const TTL_SECONDS = 60 * 60 * 24 * 30

function store() {
  return getStore({ name: 'trenda-sessions', consistency: 'strong' })
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

export function sessionCookie(id: string, maxAge = TTL_SECONDS) {
  const secure = process.env.NETLIFY === 'true' || process.env.CONTEXT === 'production'
  return [
    `${COOKIE}=${encodeURIComponent(id)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export async function getSessionId(req: Request) {
  const cookies = parseCookies(req.headers.get('cookie'))
  return cookies[COOKIE] || null
}

export async function loadSession(req: Request): Promise<SessionData | null> {
  const id = await getSessionId(req)
  if (!id) return null
  try {
    const data = await store().get(id, { type: 'json' })
    return (data as SessionData) || null
  } catch {
    return null
  }
}

export async function saveSession(session: SessionData) {
  session.updatedAt = new Date().toISOString()
  await store().setJSON(session.id, session)
  return session
}

export async function createSession(): Promise<SessionData> {
  const session: SessionData = {
    id: randomishId('ses'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    accounts: [],
    activeAccountId: null,
    plan: 'free',
    aiAttemptsUsed: 0,
  }
  await saveSession(session)
  return session
}

export async function requireSession(req: Request) {
  let session = await loadSession(req)
  if (!session) session = await createSession()
  return session
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

export async function saveOauthState(state: string, payload: Record<string, string>) {
  await store().setJSON(`oauth:${state}`, payload, { metadata: { kind: 'oauth' } })
}

export async function takeOauthState(state: string) {
  const key = `oauth:${state}`
  const data = await store().get(key, { type: 'json' })
  if (data) await store().delete(key)
  return data as Record<string, string> | null
}
