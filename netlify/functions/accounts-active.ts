import type { Config, Context } from '@netlify/functions'
import { json, jsonError } from './_shared/http'
import { loadSession, publicSession, saveSession } from './_shared/session'

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405)
  const session = await loadSession(req)
  if (!session) return jsonError('غير مسجّل', 401)

  const body = (await req.json().catch(() => ({}))) as { accountId?: string }
  if (!body.accountId) return jsonError('accountId مطلوب')
  if (!session.accounts.some((a) => a.id === body.accountId)) {
    return jsonError('الحساب غير موجود', 404)
  }

  session.activeAccountId = body.accountId
  await saveSession(session)
  return json(publicSession(session))
}

export const config: Config = {
  path: '/api/accounts/active',
  method: 'POST',
}
