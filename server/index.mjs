import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EncryptJWT, jwtDecrypt } from 'jose'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 3000)

const X_SCOPES = 'tweet.read tweet.write users.read offline.access media.write'
const COOKIE = 'hudu_session'
const OAUTH_COOKIE = 'hudu_oauth'

function getXClientId() {
  return (process.env.X_CLIENT_ID || '').trim()
}
function getXClientSecret() {
  return (process.env.X_CLIENT_SECRET || '').trim()
}
function getSessionSecret() {
  return (process.env.SESSION_SECRET || 'hudu-dev-session-secret-change-me').trim()
}
function isXConfigured() {
  return Boolean(getXClientId())
}

async function secretKey() {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(getSessionSecret()))
  return new Uint8Array(digest)
}

function randomString(length = 64) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

function toBase64Url(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const b of arr) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function createPkcePair() {
  const verifier = randomString(64)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: toBase64Url(digest) }
}

function parseCookies(header) {
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

function makeCookie(name, value, maxAge) {
  return [`${name}=${encodeURIComponent(value)}`, `Max-Age=${maxAge}`, ...cookieFlags()].join('; ')
}

async function seal(payload) {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .encrypt(await secretKey())
}

async function unseal(token) {
  try {
    const { payload } = await jwtDecrypt(token, await secretKey())
    return payload
  } catch {
    return null
  }
}

function createSession() {
  return {
    id: `ses_${randomString(12)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    accounts: [],
    activeAccountId: null,
    plan: 'free',
    aiAttemptsUsed: 0,
  }
}

function publicSession(session) {
  return {
    isAuthenticated: session.accounts.length > 0,
    plan: session.plan,
    aiAttemptsUsed: session.aiAttemptsUsed,
    activeAccountId: session.activeAccountId,
    accounts: session.accounts.map(({ accessToken, refreshToken, expiresAt, scope, ...acc }) => acc),
  }
}

async function loadSession(req) {
  const raw = parseCookies(req.headers.cookie)[COOKIE]
  if (!raw) return null
  const data = await unseal(raw)
  if (!data?.id || !Array.isArray(data.accounts)) return null
  return data
}

function basicAuthHeader() {
  const secret = getXClientSecret()
  if (!secret) return null
  return `Basic ${Buffer.from(`${getXClientId()}:${secret}`).toString('base64')}`
}

async function exchangeCodeForToken({ code, redirectUri, codeVerifier }) {
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
  const basic = basicAuthHeader()
  if (basic) headers.Authorization = basic
  else body.set('client_id', getXClientId())
  const res = await fetch('https://api.x.com/2/oauth2/token', { method: 'POST', headers, body })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'فشل تبادل رمز X')
  return data
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
  const basic = basicAuthHeader()
  if (basic) headers.Authorization = basic
  else body.set('client_id', getXClientId())
  const res = await fetch('https://api.x.com/2/oauth2/token', { method: 'POST', headers, body })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'فشل تجديد توكن X')
  return data
}

async function revokeToken(token) {
  const body = new URLSearchParams({ token })
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
  const basic = basicAuthHeader()
  if (basic) headers.Authorization = basic
  else body.set('client_id', getXClientId())
  await fetch('https://api.x.com/2/oauth2/revoke', { method: 'POST', headers, body })
}

async function fetchXUser(accessToken) {
  const res = await fetch('https://api.x.com/2/users/me?user.fields=profile_image_url,name,username', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.title || 'فشل جلب حساب X')
  return data.data
}

async function createTweet(accessToken, text, replyToId) {
  const payload = { text }
  if (replyToId) payload.reply = { in_reply_to_tweet_id: replyToId }
  const res = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.title || 'فشل نشر المنشور')
  return data.data
}

async function createThread(accessToken, parts) {
  const ids = []
  let previousId
  for (const text of parts) {
    const trimmed = text.trim()
    if (!trimmed) continue
    const tweet = await createTweet(accessToken, trimmed, previousId)
    ids.push(tweet.id)
    previousId = tweet.id
  }
  return ids
}

function sendJson(res, status, data, cookies = []) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' }
  if (cookies.length) headers['Set-Cookie'] = cookies
  res.writeHead(status, headers)
  res.end(JSON.stringify(data))
}

function redirect(res, location, cookies = []) {
  const headers = { Location: location }
  if (cookies.length) headers['Set-Cookie'] = cookies
  res.writeHead(302, headers)
  res.end()
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function originFrom(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

async function handleApi(req, res, url) {
  const pathname = url.pathname

  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, app: 'hudu', xConfigured: isXConfigured() })
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    let session = await loadSession(req)
    const cookies = []
    if (!session) {
      session = createSession()
      cookies.push(makeCookie(COOKIE, await seal(session), 60 * 60 * 24 * 30))
    }
    return sendJson(res, 200, { ...publicSession(session), xConfigured: isXConfigured() }, cookies)
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const session = await loadSession(req)
    if (session) {
      for (const account of session.accounts) {
        try {
          await revokeToken(account.accessToken)
        } catch {
          // ignore
        }
      }
    }
    return sendJson(res, 200, { ok: true }, [makeCookie(COOKIE, '', 0)])
  }

  if (pathname === '/api/auth/x/start' && req.method === 'GET') {
    if (!isXConfigured()) {
      return sendJson(res, 503, {
        error: 'ربط X غير مفعّل بعد. أضف X_CLIENT_ID في Render.',
        setup: true,
      })
    }
    const session = (await loadSession(req)) || createSession()
    const { verifier, challenge } = await createPkcePair()
    const state = randomString(32)
    const redirectUri = `${originFrom(req)}/api/auth/x/callback`
    const authorize = new URL('https://x.com/i/oauth2/authorize')
    authorize.searchParams.set('response_type', 'code')
    authorize.searchParams.set('client_id', getXClientId())
    authorize.searchParams.set('redirect_uri', redirectUri)
    authorize.searchParams.set('scope', X_SCOPES)
    authorize.searchParams.set('state', state)
    authorize.searchParams.set('code_challenge', challenge)
    authorize.searchParams.set('code_challenge_method', 'S256')
    return redirect(res, authorize.toString(), [
      makeCookie(COOKIE, await seal(session), 60 * 60 * 24 * 30),
      makeCookie(OAUTH_COOKIE, await seal({ verifier, state, redirectUri }), 600),
    ])
  }

  if (pathname === '/api/auth/x/callback' && req.method === 'GET') {
    const origin = originFrom(req)
    const error = url.searchParams.get('error')
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (error) return redirect(res, `${origin}/login?error=${encodeURIComponent(error)}`)
    if (!code || !state) return sendJson(res, 400, { error: 'طلب غير مكتمل من X' })

    const oauthRaw = parseCookies(req.headers.cookie)[OAUTH_COOKIE]
    const oauth = oauthRaw ? await unseal(oauthRaw) : null
    if (!oauth?.verifier || !oauth.redirectUri || oauth.state !== state) {
      return redirect(res, `${origin}/login?error=invalid_state`)
    }

    let session = (await loadSession(req)) || createSession()
    try {
      const tokens = await exchangeCodeForToken({
        code,
        redirectUri: oauth.redirectUri,
        codeVerifier: oauth.verifier,
      })
      const user = await fetchXUser(tokens.access_token)
      const account = {
        id: user.id,
        handle: user.username,
        name: user.name,
        avatarUrl:
          user.profile_image_url?.replace('_normal', '_400x400') ||
          `https://api.dicebear.com/9.x/initials/svg?seed=${user.username}`,
        connectedAt: new Date().toISOString(),
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        scope: tokens.scope,
      }
      const maxAccounts = session.plan === 'pro' ? 3 : 1
      const idx = session.accounts.findIndex((a) => a.id === account.id)
      if (idx >= 0) session.accounts[idx] = account
      else if (session.accounts.length >= maxAccounts) {
        return redirect(res, `${origin}/more?error=${encodeURIComponent('وصلت لحد الحسابات في خطتك')}`)
      } else session.accounts.push(account)
      session.activeAccountId = account.id
      return redirect(res, `${origin}/write?connected=1`, [
        makeCookie(COOKIE, await seal(session), 60 * 60 * 24 * 30),
        makeCookie(OAUTH_COOKIE, '', 0),
      ])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل الربط مع X'
      return redirect(res, `${origin}/login?error=${encodeURIComponent(message)}`)
    }
  }

  if (pathname === '/api/accounts/disconnect' && req.method === 'POST') {
    const session = await loadSession(req)
    if (!session) return sendJson(res, 401, { error: 'غير مسجّل' })
    const body = await readBody(req)
    const account = session.accounts.find((a) => a.id === body.accountId)
    if (!account) return sendJson(res, 404, { error: 'الحساب غير موجود' })
    try {
      await revokeToken(account.accessToken)
    } catch {
      // ignore
    }
    session.accounts = session.accounts.filter((a) => a.id !== body.accountId)
    if (session.activeAccountId === body.accountId) {
      session.activeAccountId = session.accounts[0]?.id || null
    }
    return sendJson(
      res,
      200,
      { ok: true, accounts: publicSession(session).accounts },
      [makeCookie(COOKIE, await seal(session), 60 * 60 * 24 * 30)],
    )
  }

  if (pathname === '/api/accounts/active' && req.method === 'POST') {
    const session = await loadSession(req)
    if (!session) return sendJson(res, 401, { error: 'غير مسجّل' })
    const body = await readBody(req)
    if (!session.accounts.some((a) => a.id === body.accountId)) {
      return sendJson(res, 404, { error: 'الحساب غير موجود' })
    }
    session.activeAccountId = body.accountId
    return sendJson(res, 200, publicSession(session), [
      makeCookie(COOKIE, await seal(session), 60 * 60 * 24 * 30),
    ])
  }

  if (pathname === '/api/posts/publish' && req.method === 'POST') {
    const session = await loadSession(req)
    if (!session?.accounts.length) return sendJson(res, 401, { error: 'اربط حساب X أولاً' })
    const body = await readBody(req)
    const accountId = body.accountId || session.activeAccountId
    if (!accountId) return sendJson(res, 400, { error: 'اختر حساباً' })
    if (!body.parts?.length) return sendJson(res, 400, { error: 'لا يوجد نص للنشر' })
    try {
      const account = session.accounts.find((a) => a.id === accountId)
      if (!account) return sendJson(res, 404, { error: 'الحساب غير موجود' })
      if (account.refreshToken && account.expiresAt && account.expiresAt < Date.now() + 60_000) {
        const tokens = await refreshAccessToken(account.refreshToken)
        account.accessToken = tokens.access_token
        account.refreshToken = tokens.refresh_token || account.refreshToken
        account.expiresAt = Date.now() + tokens.expires_in * 1000
      }
      const ids = await createThread(account.accessToken, body.parts)
      return sendJson(
        res,
        200,
        {
          ok: true,
          tweetIds: ids,
          url: ids[0] ? `https://x.com/${account.handle}/status/${ids[0]}` : null,
        },
        [makeCookie(COOKIE, await seal(session), 60 * 60 * 24 * 30)],
      )
    } catch (err) {
      return sendJson(res, 502, { error: err instanceof Error ? err.message : 'فشل النشر' })
    }
  }

  return sendJson(res, 404, { error: 'Not found' })
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

async function serveStatic(req, res, url) {
  let filePath = path.join(DIST, decodeURIComponent(url.pathname))
  if (url.pathname === '/' || !(await existsSafe(filePath))) {
    filePath = path.join(DIST, 'index.html')
  }
  try {
    const info = await stat(filePath)
    if (!info.isFile()) throw new Error('not file')
    const ext = path.extname(filePath)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    createReadStream(filePath).pipe(res)
  } catch {
    const fallback = path.join(DIST, 'index.html')
    const html = await readFile(fallback)
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  }
}

async function existsSafe(p) {
  try {
    if (!existsSync(p)) return false
    const info = await stat(p)
    return info.isFile()
  } catch {
    return false
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url)
    return await serveStatic(req, res, url)
  } catch (err) {
    console.error(err)
    sendJson(res, 500, { error: 'Internal error' })
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`هدوء running on 0.0.0.0:${PORT}`)
})
