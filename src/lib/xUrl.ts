export function extractStatusId(url: string) {
  const m = String(url).match(/status(?:es)?\/(\d+)/i)
  return m?.[1] || null
}
