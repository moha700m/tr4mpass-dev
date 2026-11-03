import { isOAuth1Configured, oauth1Fetch, invalidateToken } from './oauth1.mjs'

function getXClientId() {
  return (process.env.X_CLIENT_ID || '').trim()
}
function getXClientSecret() {
  return (process.env.X_CLIENT_SECRET || '').trim()
}

/** Prefer OAuth 1.0a (API Key/Secret) — avoids broken OAuth 2.0 consent on many X apps. */
export function isXConfigured() {
  return isOAuth1Configured() || Boolean(getXClientId())
}

export function usesOAuth1() {
  return isOAuth1Configured()
}

export function basicAuthHeader() {
  const secret = getXClientSecret()
  if (!secret) return null
  return `Basic ${Buffer.from(`${getXClientId()}:${secret}`).toString('base64')}`
}

function credsOf(accountOrToken) {
  if (!accountOrToken) return null
  if (typeof accountOrToken === 'string') {
    return { accessToken: accountOrToken, accessTokenSecret: null }
  }
  return {
    accessToken: accountOrToken.accessToken,
    accessTokenSecret: accountOrToken.accessTokenSecret || null,
  }
}

async function xFetch(method, url, accountOrToken, { body, headers = {} } = {}) {
  const creds = credsOf(accountOrToken)
  if (!creds?.accessToken) throw new Error('لا يوجد توكن X')

  if (creds.accessTokenSecret) {
    return oauth1Fetch(method, url, {
      token: creds.accessToken,
      tokenSecret: creds.accessTokenSecret,
      body,
      headers,
    })
  }

  const init = {
    method,
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      ...headers,
    },
  }
  if (body !== undefined) {
    if (typeof body === 'string' || body instanceof URLSearchParams || body instanceof FormData) {
      init.body = body
      if (body instanceof URLSearchParams && !init.headers['Content-Type']) {
        init.headers['Content-Type'] = 'application/x-www-form-urlencoded'
      }
    } else {
      init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json'
      init.body = JSON.stringify(body)
    }
  }
  return fetch(url, init)
}

export async function refreshAccessToken(refreshToken) {
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

export async function ensureFreshAccount(account) {
  // OAuth 1.0a user tokens do not expire
  if (account.accessTokenSecret) return account
  if (account.refreshToken && account.expiresAt && account.expiresAt < Date.now() + 60_000) {
    const tokens = await refreshAccessToken(account.refreshToken)
    account.accessToken = tokens.access_token
    account.refreshToken = tokens.refresh_token || account.refreshToken
    account.expiresAt = Date.now() + tokens.expires_in * 1000
    account.scope = tokens.scope
  }
  return account
}

export async function revokeAccountToken(account) {
  if (account.accessTokenSecret) {
    await invalidateToken(account.accessToken, account.accessTokenSecret)
    return
  }
  const body = new URLSearchParams({ token: account.accessToken })
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
  const basic = basicAuthHeader()
  if (basic) headers.Authorization = basic
  else body.set('client_id', getXClientId())
  await fetch('https://api.x.com/2/oauth2/revoke', { method: 'POST', headers, body })
}

export async function fetchXUser(accountOrToken) {
  const res = await xFetch(
    'GET',
    'https://api.x.com/2/users/me?user.fields=profile_image_url,name,username',
    accountOrToken,
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.title || 'فشل جلب حساب X')
  return data.data
}

export async function createTweet(accountOrToken, text, { replyToId, mediaIds } = {}) {
  const payload = { text: text || '' }
  if (replyToId) payload.reply = { in_reply_to_tweet_id: replyToId }
  if (mediaIds?.length) payload.media = { media_ids: mediaIds }

  const res = await xFetch('POST', 'https://api.x.com/2/tweets', accountOrToken, { body: payload })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = String(data.detail || data.title || '')
    if (res.status === 402 || /credits? depleted/i.test(detail)) {
      throw new Error(
        'رصيد واجهة X خلص. من Developer Portal ارفع خطة الـ API أو انتظر تجديد الرصيد عشان تقدر تنشر.',
      )
    }
    throw new Error(detail || 'فشل نشر المنشور')
  }
  return data.data
}

export async function createThread(accountOrToken, parts) {
  const ids = []
  let previousId
  for (const part of parts) {
    const text = typeof part === 'string' ? part : part.text
    const mediaIds = typeof part === 'string' ? undefined : part.mediaIds
    if (!String(text || '').trim() && !mediaIds?.length) continue
    const tweet = await createTweet(accountOrToken, text || '', {
      replyToId: previousId,
      mediaIds,
    })
    ids.push(tweet.id)
    previousId = tweet.id
  }
  return ids
}

