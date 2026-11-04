import type { Config } from '@netlify/functions'
import { isXConfigured } from './_shared/env'
import { json } from './_shared/http'

export default async () =>
  json({
    ok: true,
    app: 'trenda',
    xConfigured: isXConfigured(),
  })

export const config: Config = {
  path: '/api/health',
  method: 'GET',
}
