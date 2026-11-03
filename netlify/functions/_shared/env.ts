export function getXClientId() {
  return (process.env.X_CLIENT_ID || '').trim()
}

export function getXClientSecret() {
  return (process.env.X_CLIENT_SECRET || '').trim()
}

export function getSessionSecret() {
  return (process.env.SESSION_SECRET || 'hudu-dev-session-secret-change-me').trim()
}

export function isXConfigured() {
  return Boolean(getXClientId())
}

export function getRedirectUri(req: Request) {
  const url = new URL(req.url)
  const origin = `${url.protocol}//${url.host}`
  return `${origin}/api/auth/x/callback`
}

export const X_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'offline.access',
].join(' ')
