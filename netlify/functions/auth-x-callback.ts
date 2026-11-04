import type { Config, Context } from '@netlify/functions'
import { PLANS } from '../../src/data/plans'
import { exchangeCodeForToken, fetchXUser } from './_shared/x-api'
import { jsonError } from './_shared/http'
import {
  loadSession,
  saveSession,
  sessionCookie,
  takeOauthState,
  type ConnectedAccount,
  type SessionData,
  createSession,
} from './_shared/session'
import { getStore } from '@netlify/blobs'

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url)
  const origin = `${url.protocol}//${url.host}`
  const error = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (error) {
    return Response.redirect(`${origin}/login?error=${encodeURIComponent(error)}`, 302)
  }
  if (!code || !state) {
    return jsonError('طلب غير مكتمل من X', 400)
  }

  const oauth = await takeOauthState(state)
  if (!oauth?.verifier || !oauth.redirectUri) {
    return Response.redirect(`${origin}/login?error=invalid_state`, 302)
  }

  let session: SessionData | null = null
  if (oauth.sessionId) {
    try {
      const data = await getStore({ name: 'trenda-sessions', consistency: 'strong' }).get(
        oauth.sessionId,
        { type: 'json' },
      )
      session = data as SessionData | null
    } catch {
      session = null
    }
  }
  if (!session) {
    session = (await loadSession(req)) || (await createSession())
  }

  try {
    const tokens = await exchangeCodeForToken({
      code,
      redirectUri: oauth.redirectUri,
      codeVerifier: oauth.verifier,
    })
    const user = await fetchXUser(tokens.access_token)

    const account: ConnectedAccount = {
      id: user.id,
      handle: user.username,
      name: user.name,
      avatarUrl:
        user.profile_image_url?.replace('_normal', '_400x400') ||
        `https://api.dicebear.com/9.x/initials/svg?seed=${user.username}`,
      connectedAt: new Date().toISOString(),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
    }

    const maxAccounts = PLANS[session.plan].maxAccounts
    const existingIdx = session.accounts.findIndex((a) => a.id === account.id)
    if (existingIdx >= 0) {
      session.accounts[existingIdx] = account
    } else {
      if (session.accounts.length >= maxAccounts) {
        return Response.redirect(
          `${origin}/more?error=${encodeURIComponent('وصلت لحد الحسابات في خطتك')}`,
          302,
        )
      }
      session.accounts.push(account)
    }
    session.activeAccountId = account.id
    await saveSession(session)

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${origin}/write?connected=1`,
        'Set-Cookie': sessionCookie(session.id),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'فشل الربط مع X'
    return Response.redirect(`${origin}/login?error=${encodeURIComponent(message)}`, 302)
  }
}

export const config: Config = {
  path: '/api/auth/x/callback',
  method: 'GET',
}
