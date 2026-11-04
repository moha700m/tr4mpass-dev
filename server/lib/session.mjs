import { EncryptJWT, jwtDecrypt } from 'jose'
import { randomBytes } from 'node:crypto'

const COOKIE = 'trenda_session'
const OAUTH_COOKIE = 'trenda_oauth'

function getSessionSecret() {
  return (process.env.SESSION_SECRET || 'trenda-dev-session-secret-change-me').trim()
}

async function secretKey() {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(getSessionSecret()))
  return new Uint8Array(digest)
}

export function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (!k) continue
    out[k] = decodeURIComponent(rest.join('=') || '')
  }
  return out
}

function cookieFlags() {
  return ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Secure']
}

export function makeCookie(name, value, maxAge) {
  return [`${name}=${encodeURIComponent(value)}`, `Max-Age=${maxAge}`, ...cookieFlags()].join('; ')
}

export async function seal(payload) {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .encrypt(await secretKey())
}

export async function unseal(token) {
  try {
    const { payload } = await jwtDecrypt(token, await secretKey())
    return payload
  } catch {
    return null
  }
}

export function createSession() {
  return {
    id: `ses_${randomBytes(8).toString('hex')}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    accounts: [],
    activeAccountId: null,
    plan: 'free',
  }
}

export function publicSession(session, usage = { aiAttemptsUsed: 0, bulkImportsUsed: 0 }) {
  return {
    isAuthenticated: session.accounts.length > 0,
    plan: session.plan || 'free',
    aiAttemptsUsed: usage.aiAttemptsUsed || 0,
    bulkImportsUsed: usage.bulkImportsUsed || 0,
    activeAccountId: session.activeAccountId,
    accounts: session.accounts.map(
      ({ accessToken, accessTokenSecret, refreshToken, expiresAt, scope, ...acc }) => acc,
    ),
  }
}

export async function loadSession(req) {
  const raw = parseCookies(req.headers.cookie)[COOKIE]
  if (!raw) return null
  const data = await unseal(raw)
  if (!data?.id || !Array.isArray(data.accounts)) return null
  return data
}

export { COOKIE, OAUTH_COOKIE }
