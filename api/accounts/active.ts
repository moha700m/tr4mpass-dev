import { json, jsonError, withCookies } from '../_lib/http'
import { encodeSession, loadSession, publicSession, sessionCookie } from '../_lib/session'

export const runtime = 'edge'

export default async function handler(req: Request) {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405)
  const session = await loadSession(req)
  if (!session) return jsonError('غير مسجّل', 401)

  const body = (await req.json().catch(() => ({}))) as { accountId?: string }
  if (!body.accountId) return jsonError('accountId مطلوب')
  if (!session.accounts.some((a) => a.id === body.accountId)) {
    return jsonError('الحساب غير موجود', 404)
  }

  session.activeAccountId = body.accountId
  const token = await encodeSession(session)
  return withCookies(json(publicSession(session)), [sessionCookie(token)])
}
