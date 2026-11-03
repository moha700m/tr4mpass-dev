export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return json({ error: message, ...extra }, { status })
}

export function withCookies(res: Response, cookies: string[]) {
  const headers = new Headers(res.headers)
  for (const c of cookies) headers.append('Set-Cookie', c)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}
