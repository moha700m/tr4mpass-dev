import { isXConfigured } from '../_lib/env'
import { json, withCookies } from '../_lib/http'
import {
  createSession,
  encodeSession,
  loadSession,
  publicSession,
  sessionCookie,
} from '../_lib/session'

export const runtime = 'edge'

export default async function handler(req: Request) {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, { status: 405 })

  let session = await loadSession(req)
  if (!session) {
    session = await createSession()
    const token = await encodeSession(session)
    return withCookies(
      json({ ...publicSession(session), xConfigured: isXConfigured() }),
      [sessionCookie(token)],
    )
  }

  return json({ ...publicSession(session), xConfigured: isXConfigured() })
}
