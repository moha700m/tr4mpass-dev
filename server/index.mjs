import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initDb } from './lib/db.mjs'
import {
  COOKIE,
  OAUTH_COOKIE,
  createSession,
  loadSession,
  makeCookie,
  parseCookies,
  publicSession,
  seal,
  unseal,
} from './lib/session.mjs'
import {
  bumpUsage,
  countScheduled,
  createPost,
  duePosts,
  getUsage,
  listPosts,
  nextFreeSlot,
  postsNeedingMetrics,
  SUGGESTED_SLOTS,
  updatePost,
} from './lib/posts.mjs'
import { improveText, rewriteThreadParts, toSaudi, writeThreadFromIdea } from './lib/ai.mjs'
import {
  authorizeUrl,
  getAccessToken,
  getRequestToken,
  isOAuth1Configured,
} from './lib/oauth1.mjs'
import {
  basicAuthHeader,
  createThread,
  ensureFreshAccount,
  extractStatusId,
  fetchThreadByUrl,
  fetchTweetMetrics,
  fetchXUser,
  getXClientId,
  isXConfigured,
  revokeAccountToken,
  uploadMedia,
  usesOAuth1,
} from './lib/x.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 3000)

const PLAN = {
  free: { maxAccounts: 1, maxScheduled: 10, scheduleDays: 7, aiAttempts: 15, bulkLimit: 5, videoGif: false },
  pro: { maxAccounts: 3, maxScheduled: Infinity, scheduleDays: 365, aiAttempts: Infinity, bulkLimit: Infinity, videoGif: true },
}

function planOf(session) {
  return PLAN[session.plan || 'free'] || PLAN.free
}

function originFrom(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

function sendJson(res, status, data, cookies = []) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' }
  if (cookies.length === 1) headers['Set-Cookie'] = cookies[0]
  else if (cookies.length > 1) headers['Set-Cookie'] = cookies
  res.writeHead(status, headers)
  res.end(JSON.stringify(data))
}

function redirect(res, location, cookies = []) {
  const headers = { Location: location }
  if (cookies.length === 1) headers['Set-Cookie'] = cookies[0]
  else if (cookies.length > 1) headers['Set-Cookie'] = cookies
  res.writeHead(302, headers)
  res.end()
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks)
  const type = req.headers['content-type'] || ''
  if (type.includes('multipart/form-data')) return { raw, type }
  if (!raw.length) return {}
  try {
    return JSON.parse(raw.toString('utf8'))
  } catch {
    return {}
  }
}

