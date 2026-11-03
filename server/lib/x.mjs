function getXClientId() {
  return (process.env.X_CLIENT_ID || '').trim()
}
function getXClientSecret() {
  return (process.env.X_CLIENT_SECRET || '').trim()
}

export function isXConfigured() {
  return Boolean(getXClientId())
}

export function basicAuthHeader() {
  const secret = getXClientSecret()
  if (!secret) return null
  return `Basic ${Buffer.from(`${getXClientId()}:${secret}`).toString('base64')}`
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
  if (account.refreshToken && account.expiresAt && account.expiresAt < Date.now() + 60_000) {
    const tokens = await refreshAccessToken(account.refreshToken)
    account.accessToken = tokens.access_token
    account.refreshToken = tokens.refresh_token || account.refreshToken
    account.expiresAt = Date.now() + tokens.expires_in * 1000
    account.scope = tokens.scope
  }
  return account
}

export async function createTweet(accessToken, text, { replyToId, mediaIds } = {}) {
  const payload = { text: text || '' }
  if (replyToId) payload.reply = { in_reply_to_tweet_id: replyToId }
  if (mediaIds?.length) payload.media = { media_ids: mediaIds }

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
  return data.data
}

export async function createThread(accessToken, parts) {
  const ids = []
  let previousId
  for (const part of parts) {
    const text = typeof part === 'string' ? part : part.text
    const mediaIds = typeof part === 'string' ? undefined : part.mediaIds
    if (!String(text || '').trim() && !mediaIds?.length) continue
    const tweet = await createTweet(accessToken, text || '', {
      replyToId: previousId,
      mediaIds,
    })
    ids.push(tweet.id)
    previousId = tweet.id
  }
  return ids
}

/** Simple media upload via X v1.1 INIT/APPEND/FINALIZE with OAuth2 bearer (when supported). */
export async function uploadMedia(accessToken, buffer, mimeType) {
  const mediaCategory = mimeType.startsWith('video/')
    ? 'tweet_video'
    : mimeType === 'image/gif'
      ? 'tweet_gif'
      : 'tweet_image'

  // Prefer v2 simple upload for images
  if (mediaCategory === 'tweet_image') {
    const form = new FormData()
    form.append('media', new Blob([buffer], { type: mimeType }), 'upload')
    form.append('media_category', mediaCategory)
    const res = await fetch('https://api.x.com/2/media/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && (data.data?.id || data.media_id_string || data.id)) {
      return String(data.data?.id || data.media_id_string || data.id)
    }
  }

  // Fallback: chunked v1.1
  const totalBytes = buffer.byteLength || buffer.length
  const initBody = new URLSearchParams({
    command: 'INIT',
    total_bytes: String(totalBytes),
    media_type: mimeType,
    media_category: mediaCategory,
  })
  const initRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
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
    const appendRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    })
    if (!appendRes.ok) {
      const err = await appendRes.json().catch(() => ({}))
      throw new Error(err.errors?.[0]?.message || 'فشل رفع جزء الوسائط')
    }
  }

  const finBody = new URLSearchParams({ command: 'FINALIZE', media_id: mediaId })
  const finRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: finBody,
  })
  const finData = await finRes.json()
  if (!finRes.ok) throw new Error(finData.errors?.[0]?.message || 'فشل إنهاء رفع الوسائط')

  // Wait for processing if needed
  if (finData.processing_info) {
    let info = finData.processing_info
    while (info.state === 'pending' || info.state === 'in_progress') {
      await new Promise((r) => setTimeout(r, (info.check_after_secs || 2) * 1000))
      const st = await fetch(
        `https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=${mediaId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
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

export async function fetchThreadByUrl(accessToken, url) {
  const id = extractStatusId(url)
  if (!id) throw new Error('رابط غير صالح')

  const rootRes = await fetch(
    `https://api.x.com/2/tweets/${id}?tweet.fields=author_id,conversation_id,created_at,attachments,entities,text&expansions=attachments.media_keys&media.fields=url,preview_image_url,type,variants`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const rootData = await rootRes.json()
  if (!rootRes.ok) throw new Error(rootData.detail || rootData.title || 'فشل جلب التغريدة')

  const conversationId = rootData.data.conversation_id || id
  const authorId = rootData.data.author_id

  // Search conversation replies by author (best-effort thread reconstruction)
  const search = await fetch(
    `https://api.x.com/2/tweets/search/recent?query=conversation_id:${conversationId} from:${authorId}&max_results=100&tweet.fields=author_id,conversation_id,created_at,in_reply_to_user_id,referenced_tweets,attachments,text&expansions=attachments.media_keys&media.fields=url,preview_image_url,type,variants`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const searchData = await search.json()
  const tweets = [rootData.data]
  if (search.ok && Array.isArray(searchData.data)) {
    for (const t of searchData.data) {
      if (t.id !== rootData.data.id) tweets.push(t)
    }
  }

  // Sort by created_at
  tweets.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))

  const mediaByKey = new Map()
  for (const m of [...(rootData.includes?.media || []), ...(searchData.includes?.media || [])]) {
    mediaByKey.set(m.media_key, m)
  }

  return tweets.map((t) => {
    const media = (t.attachments?.media_keys || [])
      .map((k) => mediaByKey.get(k))
      .filter(Boolean)
      .map((m) => ({
        type: m.type === 'video' ? 'video' : m.type === 'animated_gif' ? 'gif' : 'image',
        url: m.url || m.preview_image_url || m.variants?.find((v) => v.content_type === 'video/mp4')?.url,
      }))
      .filter((m) => m.url)
    return { id: t.id, text: t.text || '', media }
  })
}

export async function fetchTweetMetrics(accessToken, tweetIds) {
  if (!tweetIds.length) return []
  const ids = tweetIds.slice(0, 100).join(',')
  const res = await fetch(
    `https://api.x.com/2/tweets?ids=${ids}&tweet.fields=public_metrics,non_public_metrics,organic_metrics`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
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
