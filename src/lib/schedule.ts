import { SUGGESTED_SLOTS } from '../data/mock'
import type { ScheduledPost } from '../types'

export function nextFreeSlot(posts: ScheduledPost[], from = new Date()) {
  const occupied = new Set(
    posts
      .filter((p) => p.status === 'scheduled' || p.status === 'needs_attention')
      .map((p) => new Date(p.scheduledAt).getTime()),
  )

  const cursor = new Date(from)
  cursor.setMinutes(0, 0, 0)
  if (cursor.getTime() <= Date.now()) {
    cursor.setHours(cursor.getHours() + 1)
  }

  for (let day = 0; day < 60; day += 1) {
    const dayDate = new Date(cursor)
    dayDate.setDate(cursor.getDate() + day)
    for (const hour of SUGGESTED_SLOTS) {
      const candidate = new Date(dayDate)
      candidate.setHours(hour, 0, 0, 0)
      if (candidate.getTime() <= Date.now()) continue
      if (!occupied.has(candidate.getTime())) return candidate
    }
  }

  const fallback = new Date(Date.now() + 60 * 60 * 1000)
  fallback.setMinutes(0, 0, 0)
  return fallback
}

export function formatArabicDateTime(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('ar-SA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatCompactNumber(n: number) {
  return new Intl.NumberFormat('ar-SA', {
    notation: n >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(n)
}
