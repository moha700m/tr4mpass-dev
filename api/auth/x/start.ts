import { getRedirectUri, getXClientId, isXConfigured, X_SCOPES } from '../../_lib/env'
import { createPkcePair, randomString } from '../../_lib/crypto'
import { jsonError, withCookies } from '../../_lib/http'
import {
  encodeOauthState,
  encodeSession,
  oauthCookie,
  requireSession,
  sessionCookie,
} from '../../_lib/session'

export const runtime = 'edge'

export default async function handler(req: Request) {
  if (req.method !== 'GET') return jsonError('Method not allowed', 405)
  if (!isXConfigured()) {
    return jsonError('ربط X غير مفعّل بعد. أضف X_CLIENT_ID في إعدادات Vercel.', 503, {
      setup: true,
    })
  }

  const session = await requireSession(req)
  const { verifier, challenge } = await createPkcePair()
  const state = randomString(32)
  const redirectUri = getRedirectUri(req)

  const oauthToken = await encodeOauthState({ verifier, state, redirectUri })
  const sessionToken = await encodeSession(session)

  const authorize = new URL('https://x.com/i/oauth2/authorize')
  authorize.searchParams.set('response_type', 'code')
  authorize.searchParams.set('client_id', getXClientId())
  authorize.searchParams.set('redirect_uri', redirectUri)
  authorize.searchParams.set('scope', X_SCOPES)
  authorize.searchParams.set('state', state)
  authorize.searchParams.set('code_challenge', challenge)
  authorize.searchParams.set('code_challenge_method', 'S256')

  return withCookies(new Response(null, { status: 302, headers: { Location: authorize.toString() } }), [
    sessionCookie(sessionToken),
    oauthCookie(oauthToken),
  ])
}
