import type { Config, Context } from '@netlify/functions'
import { json, jsonError } from './_shared/http'
import { loadSession, saveSession } from './_shared/session'
import { revokeToken } from './_shared/x-api'

export default async (req: Request, _context: Context) => {
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
  await saveSession(session)

  return json({ ok: true, accounts: session.accounts.map((a) => ({
    id: a.id,
    handle: a.handle,
    name: a.name,
    avatarUrl: a.avatarUrl,
    connectedAt: a.connectedAt,
  })) })
}

export const config: Config = {
  path: '/api/accounts/disconnect',
  method: 'POST',
}
