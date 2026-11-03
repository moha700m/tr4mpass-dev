import { createHmac, randomBytes } from 'node:crypto'

function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!*()']/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function getConsumerKey() {
  return (process.env.X_API_KEY || process.env.X_CONSUMER_KEY || '').trim()
}

function getConsumerSecret() {
  return (process.env.X_API_SECRET || process.env.X_CONSUMER_SECRET || '').trim()
}

export function isOAuth1Configured() {
  return Boolean(getConsumerKey() && getConsumerSecret())
}

function buildSignatureBase(method, url, params) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(String(params[k]))}`)
    .join('&')
  return `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(sorted)}`
}

function sign(base, tokenSecret = '') {
  const key = `${percentEncode(getConsumerSecret())}&${percentEncode(tokenSecret || '')}`
  return createHmac('sha1', key).update(base).digest('base64')
}

/**
 * Build OAuth 1.0a Authorization header.
 * Include URL query + form body params in the signature (not JSON/multipart bodies).
 */
export function oauthHeader(method, url, { token, tokenSecret, extra = {}, verifier, bodyParams = {} } = {}) {
  const oauth = {
    oauth_consumer_key: getConsumerKey(),
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
    ...extra,
  }
  if (token) oauth.oauth_token = token
  if (verifier) oauth.oauth_verifier = verifier

  const urlObj = new URL(url)
  const baseUrl = `${urlObj.origin}${urlObj.pathname}`
  const queryParams = {}
  urlObj.searchParams.forEach((v, k) => {
    queryParams[k] = v
  })

  const all = { ...queryParams, ...bodyParams, ...oauth }
  oauth.oauth_signature = sign(buildSignatureBase(method, baseUrl, all), tokenSecret)

  const header =
    'OAuth ' +
    Object.keys(oauth)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(oauth[k])}"`)
      .join(', ')

  return header
}

export async function getRequestToken(callbackUrl) {
  const url = 'https://api.x.com/oauth/request_token'
  const header = oauthHeader('POST', url, {
    extra: { oauth_callback: callbackUrl },
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: header },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`request_token failed: ${text}`)
  const params = Object.fromEntries(new URLSearchParams(text))
  if (params.oauth_callback_confirmed !== 'true') {
    throw new Error('oauth_callback_confirmed was not true — تأكد من Callback في بوابة X')
  }
  return {
    oauthToken: params.oauth_token,
    oauthTokenSecret: params.oauth_token_secret,
  }
}

export function authorizeUrl(oauthToken) {
  return `https://api.x.com/oauth/authorize?oauth_token=${encodeURIComponent(oauthToken)}`
}

export async function getAccessToken({ oauthToken, oauthTokenSecret, oauthVerifier }) {
  const url = 'https://api.x.com/oauth/access_token'
  const header = oauthHeader('POST', url, {
    token: oauthToken,
    tokenSecret: oauthTokenSecret,
    verifier: oauthVerifier,
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: header },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`access_token failed: ${text}`)
  const params = Object.fromEntries(new URLSearchParams(text))
  return {
    accessToken: params.oauth_token,
    accessTokenSecret: params.oauth_token_secret,
    userId: params.user_id,
    screenName: params.screen_name,
  }
}

export async function invalidateToken(token, tokenSecret) {
  const url = 'https://api.x.com/1.1/oauth/invalidate_token'
  const header = oauthHeader('POST', url, { token, tokenSecret })
  await fetch(url, { method: 'POST', headers: { Authorization: header } })
}

/**
 * Signed OAuth 1.0a fetch.
 * - URLSearchParams body: params are signed
 * - JSON / FormData / string: body is NOT signed (X API v2 + multipart convention)
 */
export async function oauth1Fetch(method, url, { token, tokenSecret, body, headers = {} } = {}) {
  let bodyParams = {}
  let initBody = body
  const initHeaders = { ...headers }

  if (body instanceof URLSearchParams) {
    bodyParams = Object.fromEntries(body)
    initHeaders['Content-Type'] = initHeaders['Content-Type'] || 'application/x-www-form-urlencoded'
    initBody = body.toString()
  } else if (body !== undefined && body !== null && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
    initHeaders['Content-Type'] = initHeaders['Content-Type'] || 'application/json'
    initBody = JSON.stringify(body)
  }

  const auth = oauthHeader(method, url, { token, tokenSecret, bodyParams })
  return fetch(url, {
    method,
    headers: {
      Authorization: auth,
      ...initHeaders,
    },
    body: initBody,
  })
}

export { getConsumerKey, getConsumerSecret }