/** Media upload via X v1.1 INIT/APPEND/FINALIZE (OAuth 1.0a preferred). */
export async function uploadMedia(accountOrToken, buffer, mimeType) {
  const mediaCategory = mimeType.startsWith('video/')
    ? 'tweet_video'
    : mimeType === 'image/gif'
      ? 'tweet_gif'
      : 'tweet_image'

  // Prefer v2 simple upload for images when using bearer (oauth2)
  const creds = credsOf(accountOrToken)
  if (!creds.accessTokenSecret && mediaCategory === 'tweet_image') {
    const form = new FormData()
    form.append('media', new Blob([buffer], { type: mimeType }), 'upload')
    form.append('media_category', mediaCategory)
    const res = await xFetch('POST', 'https://api.x.com/2/media/upload', accountOrToken, { body: form })
    const data = await res.json().catch(() => ({}))
    if (res.ok && (data.data?.id || data.media_id_string || data.id)) {
      return String(data.data?.id || data.media_id_string || data.id)
    }
  }

  const totalBytes = buffer.byteLength || buffer.length
  const initBody = new URLSearchParams({
    command: 'INIT',
    total_bytes: String(totalBytes),
    media_type: mimeType,
    media_category: mediaCategory,
  })
  const initRes = await xFetch('POST', 'https://upload.twitter.com/1.1/media/upload.json', accountOrToken, {
    body: initBody,
  })
  const initData = await initRes.json()
  if (!initRes.ok) throw new Error(initData.errors?.[0]?.message || 'فشل رفع الوسائط')
  const mediaId = String(initData.media_id_string)

  const chunkSize = 1024 * 1024
  let segment = 0
  for (let offset = 0; offset < totalBytes; offset += chunkSize) {
    const slice = buffer.subarray(offset, Math.min(offset + chunkSize, totalBytes))
    const form = new FormData()
    form.append('command', 'APPEND')
    form.append('media_id', mediaId)
    form.append('segment_index', String(segment++))
    form.append('media', new Blob([slice]), 'chunk')
    const appendRes = await xFetch('POST', 'https://upload.twitter.com/1.1/media/upload.json', accountOrToken, {
      body: form,
    })
    if (!appendRes.ok) {
      const err = await appendRes.json().catch(() => ({}))
      throw new Error(err.errors?.[0]?.message || 'فشل رفع جزء الوسائط')
    }
  }

  const finBody = new URLSearchParams({ command: 'FINALIZE', media_id: mediaId })
  const finRes = await xFetch('POST', 'https://upload.twitter.com/1.1/media/upload.json', accountOrToken, {
    body: finBody,
  })
  const finData = await finRes.json()
  if (!finRes.ok) throw new Error(finData.errors?.[0]?.message || 'فشل إنهاء رفع الوسائط')

  if (finData.processing_info) {
    let info = finData.processing_info
    while (info.state === 'pending' || info.state === 'in_progress') {
      await new Promise((r) => setTimeout(r, (info.check_after_secs || 2) * 1000))
      const st = await xFetch(
        'GET',
        `https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=${mediaId}`,
        accountOrToken,
      )
      const stData = await st.json()
      info = stData.processing_info || { state: 'succeeded' }
      if (info.state === 'failed') throw new Error('فشل معالجة الوسائط')
    }
  }
  return mediaId
}

export function extractStatusId(url) {
  const m = String(url).match(/status(?:es)?\/(\d+)/i)
  return m?.[1] || null
}

function mapXApiMedia(m) {
  return {
    type: m.type === 'video' ? 'video' : m.type === 'animated_gif' ? 'gif' : 'image',
    url: m.url || m.preview_image_url || m.variants?.find((v) => v.content_type === 'video/mp4')?.url,
  }
}

function splitLongText(text) {
  const clean = String(text || '')
    .replace(/\u200b/g, '')
    .trim()
  if (!clean) return []
  if ([...clean].length <= 280) return [clean]

  const blocks = clean
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
  if (blocks.length > 1) return blocks

  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length <= 1) return [clean]

  const parts = []
  let buf = ''
  for (const line of lines) {
    const next = buf ? `${buf}\n${line}` : line
    if ([...next].length > 280 && buf) {
      parts.push(buf)
      buf = line
    } else {
      buf = next
    }
  }
  if (buf) parts.push(buf)
  return parts.length ? parts : [clean]
}

