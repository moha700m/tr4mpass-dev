import { json, jsonError, withCookies } from '../_lib/http'
import { encodeSession, loadSession, sessionCookie } from '../_lib/session'
import { revokeToken } from '../_lib/x-api'

export const runtime = 'edge'

export default async function handler(req: Request) {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405)
  const session = await loadSession(req)
  if (!session) return jsonError('غير مسجّل', 401)

  const body = (await req.json().catch(() => ({}))) as { accountId?: string }
  if (!body.accountId) return jsonError('accountId مطلوب')

  const account = session.accounts.find((a) => a.id === body.accountId)
  if (!account) return jsonError('الحساب غير موجود', 404)

  try {
    await revokeToken(account.accessToken)
  } catch {
    // continue
  }

  session.accounts = session.accounts.filter((a) => a.id !== body.accountId)
  if (session.activeAccountId === body.accountId) {
    session.activeAccountId = session.accounts[0]?.id || null
  }

  const token = await encodeSession(session)
  return withCookies(
    json({
      ok: true,
      accounts: session.accounts.map((a) => ({
        id: a.id,
        handle: a.handle,
        name: a.name,
        avatarUrl: a.avatarUrl,
        connectedAt: a.connectedAt,
      })),
    }),
    [sessionCookie(token)],
  )
}
