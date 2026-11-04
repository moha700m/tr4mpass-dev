import { isXConfigured } from './_lib/env'
import { json } from './_lib/http'

export const runtime = 'edge'

export default async function handler() {
  return json({ ok: true, app: 'trenda', xConfigured: isXConfigured() })
}
