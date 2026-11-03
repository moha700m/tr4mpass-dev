import type { Config, Context } from '@netlify/functions'
import { json } from './_shared/http'
import { clearSessionCookie, loadSession, saveSession } from './_shared/session'
import { revokeToken } from './_shared/x-api'
import { getStore } from '@netlify/blobs'

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  const session = await loadSession(req)
  if (session) {
    for (const account of session.accounts) {
      try {
        await revokeToken(account.accessToken)
      } catch {
        // ignore revoke failures
      }
    }
    try {
      await getStore({ name: 'hudu-sessions', consistency: 'strong' }).delete(session.id)
    } catch {
      session.accounts = []
      session.activeAccountId = null
      await saveSession(session)
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': clearSessionCookie(),
    },
  })
}

export const config: Config = {
  path: '/api/auth/logout',
  method: 'POST',
}
