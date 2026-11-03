function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const b of arr) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function randomString(length = 64) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export async function createPkcePair() {
  const verifier = randomString(64)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = toBase64Url(digest)
  return { verifier, challenge }
}
