export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return json({ error: message, ...extra }, { status })
}
