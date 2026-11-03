import { useEffect, useState } from 'react'
import { Bookmark, Eye, Heart, MessageCircle, Repeat2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatArabicDateTime, formatCompactNumber } from '../lib/schedule'
import type { AnalyticsRange, AnalyticsSort } from '../types'
import './AnalyticsPage.css'

export function AnalyticsPage() {
  const { analytics, analyticsTotals, refreshAnalytics, session, connectX } = useApp()
  const [range, setRange] = useState<AnalyticsRange>('30d')
  const [sort, setSort] = useState<AnalyticsSort>('views')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!session?.isAuthenticated) return
    setLoading(true)
    void refreshAnalytics(range, sort).finally(() => setLoading(false))
  }, [range, sort, session?.isAuthenticated, refreshAnalytics])

  if (!session?.isAuthenticated) {
    return (
      <div className="analytics-page rise">
        <h1 className="page-title">التحليلات</h1>
        <p className="page-sub">تُجمع أرقام كل منشور بعد ٣ أيام من نشره.</p>
        <button type="button" className="btn btn-primary" onClick={connectX}>
          اربط X لعرض التحليلات
        </button>
      </div>
    )
  }

  return (
    <div className="analytics-page rise">
      <h1 className="page-title">التحليلات</h1>
      <p className="page-sub">تُجمع أرقام كل منشور بعد ٣ أيام من نشره.</p>

      <div className="filters row">
        {(['30d', '90d', '1y'] as AnalyticsRange[]).map((r) => (
          <button
            key={r}
            type="button"
            className={`chip ${range === r ? 'chip-accent' : ''}`}
            onClick={() => setRange(r)}
          >
            {r === '30d' ? '٣٠ يوماً' : r === '90d' ? '٩٠ يوماً' : 'سنة'}
          </button>
        ))}
        <span className="spacer" />
        <div className="row">
          <button
            type="button"
            className={`chip ${sort === 'views' ? 'chip-accent' : ''}`}
            onClick={() => setSort('views')}
          >
            الأعلى مشاهدة
          </button>
          <button
            type="button"
            className={`chip ${sort === 'newest' ? 'chip-accent' : ''}`}
            onClick={() => setSort('newest')}
          >
            الأحدث
          </button>
        </div>
      </div>

      <div className="metrics-strip">
        <Metric icon={Eye} label="مشاهدات" value={analyticsTotals.views} />
        <Metric icon={Heart} label="إعجابات" value={analyticsTotals.likes} />
        <Metric icon={Repeat2} label="إعادة نشر" value={analyticsTotals.reposts} />
        <Metric icon={MessageCircle} label="ردود" value={analyticsTotals.replies} />
        <Metric icon={Bookmark} label="حفظ" value={analyticsTotals.bookmarks} />
      </div>

      <h2 className="posts-heading">المنشورات ({analytics.length})</h2>

      <div className="stack">
        {loading && <p className="muted">جارٍ التحديث…</p>}
        {!loading &&
          analytics.map((post) => (
            <article key={post.id} className="surface analytics-item">
              <p className="analytics-text">{post.parts[0]?.text}</p>
              <div className="analytics-meta muted">
                <span>{formatArabicDateTime(post.publishedAt || post.scheduledAt)}</span>
                {post.metricsCollectedAt ? (
                  <span>جُمعت {formatArabicDateTime(post.metricsCollectedAt)}</span>
                ) : (
                  <span>بانتظار الجمع بعد ٣ أيام</span>
                )}
              </div>
              <div className="mini-metrics">
                <span>
                  <Eye size={14} /> {formatCompactNumber(post.metrics?.views || 0)}
                </span>
                <span>
                  <Heart size={14} /> {formatCompactNumber(post.metrics?.likes || 0)}
                </span>
                <span>
                  <MessageCircle size={14} /> {formatCompactNumber(post.metrics?.replies || 0)}
                </span>
                <span>
                  <Repeat2 size={14} /> {formatCompactNumber(post.metrics?.reposts || 0)}
                </span>
                <span>
                  <Bookmark size={14} /> {formatCompactNumber(post.metrics?.bookmarks || 0)}
                </span>
              </div>
            </article>
          ))}
        {!loading && !analytics.length && (
          <p className="muted">لا منشورات في هذه الفترة</p>
        )}
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
