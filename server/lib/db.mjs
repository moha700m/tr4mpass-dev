import pg from 'pg'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data')
const STORE_FILE = path.join(DATA_DIR, 'store.json')

let pool = null

export function getPool() {
  if (!process.env.DATABASE_URL) return null
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    })
  }
  return pool
}

export async function initDb() {
  const p = getPool()
  if (!p) {
    await ensureFileStore()
    console.warn('DATABASE_URL missing — using file store at', STORE_FILE)
    return false
  }
  await p.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      parts JSONB NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      tweet_ids JSONB DEFAULT '[]'::jsonb,
      metrics JSONB,
      metrics_collected_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS posts_session_idx ON posts(session_id);
    CREATE INDEX IF NOT EXISTS posts_status_sched_idx ON posts(status, scheduled_at);
    CREATE INDEX IF NOT EXISTS posts_account_idx ON posts(account_id);

    CREATE TABLE IF NOT EXISTS usage (
      session_id TEXT PRIMARY KEY,
      ai_attempts_used INT NOT NULL DEFAULT 0,
      bulk_imports_used INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  console.log('Database ready')
  return true
}

export function uid(prefix = 'id') {
  return `${prefix}_${randomBytes(8).toString('hex')}`
}

/** File-backed fallback store */
export const memory = {
  posts: [],
  usage: new Map(),
}

async function ensureFileStore() {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    const raw = await readFile(STORE_FILE, 'utf8')
    const data = JSON.parse(raw)
    memory.posts = Array.isArray(data.posts) ? data.posts : []
    memory.usage = new Map(Object.entries(data.usage || {}))
  } catch {
    memory.posts = []
    memory.usage = new Map()
    await persistFileStore()
  }
}

export async function persistFileStore() {
  if (getPool()) return
  await mkdir(DATA_DIR, { recursive: true })
  const usage = Object.fromEntries(memory.usage.entries())
  await writeFile(STORE_FILE, JSON.stringify({ posts: memory.posts, usage }, null, 2))
}
