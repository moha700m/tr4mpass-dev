import { json, withCookies } from '../_lib/http'
import { clearSessionCookie, loadSession } from '../_lib/session'
import { revokeToken } from '../_lib/x-api'

export const runtime = 'edge'

export default async function handler(req: Request) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 })

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

  return withCookies(json({ ok: true }), [clearSessionCookie()])
}
