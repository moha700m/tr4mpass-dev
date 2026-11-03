import type { Config, Context } from '@netlify/functions'
import { json, jsonError } from './_shared/http'
import { loadSession } from './_shared/session'
import { createThread, ensureFreshAccount } from './_shared/x-api'

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405)

  const session = await loadSession(req)
  if (!session || session.accounts.length === 0) {
    return jsonError('اربط حساب X أولاً', 401)
  }

  const body = (await req.json().catch(() => ({}))) as {
    accountId?: string
    parts?: string[]
  }

  const accountId = body.accountId || session.activeAccountId
  if (!accountId) return jsonError('اختر حساباً')
  if (!body.parts?.length) return jsonError('لا يوجد نص للنشر')

  try {
    const account = await ensureFreshAccount(session, accountId)
    const ids = await createThread(account.accessToken, body.parts)
    return json({
      ok: true,
      tweetIds: ids,
      url: ids[0] ? `https://x.com/${account.handle}/status/${ids[0]}` : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'فشل النشر'
    return jsonError(message, 502)
  }
}

export const config: Config = {
  path: '/api/posts/publish',
  method: 'POST',
}
