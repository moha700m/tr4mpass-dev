import type { Config, Context } from '@netlify/functions'
import { isXConfigured } from './_shared/env'
import { json } from './_shared/http'
import { createSession, loadSession, publicSession, sessionCookie } from './_shared/session'

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  let session = await loadSession(req)
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' })

  if (!session) {
    session = await createSession()
    headers.set('Set-Cookie', sessionCookie(session.id))
  }

  return new Response(
    JSON.stringify({
      ...publicSession(session),
      xConfigured: isXConfigured(),
    }),
    { status: 200, headers },
  )
}

export const config: Config = {
  path: '/api/auth/me',
  method: 'GET',
}