async function readRaw(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
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

async function sessionCookie(session) {
  return makeCookie(COOKIE, await seal(session), 60 * 60 * 24 * 30)
}

async function requireAuth(req, res) {
  const session = await loadSession(req)
  if (!session?.accounts?.length) {
    sendJson(res, 401, { error: 'اربط حساب X أولاً' })
    return null
  }
  return session
}

async function consumeAi(session) {
  const limits = planOf(session)
  const usage = await getUsage(session.id)
  if (Number.isFinite(limits.aiAttempts) && usage.aiAttemptsUsed >= limits.aiAttempts) {
    const err = new Error('خلصت محاولات الذكاء في خطتك')
    err.status = 402
    throw err
  }
  return bumpUsage(session.id, 'ai', 1)
}

async function resolveMediaIds(account, part) {
  const mediaIds = [...(part.mediaIds || [])]
  if (!Array.isArray(part.media)) return mediaIds
  for (const m of part.media) {
    if (m.mediaId) {
      mediaIds.push(m.mediaId)
      continue
    }
    if (m.base64 && m.mimeType) {
      const buf = Buffer.from(m.base64, 'base64')
      mediaIds.push(await uploadMedia(account, buf, m.mimeType))
      continue
    }
    if (m.url && /^https?:\/\//i.test(m.url)) {
      try {
        const res = await fetch(m.url)
        if (!res.ok) continue
        const mimeType = res.headers.get('content-type') || m.mimeType || 'image/jpeg'
        const buf = Buffer.from(await res.arrayBuffer())
        mediaIds.push(await uploadMedia(account, buf, mimeType.split(';')[0]))
      } catch {
        // skip broken media
      }
    }
  }
  return [...new Set(mediaIds)]
}

async function publishParts(session, accountId, parts) {
  const account = session.accounts.find((a) => a.id === accountId)
  if (!account) throw new Error('الحساب غير موجود')
  await ensureFreshAccount(account)
  const prepared = []
  for (const part of parts) {
    const text = typeof part === 'string' ? part : part.text || ''
    const mediaIds = typeof part === 'string' ? [] : await resolveMediaIds(account, part)
    prepared.push({ text, mediaIds })
  }
  const ids = await createThread(account, prepared)
  return { ids, account, session }
}

async function flushDuePosts(accountLookup) {
  const due = await duePosts()
  for (const post of due) {
    try {
      const sessionAccounts = accountLookup?.(post.sessionId)
      // Without live session tokens we cannot publish — mark needs_attention if no tokens injected
      if (!sessionAccounts) continue
      const account = sessionAccounts.find((a) => a.id === post.accountId)
      if (!account) {
        await updatePost(post.id, post.sessionId, { status: 'needs_attention' })
        continue
      }
      await ensureFreshAccount(account)
      const ids = await createThread(
        account,
        post.parts.map((p) => ({
          text: p.text,
          mediaIds: (p.media || []).map((m) => m.mediaId).filter(Boolean),
        })),
      )
      await updatePost(post.id, post.sessionId, {
        status: 'published',
        publishedAt: new Date().toISOString(),
        tweetIds: ids,
      })
    } catch (err) {
      console.error('schedule publish failed', post.id, err)
      await updatePost(post.id, post.sessionId, { status: 'failed' })
    }
  }
}

/** Publish due posts for the current user session (has tokens). */
async function flushSessionDue(session) {
  const due = (await duePosts()).filter((p) => p.sessionId === session.id)
  for (const post of due) {
    try {
      const account = session.accounts.find((a) => a.id === post.accountId)
      if (!account) {
        await updatePost(post.id, session.id, { status: 'needs_attention' })
        continue
      }
      const { ids } = await publishParts(session, account.id, post.parts)
      await updatePost(post.id, session.id, {
        status: 'published',
        publishedAt: new Date().toISOString(),
        tweetIds: ids,
      })
    } catch (err) {
      console.error('session schedule failed', post.id, err)
      await updatePost(post.id, session.id, { status: 'failed' })
    }
  }
}

async function collectMetricsForSession(session) {
  const pending = (await postsNeedingMetrics()).filter((p) => p.sessionId === session.id)
  for (const post of pending) {
    try {
      const account = session.accounts.find((a) => a.id === post.accountId)
      if (!account) continue
      await ensureFreshAccount(account)
      const rows = await fetchTweetMetrics(account, post.tweetIds || [])
      const agg = rows.reduce(
        (a, r) => {
          a.views += r.views
          a.likes += r.likes
          a.replies += r.replies
          a.reposts += r.reposts
          a.bookmarks += r.bookmarks
          return a
        },
        { views: 0, likes: 0, replies: 0, reposts: 0, bookmarks: 0 },
      )
      await updatePost(post.id, session.id, {
        metrics: agg,
        metricsCollectedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error('metrics failed', post.id, err)
    }
  }
}

async function handleApi(req, res, url) {
  const pathname = url.pathname

  // Opportunistic jobs when authenticated user hits any API
  if (pathname.startsWith('/api/') && pathname !== '/api/health') {
    const s = await loadSession(req)
    if (s?.accounts?.length) {
      flushSessionDue(s).catch(() => {})
      collectMetricsForSession(s).catch(() => {})
    }
  }

  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      app: 'trenda',
      xConfigured: isXConfigured(),
      slots: SUGGESTED_SLOTS,
      db: Boolean(process.env.DATABASE_URL),
    })
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    let session = await loadSession(req)
    const cookies = []
    if (!session) {
      session = createSession()
      cookies.push(await sessionCookie(session))
    }
    const usage = await getUsage(session.id)
    return sendJson(res, 200, { ...publicSession(session, usage), xConfigured: isXConfigured() }, cookies)
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const session = await loadSession(req)
    if (session) {
      for (const account of session.accounts) {
        try {
          await revokeAccountToken(account)
        } catch {
          // ignore
        }
      }
    }
    return sendJson(res, 200, { ok: true }, [makeCookie(COOKIE, '', 0)])
  }

  if (pathname === '/api/auth/x/start' && req.method === 'GET') {
    if (!isXConfigured()) {
      return sendJson(res, 503, { error: 'ربط X غير مفعّل بعد.', setup: true })
    }
    const session = (await loadSession(req)) || createSession()
    const origin = originFrom(req)
    const redirectUri = `${origin}/api/auth/x/callback`

    // Owner Access Token from Keys & Tokens — skips broken X consent screen
    const ownerToken = (process.env.X_ACCESS_TOKEN || '').trim()
    const ownerSecret = (process.env.X_ACCESS_TOKEN_SECRET || '').trim()
    if (ownerToken && ownerSecret && isOAuth1Configured()) {
      try {
        const user = await fetchXUser({
          accessToken: ownerToken,
          accessTokenSecret: ownerSecret,
        })
        const account = {
          id: user.id,
          handle: user.username,
          name: user.name,
          avatarUrl:
            user.profile_image_url?.replace('_normal', '_400x400') ||
            `https://api.dicebear.com/9.x/initials/svg?seed=${user.username}`,
          connectedAt: new Date().toISOString(),
          accessToken: ownerToken,
          accessTokenSecret: ownerSecret,
          authMode: 'oauth1-owner',
        }
        const maxAccounts = planOf(session).maxAccounts
        const idx = session.accounts.findIndex((a) => a.id === account.id)
        if (idx >= 0) session.accounts[idx] = account
        else if (session.accounts.length >= maxAccounts) {
          return redirect(res, `${origin}/more?error=${encodeURIComponent('وصلت لحد الحسابات في خطتك')}`)
        } else session.accounts.push(account)
        session.activeAccountId = account.id
        return redirect(res, `${origin}/write?connected=1`, [
          await sessionCookie(session),
          makeCookie(OAUTH_COOKIE, '', 0),
        ])
      } catch (err) {
        console.error('owner token connect failed, falling back to oauth dance', err)
      }
    }

    // Prefer OAuth 1.0a — avoids "You weren’t able to give access" on broken OAuth 2.0 apps
    if (usesOAuth1() || isOAuth1Configured()) {
      try {
        const { oauthToken, oauthTokenSecret } = await getRequestToken(redirectUri)
        return redirect(res, authorizeUrl(oauthToken), [
          await sessionCookie(session),
          makeCookie(
            OAUTH_COOKIE,
            await seal({ mode: 'oauth1', oauthToken, oauthTokenSecret, redirectUri }),
            600,
          ),
        ])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'فشل بدء ربط X'
        return sendJson(res, 502, { error: message })
      }
    }

    // Fallback: OAuth 2.0 PKCE
    const { verifier, challenge } = await createPkcePair()
    const state = randomString(32)
    const authorize = new URL('https://x.com/i/oauth2/authorize')
    authorize.searchParams.set('response_type', 'code')
    authorize.searchParams.set('client_id', getXClientId())
    authorize.searchParams.set('redirect_uri', redirectUri)
    authorize.searchParams.set('scope', 'tweet.read tweet.write users.read offline.access')
    authorize.searchParams.set('state', state)
    authorize.searchParams.set('code_challenge', challenge)
    authorize.searchParams.set('code_challenge_method', 'S256')
    return redirect(res, authorize.toString(), [
      await sessionCookie(session),
      makeCookie(OAUTH_COOKIE, await seal({ mode: 'oauth2', verifier, state, redirectUri }), 600),
    ])
  }

  if (pathname === '/api/auth/x/callback' && req.method === 'GET') {
    const origin = originFrom(req)
    const error = url.searchParams.get('error')
    if (error) return redirect(res, `${origin}/login?error=${encodeURIComponent(error)}`)

    const oauthRaw = parseCookies(req.headers.cookie)[OAUTH_COOKIE]
    const oauth = oauthRaw ? await unseal(oauthRaw) : null
    let session = (await loadSession(req)) || createSession()

    try {
      let account

      // OAuth 1.0a callback: oauth_token + oauth_verifier
      const oauthToken = url.searchParams.get('oauth_token')
      const oauthVerifier = url.searchParams.get('oauth_verifier')
      if (oauthToken && oauthVerifier) {
        if (!oauth?.oauthTokenSecret || oauth.oauthToken !== oauthToken) {
          return redirect(res, `${origin}/login?error=invalid_state`)
        }
        const tokens = await getAccessToken({
          oauthToken,
          oauthTokenSecret: oauth.oauthTokenSecret,
          oauthVerifier,
        })
        const user = await fetchXUser({
          accessToken: tokens.accessToken,
          accessTokenSecret: tokens.accessTokenSecret,
        })
        account = {
          id: user.id || tokens.userId,
          handle: user.username || tokens.screenName,
          name: user.name || tokens.screenName,
          avatarUrl:
            user.profile_image_url?.replace('_normal', '_400x400') ||
            `https://api.dicebear.com/9.x/initials/svg?seed=${user.username || tokens.screenName}`,
          connectedAt: new Date().toISOString(),
          accessToken: tokens.accessToken,
          accessTokenSecret: tokens.accessTokenSecret,
          authMode: 'oauth1',
        }
      } else {
        // OAuth 2.0 PKCE callback
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        if (!code || !state) return sendJson(res, 400, { error: 'طلب غير مكتمل من X' })
        if (!oauth?.verifier || !oauth.redirectUri || oauth.state !== state) {
          return redirect(res, `${origin}/login?error=invalid_state`)
        }
        const tokens = await exchangeCodeForToken({
          code,
          redirectUri: oauth.redirectUri,
          codeVerifier: oauth.verifier,
        })
        const user = await fetchXUser(tokens.access_token)
        account = {
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
          authMode: 'oauth2',
        }
      }

      const maxAccounts = planOf(session).maxAccounts
      const idx = session.accounts.findIndex((a) => a.id === account.id)
      if (idx >= 0) session.accounts[idx] = account
      else if (session.accounts.length >= maxAccounts) {
        return redirect(res, `${origin}/more?error=${encodeURIComponent('وصلت لحد الحسابات في خطتك')}`)
      } else session.accounts.push(account)
      session.activeAccountId = account.id
      return redirect(res, `${origin}/write?connected=1`, [
        await sessionCookie(session),
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
      await revokeAccountToken(account)
    } catch {
      // ignore
    }
    session.accounts = session.accounts.filter((a) => a.id !== body.accountId)
    if (session.activeAccountId === body.accountId) {
      session.activeAccountId = session.accounts[0]?.id || null
    }
    const usage = await getUsage(session.id)
    return sendJson(res, 200, { ok: true, ...publicSession(session, usage) }, [
      await sessionCookie(session),
    ])
  }

  if (pathname === '/api/accounts/active' && req.method === 'POST') {
    const session = await loadSession(req)
    if (!session) return sendJson(res, 401, { error: 'غير مسجّل' })
    const body = await readBody(req)
    if (!session.accounts.some((a) => a.id === body.accountId)) {
      return sendJson(res, 404, { error: 'الحساب غير موجود' })
    }
    session.activeAccountId = body.accountId
    const usage = await getUsage(session.id)
    return sendJson(res, 200, publicSession(session, usage), [await sessionCookie(session)])
  }

  // AI endpoints
  if (pathname === '/api/ai/thread' && req.method === 'POST') {
    const session = await requireAuth(req, res)
    if (!session) return
    try {
      const body = await readBody(req)
      const usage = await consumeAi(session)
      const parts = await writeThreadFromIdea(body.idea || '')
      return sendJson(res, 200, { parts, usage }, [await sessionCookie(session)])
    } catch (err) {
      return sendJson(res, err.status || 500, { error: err.message || 'فشل الذكاء' })
    }
  }

  if (pathname === '/api/ai/improve' && req.method === 'POST') {
    const session = await requireAuth(req, res)
    if (!session) return
    try {
      const body = await readBody(req)
      const usage = await consumeAi(session)
      const text = await improveText(body.text || '')
      return sendJson(res, 200, { text, usage }, [await sessionCookie(session)])
    } catch (err) {
      return sendJson(res, err.status || 500, { error: err.message || 'فشل التحسين' })
    }
  }

  if (pathname === '/api/ai/saudi' && req.method === 'POST') {
    const session = await requireAuth(req, res)
    if (!session) return
    try {
      const body = await readBody(req)
      const usage = await consumeAi(session)
      const text = await toSaudi(body.text || '')
      return sendJson(res, 200, { text, usage }, [await sessionCookie(session)])
    } catch (err) {
      return sendJson(res, err.status || 500, { error: err.message || 'فشل التحويل' })
    }
  }

  if (pathname === '/api/ai/import' && req.method === 'POST') {
    const session = await requireAuth(req, res)
    if (!session) return
    try {
      const body = await readBody(req)
      if (!extractStatusId(body.url || '')) return sendJson(res, 400, { error: 'رابط غير صالح' })
      const usage = await consumeAi(session)
      const account =
        session.accounts.find((a) => a.id === (body.accountId || session.activeAccountId)) ||
        session.accounts[0]
      await ensureFreshAccount(account)
      const thread = await fetchThreadByUrl(account, body.url)
      let texts = thread.map((t) => t.text)
      try {
        texts = await rewriteThreadParts(texts, { saudi: true })
      } catch (rewriteErr) {
        console.error('rewrite failed, keeping original', rewriteErr)
      }
      const parts = texts.map((text, i) => ({
        text,
        media: body.keepMedia === false ? [] : thread[i]?.media || [],
      }))
      return sendJson(res, 200, { parts, usage }, [await sessionCookie(session)])
    } catch (err) {
      return sendJson(res, err.status || 502, { error: err.message || 'فشل الاستيراد' })
    }
  }

  // Media upload
  if (pathname === '/api/media/upload' && req.method === 'POST') {
    const session = await requireAuth(req, res)
    if (!session) return
    try {
      const body = await readBody(req)
      const account =
        session.accounts.find((a) => a.id === (body.accountId || session.activeAccountId)) ||
        session.accounts[0]
      const mimeType = body.mimeType || 'image/jpeg'
      if ((mimeType.startsWith('video/') || mimeType === 'image/gif') && !planOf(session).videoGif) {
        return sendJson(res, 402, { error: 'الفيديو وGIF متاحة في الخطة المدفوعة' })
      }
      await ensureFreshAccount(account)
      const buf = Buffer.from(body.base64 || '', 'base64')
      if (!buf.length) return sendJson(res, 400, { error: 'لا توجد بيانات وسائط' })
      const mediaId = await uploadMedia(account, buf, mimeType)
      return sendJson(res, 200, { mediaId }, [await sessionCookie(session)])
    } catch (err) {
      return sendJson(res, 502, { error: err.message || 'فشل رفع الوسائط' })
    }
  }

  // Posts list / schedule / publish
  if (pathname === '/api/posts' && req.method === 'GET') {
    const session = await requireAuth(req, res)
    if (!session) return
    await flushSessionDue(session)
    const posts = await listPosts(session.id)
    return sendJson(res, 200, { posts, slots: SUGGESTED_SLOTS })
  }

  if (pathname === '/api/posts/schedule' && req.method === 'POST') {
    const session = await requireAuth(req, res)
    if (!session) return
    try {
      const body = await readBody(req)
      const limits = planOf(session)
      const scheduledCount = await countScheduled(session.id)
      if (scheduledCount >= limits.maxScheduled) {
        return sendJson(res, 402, { error: 'وصلت لحد المنشورات المجدولة في خطتك' })
      }
      const when = new Date(body.scheduledAt || nextFreeSlot(await listPosts(session.id)))
      const max = new Date()
      max.setDate(max.getDate() + limits.scheduleDays)
      if (when > max) {
        return sendJson(res, 402, { error: `الجدولة متاحة حتى ${limits.scheduleDays} يوم فقط` })
      }
      const accountId = body.accountId || session.activeAccountId || session.accounts[0].id
      const post = await createPost({
        sessionId: session.id,
        accountId,
        parts: body.parts || [],
        scheduledAt: when.toISOString(),
        status: 'scheduled',
      })
      return sendJson(res, 200, { post }, [await sessionCookie(session)])
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'فشل الجدولة' })
    }
  }

  if (pathname === '/api/posts/publish' && req.method === 'POST') {
    const session = await requireAuth(req, res)
    if (!session) return
    try {
      const body = await readBody(req)
      const accountId = body.accountId || session.activeAccountId || session.accounts[0].id
      const { ids, account } = await publishParts(session, accountId, body.parts || [])
      const post = await createPost({
        sessionId: session.id,
        accountId,
        parts: (body.parts || []).map((p) =>
          typeof p === 'string' ? { text: p, media: [] } : p,
        ),
        scheduledAt: new Date().toISOString(),
        status: 'published',
      })
      await updatePost(post.id, session.id, {
        status: 'published',
        publishedAt: new Date().toISOString(),
        tweetIds: ids,
      })
      return sendJson(
        res,
        200,
        {
          ok: true,
          tweetIds: ids,
          url: ids[0] ? `https://x.com/${account.handle}/status/${ids[0]}` : null,
          postId: post.id,
        },
        [await sessionCookie(session)],
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل النشر'
      const freeFallback = /رصيد واجهة X|credits? depleted|Payment Required/i.test(message)
      return sendJson(res, freeFallback ? 402 : 502, {
        error: message,
        freeFallback,
      })
    }
  }

  // Record a thread published manually via X Web Intent (no API credits)
  if (pathname === '/api/posts/publish-manual' && req.method === 'POST') {
    const session = await requireAuth(req, res)
    if (!session) return
    try {
      const body = await readBody(req)
      const accountId = body.accountId || session.activeAccountId || session.accounts[0]?.id
      const account = session.accounts.find((a) => a.id === accountId) || session.accounts[0]
      const tweetIds = Array.isArray(body.tweetIds) ? body.tweetIds.map(String).filter(Boolean) : []
      if (!tweetIds.length) return sendJson(res, 400, { error: 'لازم رابط تغريدة واحدة واحدةً على الأقل' })
      const post = await createPost({
        sessionId: session.id,
        accountId,
        parts: (body.parts || []).map((p) =>
          typeof p === 'string' ? { text: p, media: [] } : p,
        ),
        scheduledAt: new Date().toISOString(),
        status: 'published',
      })
      await updatePost(post.id, session.id, {
        status: 'published',
        publishedAt: new Date().toISOString(),
        tweetIds,
      })
      return sendJson(
        res,
        200,
        {
          ok: true,
          tweetIds,
          url: tweetIds[0] ? `https://x.com/${account.handle}/status/${tweetIds[0]}` : null,
          postId: post.id,
        },
        [await sessionCookie(session)],
      )
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'فشل حفظ النشر' })
    }
  }

  if (pathname === '/api/posts/reschedule' && req.method === 'POST') {
    const session = await requireAuth(req, res)
    if (!session) return
    const body = await readBody(req)
    const post = await updatePost(body.id, session.id, {
      scheduledAt: new Date(body.scheduledAt).toISOString(),
      status: 'scheduled',
    })
    if (!post) return sendJson(res, 404, { error: 'المنشور غير موجود' })
    return sendJson(res, 200, { post })
  }

  if (pathname === '/api/posts/next-slot' && req.method === 'GET') {
    const session = await requireAuth(req, res)
    if (!session) return
    const posts = await listPosts(session.id)
    const slot = nextFreeSlot(posts)
    return sendJson(res, 200, { slot: slot.toISOString(), slots: SUGGESTED_SLOTS })
  }

  // Bulk import
  if (pathname === '/api/import/bulk' && req.method === 'POST') {
    const session = await requireAuth(req, res)
    if (!session) return
    try {
      const body = await readBody(req)
      const links = (body.links || []).filter((l) => extractStatusId(l))
      if (!links.length) return sendJson(res, 400, { error: 'الصق رابط ثريد واحد على الأقل' })
      const limits = planOf(session)
      const usage = await getUsage(session.id)
      if (Number.isFinite(limits.bulkLimit) && usage.bulkImportsUsed + links.length > limits.bulkLimit) {
        return sendJson(res, 402, {
          error: 'تجاوزت حد الاستيراد الجماعي في خطتك',
          remaining: Math.max(0, limits.bulkLimit - usage.bulkImportsUsed),
        })
      }
      const account =
        session.accounts.find((a) => a.id === (body.accountId || session.activeAccountId)) ||
        session.accounts[0]
      await ensureFreshAccount(account)

      let cursorPosts = await listPosts(session.id)
      const created = []
      for (const link of links) {
        const thread = await fetchThreadByUrl(account, link)
        let texts = thread.map((t) => t.text)
        if (body.rewrite !== false) {
          texts = await rewriteThreadParts(texts, { saudi: true })
        }
        let parts = texts.map((text, i) => ({
          text,
          media: body.keepMedia === false ? [] : thread[i]?.media || [],
        }))

        if (body.promoText?.trim()) {
          let promo = body.promoText.trim()
          if (body.rewritePromo) promo = await toSaudi(promo)
          const promoPart = { text: promo, media: [] }
          if (body.promoPlace === 'start') parts = [promoPart, ...parts]
          else parts = [...parts, promoPart]
        }

        const when = nextFreeSlot(cursorPosts)
        const post = await createPost({
          sessionId: session.id,
          accountId: account.id,
          parts,
          scheduledAt: when.toISOString(),
          status: 'scheduled',
        })
        created.push(post)
        cursorPosts = [post, ...cursorPosts]
      }
      const nextUsage = await bumpUsage(session.id, 'bulk', links.length)
      return sendJson(
        res,
        200,
        {
          posts: created,
          usage: nextUsage,
          remaining: Number.isFinite(limits.bulkLimit)
            ? Math.max(0, limits.bulkLimit - nextUsage.bulkImportsUsed)
            : null,
        },
        [await sessionCookie(session)],
      )
    } catch (err) {
      return sendJson(res, 502, { error: err.message || 'فشل الاستيراد الجماعي' })
    }
  }

  // Analytics
  if (pathname === '/api/analytics' && req.method === 'GET') {
    const session = await requireAuth(req, res)
    if (!session) return
    await collectMetricsForSession(session)
    const range = url.searchParams.get('range') || '30d'
    const sort = url.searchParams.get('sort') || 'views'
    const days = range === '90d' ? 90 : range === '1y' ? 365 : 30
    const from = Date.now() - days * 24 * 60 * 60 * 1000
    let posts = (await listPosts(session.id)).filter(
      (p) => p.status === 'published' && +new Date(p.publishedAt || p.scheduledAt) >= from,
    )
    posts = posts.map((p) => ({
      ...p,
      metrics: p.metrics || { views: 0, likes: 0, replies: 0, reposts: 0, bookmarks: 0 },
    }))
    posts.sort((a, b) =>
      sort === 'newest'
        ? +new Date(b.publishedAt || b.scheduledAt) - +new Date(a.publishedAt || a.scheduledAt)
        : (b.metrics.views || 0) - (a.metrics.views || 0),
    )
    const totals = posts.reduce(
      (acc, p) => {
        acc.views += p.metrics.views || 0
        acc.likes += p.metrics.likes || 0
        acc.replies += p.metrics.replies || 0
        acc.reposts += p.metrics.reposts || 0
        acc.bookmarks += p.metrics.bookmarks || 0
        return acc
      },
      { views: 0, likes: 0, replies: 0, reposts: 0, bookmarks: 0 },
    )
    return sendJson(res, 200, { posts, totals })
  }

  if (pathname === '/api/cron/tick' && req.method === 'POST') {
    // Manual/cron hook — only flushes posts if CRON_SECRET matches
    const secret = process.env.CRON_SECRET
    if (secret && req.headers['x-cron-secret'] !== secret) {
      return sendJson(res, 401, { error: 'unauthorized' })
    }
    return sendJson(res, 200, { ok: true, note: 'due posts flush on user activity' })
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

async function existsSafe(p) {
  try {
    if (!existsSync(p)) return false
    return (await stat(p)).isFile()
  } catch {
    return false
  }
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
    const html = await readFile(path.join(DIST, 'index.html'))
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
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

await initDb()
server.listen(PORT, '0.0.0.0', () => {
  console.log(`تريندا running on 0.0.0.0:${PORT}`)
})

// Wake-time tick: attempt flushing is session-bound; keep process warm note
setInterval(() => {
  // no-op heartbeat for free tier
}, 60_000)
