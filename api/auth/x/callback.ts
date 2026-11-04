import { PLANS } from '../../_lib/types'
import { exchangeCodeForToken, fetchXUser, type ConnectedAccount } from '../../_lib/x-api'
import { jsonError, withCookies } from '../../_lib/http'
import {
  clearOauthCookie,
  createSession,
  decodeOauthState,
  encodeSession,
  loadSession,
  sessionCookie,
} from '../../_lib/session'

export const runtime = 'edge'

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const origin = `${url.protocol}//${url.host}`
  const error = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (error) {
    return Response.redirect(`${origin}/login?error=${encodeURIComponent(error)}`, 302)
  }
  if (!code || !state) return jsonError('طلب غير مكتمل من X', 400)

  const oauth = await decodeOauthState(req)
  if (!oauth?.verifier || !oauth.redirectUri || oauth.state !== state) {
    return Response.redirect(`${origin}/login?error=invalid_state`, 302)
  }

  let session = (await loadSession(req)) || (await createSession())

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
    } else if (session.accounts.length >= maxAccounts) {
      return Response.redirect(
        `${origin}/more?error=${encodeURIComponent('وصلت لحد الحسابات في خطتك')}`,
        302,
      )
    } else {
      session.accounts.push(account)
    }

    session.activeAccountId = account.id
    const token = await encodeSession(session)

    return withCookies(
      new Response(null, {
        status: 302,
        headers: { Location: `${origin}/write?connected=1` },
      }),
      [sessionCookie(token), clearOauthCookie()],
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'فشل الربط مع X'
    return Response.redirect(`${origin}/login?error=${encodeURIComponent(message)}`, 302)
  }
}
