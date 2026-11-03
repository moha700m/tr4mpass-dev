import type { Config, Context } from '@netlify/functions'
import { getRedirectUri, getXClientId, isXConfigured, X_SCOPES } from './_shared/env'
import { createPkcePair, randomString } from './_shared/pkce'
import { jsonError } from './_shared/http'
import { requireSession, saveOauthState, sessionCookie } from './_shared/session'

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') return jsonError('Method not allowed', 405)
  if (!isXConfigured()) {
    return jsonError(
      'ربط X غير مفعّل بعد. أضف X_CLIENT_ID في إعدادات البيئة.',
      503,
      { setup: true },
    )
  }

  const session = await requireSession(req)
  const { verifier, challenge } = await createPkcePair()
  const state = randomString(32)
  const redirectUri = getRedirectUri(req)

  await saveOauthState(state, {
    verifier,
    sessionId: session.id,
    redirectUri,
  })

  const authorize = new URL('https://x.com/i/oauth2/authorize')
  authorize.searchParams.set('response_type', 'code')
  authorize.searchParams.set('client_id', getXClientId())
  authorize.searchParams.set('redirect_uri', redirectUri)
  authorize.searchParams.set('scope', X_SCOPES)
  authorize.searchParams.set('state', state)
  authorize.searchParams.set('code_challenge', challenge)
  authorize.searchParams.set('code_challenge_method', 'S256')

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': sessionCookie(session.id),
    },
  })
}

export const config: Config = {
  path: '/api/auth/x/start',
  method: 'GET',
}
