export function randomishId(prefix = 'id') {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}_${hex}`
}

export function getSessionSecret() {
  return (process.env.SESSION_SECRET || 'hudu-dev-session-secret-change-me').trim()
}
