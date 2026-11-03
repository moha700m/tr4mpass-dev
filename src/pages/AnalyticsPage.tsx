import { useMemo, useState } from 'react'
import { Bookmark, Eye, Heart, MessageCircle, Repeat2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatArabicDateTime, formatCompactNumber } from '../lib/schedule'
import type { AnalyticsRange, AnalyticsSort } from '../types'
import './AnalyticsPage.css'

export function AnalyticsPage() {
  const { analytics } = useApp()
  const [range, setRange] = useState<AnalyticsRange>('30d')
  const [sort, setSort] = useState<AnalyticsSort>('views')

  const filtered = useMemo(() => {
    const days = range === '30d' ? 30 : range === '90d' ? 90 : 365
    const from = Date.now() - days * 24 * 60 * 60 * 1000
    const list = analytics.filter((p) => +new Date(p.publishedAt || p.scheduledAt) >= from)
    return list.sort((a, b) =>
      sort === 'views'
        ? b.metrics.views - a.metrics.views
        : +new Date(b.publishedAt || b.scheduledAt) - +new Date(a.publishedAt || a.scheduledAt),
    )
  }, [analytics, range, sort])

  const totals = filtered.reduce(
    (acc, p) => {
      acc.views += p.metrics.views
      acc.likes += p.metrics.likes
      acc.replies += p.metrics.replies
      acc.reposts += p.metrics.reposts
      acc.bookmarks += p.metrics.bookmarks
      return acc
    },
    { views: 0, likes: 0, replies: 0, reposts: 0, bookmarks: 0 },
  )

  return (
    <div className="analytics-page rise">
      <h1 className="page-title">التحليلات</h1>
      <p className="page-sub">أرقام بسيطة تُجمع بعد ٣ أيام من النشر.</p>

      <div className="filters row">
        {(['30d', '90d', '1y'] as AnalyticsRange[]).map((r) => (
          <button
            key={r}
            type="button"
            className={`chip ${range === r ? 'chip-accent' : ''}`}
            onClick={() => setRange(r)}
          >
            {r === '30d' ? '٣٠ يوم' : r === '90d' ? '٩٠ يوم' : 'سنة'}
          </button>
        ))}
        <span className="spacer" />
        <select className="field sort-field" value={sort} onChange={(e) => setSort(e.target.value as AnalyticsSort)}>
          <option value="views">الأعلى مشاهدة</option>
          <option value="newest">الأحدث</option>
        </select>
      </div>

      <div className="metrics-strip">
        <Metric icon={Eye} label="مشاهدات" value={totals.views} />
        <Metric icon={Heart} label="إعجابات" value={totals.likes} />
        <Metric icon={MessageCircle} label="ردود" value={totals.replies} />
        <Metric icon={Repeat2} label="إعادة نشر" value={totals.reposts} />
        <Metric icon={Bookmark} label="حفظ" value={totals.bookmarks} />
      </div>

      <div className="stack">
        {filtered.map((post) => (
          <article key={post.id} className="surface analytics-item">
            <p className="analytics-text">{post.parts[0]?.text}</p>
            <div className="analytics-meta muted">
              <span>{formatArabicDateTime(post.publishedAt || post.scheduledAt)}</span>
              {post.metrics.collectedAt && (
                <span>جُمعت {formatArabicDateTime(post.metrics.collectedAt)}</span>
              )}
            </div>
            <div className="mini-metrics">
              <span>
                <Eye size={14} /> {formatCompactNumber(post.metrics.views)}
              </span>
              <span>
                <Heart size={14} /> {formatCompactNumber(post.metrics.likes)}
              </span>
              <span>
                <MessageCircle size={14} /> {formatCompactNumber(post.metrics.replies)}
              </span>
              <span>
                <Repeat2 size={14} /> {formatCompactNumber(post.metrics.reposts)}
              </span>
              <span>
                <Bookmark size={14} /> {formatCompactNumber(post.metrics.bookmarks)}
              </span>
            </div>
          </article>
        ))}
        {!filtered.length && <p className="muted">لا توجد منشورات في هذه الفترة بعد.</p>}
      </div>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye
  label: string
  value: number
}) {
  return (
    <div className="metric surface">
      <Icon size={16} />
      <strong>{formatCompactNumber(value)}</strong>
      <span>{label}</span>
    </div>
  )
}
