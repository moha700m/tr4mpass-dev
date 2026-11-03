import { getPool, memory, persistFileStore, uid } from './db.mjs'

export const SUGGESTED_SLOTS = [9, 12, 16, 20]

export function nextFreeSlot(posts, from = new Date()) {
  const occupied = new Set(
    posts
      .filter((p) => p.status === 'scheduled' || p.status === 'needs_attention')
      .map((p) => new Date(p.scheduledAt).getTime()),
  )
  const cursor = new Date(from)
  cursor.setMinutes(0, 0, 0)
  if (cursor.getTime() <= Date.now()) cursor.setHours(cursor.getHours() + 1)

  for (let day = 0; day < 60; day += 1) {
    const dayDate = new Date(cursor)
    dayDate.setDate(cursor.getDate() + day)
    for (const hour of SUGGESTED_SLOTS) {
      const candidate = new Date(dayDate)
      candidate.setHours(hour, 0, 0, 0)
      if (candidate.getTime() <= Date.now()) continue
      if (!occupied.has(candidate.getTime())) return candidate
    }
  }
  const fallback = new Date(Date.now() + 60 * 60 * 1000)
  fallback.setMinutes(0, 0, 0)
  return fallback
}

function rowToPost(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    accountId: row.account_id,
    parts: row.parts,
    scheduledAt: new Date(row.scheduled_at).toISOString(),
    status: row.status,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    tweetIds: row.tweet_ids || [],
    metrics: row.metrics || null,
    metricsCollectedAt: row.metrics_collected_at
      ? new Date(row.metrics_collected_at).toISOString()
      : undefined,
  }
}

export async function listPosts(sessionId) {
  const p = getPool()
  if (!p) {
    return memory.posts
      .filter((x) => x.sessionId === sessionId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  }
  const { rows } = await p.query(
    `SELECT * FROM posts WHERE session_id = $1 ORDER BY created_at DESC`,
    [sessionId],
  )
  return rows.map(rowToPost)
}

export async function createPost({ sessionId, accountId, parts, scheduledAt, status = 'scheduled' }) {
  const post = {
    id: uid('post'),
    sessionId,
    accountId,
    parts,
    scheduledAt: new Date(scheduledAt).toISOString(),
    status,
    createdAt: new Date().toISOString(),
    tweetIds: [],
    metrics: null,
  }
  const p = getPool()
  if (!p) {
    memory.posts.unshift(post)
    await persistFileStore()
    return post
  }
  await p.query(
    `INSERT INTO posts (id, session_id, account_id, parts, scheduled_at, status, created_at, tweet_ids)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'[]'::jsonb)`,
    [post.id, sessionId, accountId, JSON.stringify(parts), post.scheduledAt, status, post.createdAt],
  )
  return post
}

export async function updatePost(id, sessionId, patch) {
  const p = getPool()
  if (!p) {
    const idx = memory.posts.findIndex((x) => x.id === id && x.sessionId === sessionId)
    if (idx < 0) return null
    memory.posts[idx] = { ...memory.posts[idx], ...patch }
    await persistFileStore()
    return memory.posts[idx]
  }
  const fields = []
  const vals = []
  let i = 1
  const map = {
    scheduledAt: 'scheduled_at',
    status: 'status',
    publishedAt: 'published_at',
    tweetIds: 'tweet_ids',
    metrics: 'metrics',
    metricsCollectedAt: 'metrics_collected_at',
    parts: 'parts',
  }
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      fields.push(`${col} = $${i++}`)
      vals.push(
        k === 'tweetIds' || k === 'metrics' || k === 'parts' ? JSON.stringify(patch[k]) : patch[k],
      )
    }
  }
  if (!fields.length) return null
  vals.push(id, sessionId)
  const { rows } = await p.query(
    `UPDATE posts SET ${fields.join(', ')} WHERE id = $${i++} AND session_id = $${i} RETURNING *`,
    vals,
  )
  return rows[0] ? rowToPost(rows[0]) : null
}

export async function duePosts(now = new Date()) {
  const p = getPool()
  if (!p) {
    return memory.posts.filter(
      (x) => x.status === 'scheduled' && new Date(x.scheduledAt).getTime() <= now.getTime(),
    )
  }
  const { rows } = await p.query(
    `SELECT * FROM posts WHERE status = 'scheduled' AND scheduled_at <= $1 ORDER BY scheduled_at ASC LIMIT 20`,
    [now.toISOString()],
  )
  return rows.map(rowToPost)
}

export async function postsNeedingMetrics(now = new Date()) {
  const cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const p = getPool()
  if (!p) {
    return memory.posts.filter(
      (x) =>
        x.status === 'published' &&
        x.publishedAt &&
        new Date(x.publishedAt) <= cutoff &&
        !x.metricsCollectedAt &&
        x.tweetIds?.length,
    )
  }
  const { rows } = await p.query(
    `SELECT * FROM posts
     WHERE status = 'published'
       AND published_at <= $1
       AND metrics_collected_at IS NULL
       AND jsonb_array_length(COALESCE(tweet_ids, '[]'::jsonb)) > 0
     LIMIT 20`,
    [cutoff.toISOString()],
  )
  return rows.map(rowToPost)
}

export async function getUsage(sessionId) {
  const p = getPool()
  if (!p) {
    return memory.usage.get(sessionId) || { aiAttemptsUsed: 0, bulkImportsUsed: 0 }
  }
  const { rows } = await p.query(`SELECT * FROM usage WHERE session_id = $1`, [sessionId])
  if (!rows[0]) return { aiAttemptsUsed: 0, bulkImportsUsed: 0 }
  return {
    aiAttemptsUsed: rows[0].ai_attempts_used,
    bulkImportsUsed: rows[0].bulk_imports_used,
  }
}

export async function bumpUsage(sessionId, field, by = 1) {
  const current = await getUsage(sessionId)
  const next = {
    aiAttemptsUsed: current.aiAttemptsUsed + (field === 'ai' ? by : 0),
    bulkImportsUsed: current.bulkImportsUsed + (field === 'bulk' ? by : 0),
  }
  const p = getPool()
  if (!p) {
    memory.usage.set(sessionId, next)
    await persistFileStore()
    return next
  }
  await p.query(
    `INSERT INTO usage (session_id, ai_attempts_used, bulk_imports_used, updated_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (session_id) DO UPDATE SET
       ai_attempts_used = EXCLUDED.ai_attempts_used,
       bulk_imports_used = EXCLUDED.bulk_imports_used,
       updated_at = NOW()`,
    [sessionId, next.aiAttemptsUsed, next.bulkImportsUsed],
  )
  return next
}

export async function countScheduled(sessionId) {
  const posts = await listPosts(sessionId)
  return posts.filter((p) => p.status === 'scheduled').length
}
