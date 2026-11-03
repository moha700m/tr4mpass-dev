import { useMemo, useState } from 'react'
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
} from 'date-fns'
import { arSA } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { formatArabicDateTime } from '../lib/schedule'
import type { PostStatus, ScheduledPost } from '../types'
import './CalendarPage.css'

const statusLabel: Record<PostStatus, string> = {
  draft: 'مسودة',
  scheduled: 'سيُنشر',
  published: 'نُشر',
  needs_attention: 'يحتاج انتباه',
  failed: 'فشل',
}

export function CalendarPage() {
  const { posts, refreshPosts, session, connectX } = useApp()
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: anchor,
        end: endOfWeek(anchor, { weekStartsOn: 0 }),
      }),
    [anchor],
  )

  const byDay = (day: Date) =>
    posts
      .filter((p) => isSameDay(new Date(p.scheduledAt), day))
      .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))

  const onDrop = async (day: Date) => {
    if (!draggingId) return
    const post = posts.find((p) => p.id === draggingId)
    setDraggingId(null)
    if (!post) return
    const next = new Date(post.scheduledAt)
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate())
    try {
      await api.reschedule(post.id, next.toISOString())
      await refreshPosts()
      setNote(`تم نقل المنشور إلى ${formatArabicDateTime(next)}`)
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'فشل نقل الموعد')
    }
  }

  if (!session?.isAuthenticated) {
    return (
      <div className="calendar-page rise">
        <h1 className="page-title">التقويم</h1>
        <p className="page-sub">اسحب المنشور لتغيير يومه.</p>
        <button type="button" className="btn btn-primary" onClick={connectX}>
          اربط X
        </button>
      </div>
    )
  }

  return (
    <div className="calendar-page rise">
      <h1 className="page-title">التقويم</h1>
      <p className="page-sub">اسحب المنشور لتغيير يومه.</p>
      {note && <p className="muted">{note}</p>}

      <div className="week-nav row">
        <button type="button" className="btn btn-ghost" onClick={() => setAnchor((d) => addDays(d, -7))}>
          <ChevronRight size={16} />
          السابق
        </button>
        <strong>
          {format(days[0], 'd MMM', { locale: arSA })} –{' '}
          {format(days[6], 'd MMM yyyy', { locale: arSA })}
        </strong>
        <button type="button" className="btn btn-ghost" onClick={() => setAnchor((d) => addDays(d, 7))}>
          التالي
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="week-grid">
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`day-col surface${isSameDay(day, new Date()) ? ' today' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => void onDrop(day)}
          >
            <div className="day-head">
              <span>{format(day, 'EEEE', { locale: arSA })}</span>
              <strong>{format(day, 'd')}</strong>
            </div>
            <div className="day-posts">
              {byDay(day).map((post) => (
                <PostChip
                  key={post.id}
                  post={post}
                  onDragStart={() => setDraggingId(post.id)}
                  onDragEnd={() => setDraggingId(null)}
                />
              ))}
              {!byDay(day).length && <p className="empty faint">فارغ</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PostChip({
  post,
  onDragStart,
  onDragEnd,
}: {
  post: ScheduledPost
  onDragStart: () => void
  onDragEnd: () => void
}) {
  return (
    <article
      className={`post-chip status-${post.status}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <span className="chip-status">{statusLabel[post.status]}</span>
      <p>{post.parts[0]?.text.slice(0, 80) || 'بدون نص'}</p>
      <small>{formatArabicDateTime(post.scheduledAt)}</small>
    </article>
  )
}