async function fetchThreadViaFx(id) {
  const res = await fetch(`https://api.fxtwitter.com/status/${id}`, {
    headers: { Accept: 'application/json' },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.tweet) {
    throw new Error(data?.message || 'فشل جلب التغريدة من المصدر البديل')
  }

  const tweet = data.tweet
  const mediaItems = [...(tweet.media?.all || []), ...(tweet.media?.photos || []), ...(tweet.media?.videos || [])]
  const media = []
  const seen = new Set()
  for (const m of mediaItems) {
    const url = m.url || m.thumbnail_url
    if (!url || seen.has(url)) continue
    seen.add(url)
    media.push({
      type: m.type === 'video' || m.format?.startsWith?.('video') ? 'video' : m.type === 'gif' ? 'gif' : 'image',
      url,
    })
  }

  // Prefer explicit thread array when present
  if (Array.isArray(tweet.thread) && tweet.thread.length) {
    return tweet.thread.map((t, i) => ({
      id: String(t.id || `${id}_${i}`),
      text: t.text || t.raw_text?.text || '',
      media: i === 0 ? media : [],
    }))
  }

  const texts = splitLongText(tweet.text || tweet.raw_text?.text || '')
  return texts.map((text, i) => ({
    id: i === 0 ? String(tweet.id || id) : `${id}_${i}`,
    text,
    media: i === 0 ? media : [],
  }))
}

function friendlyXError(data, status) {
  const detail = String(data?.detail || data?.title || '')
  if (status === 402 || /credits? depleted/i.test(detail)) {
    return 'رصيد واجهة X خلص. الاستيراد يستخدم مصدراً بديلاً مؤقتاً؛ للنشر قد تحتاج ترقية خطة API في بوابة المطوّرين.'
  }
  return detail || 'فشل جلب التغريدة'
}

export async function fetchThreadByUrl(accountOrToken, url) {
  const id = extractStatusId(url)
  if (!id) throw new Error('رابط غير صالح')

  try {
    const rootRes = await xFetch(
      'GET',
      `https://api.x.com/2/tweets/${id}?tweet.fields=author_id,conversation_id,created_at,attachments,entities,text&expansions=attachments.media_keys&media.fields=url,preview_image_url,type,variants`,
      accountOrToken,
    )
    const rootData = await rootRes.json().catch(() => ({}))
    if (!rootRes.ok) throw new Error(friendlyXError(rootData, rootRes.status))

    const conversationId = rootData.data.conversation_id || id
    const authorId = rootData.data.author_id

    const search = await xFetch(
      'GET',
      `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(`conversation_id:${conversationId} from:${authorId}`)}&max_results=100&tweet.fields=author_id,conversation_id,created_at,in_reply_to_user_id,referenced_tweets,attachments,text&expansions=attachments.media_keys&media.fields=url,preview_image_url,type,variants`,
      accountOrToken,
    )
    const searchData = await search.json().catch(() => ({}))
    const tweets = [rootData.data]
    if (search.ok && Array.isArray(searchData.data)) {
      for (const t of searchData.data) {
        if (t.id !== rootData.data.id) tweets.push(t)
      }
    }

    tweets.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))

    const mediaByKey = new Map()
    for (const m of [...(rootData.includes?.media || []), ...(searchData.includes?.media || [])]) {
      mediaByKey.set(m.media_key, m)
    }

    return tweets.map((t) => {
      const media = (t.attachments?.media_keys || [])
        .map((k) => mediaByKey.get(k))
        .filter(Boolean)
        .map(mapXApiMedia)
        .filter((m) => m.url)
      return { id: t.id, text: t.text || '', media }
    })
  } catch (err) {
    console.error('X API thread fetch failed, trying fallback', err)
    return fetchThreadViaFx(id)
  }
}

export async function fetchTweetMetrics(accountOrToken, tweetIds) {
  if (!tweetIds.length) return []
  const ids = tweetIds.slice(0, 100).join(',')
  const res = await xFetch(
    'GET',
    `https://api.x.com/2/tweets?ids=${ids}&tweet.fields=public_metrics,non_public_metrics,organic_metrics`,
    accountOrToken,
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.title || 'فشل جلب الإحصائيات')
  return (data.data || []).map((t) => {
    const pm = t.public_metrics || {}
    const npm = t.non_public_metrics || {}
    const om = t.organic_metrics || {}
    return {
      id: t.id,
      views: om.impression_count ?? npm.impression_count ?? pm.impression_count ?? 0,
      likes: pm.like_count || 0,
      replies: pm.reply_count || 0,
      reposts: pm.retweet_count || 0,
      bookmarks: pm.bookmark_count || 0,
    }
  })
}

export { getXClientId, getXClientSecret }
