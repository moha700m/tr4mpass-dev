import { useMemo, useState } from 'react'
import type { MediaAttachment, TweetPart } from '../types'

const MAX_CHARS = 25_000

function uid() {
  return `t_${Math.random().toString(36).slice(2, 10)}`
}

export function createEmptyPart(): TweetPart {
  return { id: uid(), text: '', media: [] }
}

export function useThreadComposer(initial?: TweetPart[]) {
  const [parts, setParts] = useState<TweetPart[]>(initial?.length ? initial : [createEmptyPart()])

  const totalChars = useMemo(
    () => parts.reduce((sum, p) => sum + [...p.text].length, 0),
    [parts],
  )

  const remaining = MAX_CHARS - totalChars

  return {
    parts,
    setParts,
    totalChars,
    remaining,
    maxChars: MAX_CHARS,
    updateText: (id: string, text: string) => {
      setParts((prev) => prev.map((p) => (p.id === id ? { ...p, text } : p)))
    },
    addPart: () => setParts((prev) => [...prev, createEmptyPart()]),
    removePart: (id: string) =>
      setParts((prev) => (prev.length === 1 ? prev : prev.filter((p) => p.id !== id))),
    addMedia: (id: string, media: MediaAttachment) => {
      setParts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, media: [...p.media, media].slice(0, 4) } : p)),
      )
    },
    removeMedia: (partId: string, mediaId: string) => {
      setParts((prev) =>
        prev.map((p) =>
          p.id === partId ? { ...p, media: p.media.filter((m) => m.id !== mediaId) } : p,
        ),
      )
    },
    replaceAll: (next: TweetPart[]) => setParts(next.length ? next : [createEmptyPart()]),
    reset: () => setParts([createEmptyPart()]),
  }
}
