import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarClock,
  ImagePlus,
  Plus,
  Send,
  Trash2,
  Sparkles,
} from 'lucide-react'
import { AiPanel } from '../components/write/AiPanel'
import { TweetPreview } from '../components/write/TweetPreview'
import { useApp } from '../context/AppContext'
import { useThreadComposer } from '../hooks/useThreadComposer'
import { formatArabicDateTime, nextFreeSlot } from '../lib/schedule'
import './WritePage.css'

export function WritePage() {
  const { session, posts, setPosts, connectX, publishNow, plan, setActiveAccount } = useApp()
  const composer = useThreadComposer()
  const [showAi, setShowAi] = useState(false)
  const [scheduledAt, setScheduledAt] = useState(() => nextFreeSlot(posts))
  const [status, setStatus] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [params] = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaTarget = useRef<string | null>(null)

  const account = session?.accounts.find((a) => a.id === session.activeAccountId)
  const connectedFlash = params.get('connected') === '1'

  const scheduleMax = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + plan.scheduleDays)
    return d
  }, [plan.scheduleDays])

  const suggestNearest = () => {
    const next = nextFreeSlot(posts)
    setScheduledAt(next)
    setStatus(`أقرب موعد فارغ: ${formatArabicDateTime(next)}`)
  }

  const onPickMedia = (partId: string) => {
    mediaTarget.current = partId
    fileRef.current?.click()
  }

  const onFiles = (files: FileList | null) => {
    const partId = mediaTarget.current
    if (!partId || !files?.length) return
    Array.from(files).forEach((file) => {
      const type = file.type.startsWith('video/')
        ? 'video'
        : file.type === 'image/gif'
          ? 'gif'
          : 'image'
      if ((type === 'video' || type === 'gif') && !plan.videoGif) {
        setStatus('الفيديو وGIF متاحة في الخطة المدفوعة.')
        return
      }
      const url = URL.createObjectURL(file)
      composer.addMedia(partId, {
        id: `m_${Math.random().toString(36).slice(2, 8)}`,
        type,
        url,
        name: file.name,
      })
    })
  }

  const schedulePost = () => {
    if (!account) {
      connectX()
      return
    }
    if (!composer.parts.some((p) => p.text.trim())) {
      setStatus('اكتب شيئاً أولاً.')
      return
    }
    if (scheduledAt > scheduleMax) {
      setStatus(`خطتك تسمح بالجدولة حتى ${plan.scheduleDays} يوم فقط.`)
      return
    }

    setPosts((prev) => [
      {
        id: `post_${Date.now()}`,
        accountId: account.id,
        parts: composer.parts.filter((p) => p.text.trim() || p.media.length),
        scheduledAt: scheduledAt.toISOString(),
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ])
    setStatus(`تم الجدولة · ${formatArabicDateTime(scheduledAt)}`)
    composer.reset()
  }

  const publish = async () => {
    if (!account) {
      connectX()
      return
    }
    if (!composer.parts.some((p) => p.text.trim())) {
      setStatus('اكتب شيئاً أولاً.')
      return
    }
    setPublishing(true)
    setStatus('')
    try {
      const result = await publishNow(
        composer.parts.filter((p) => p.text.trim()),
        account.id,
      )
      setStatus(result.url ? `نُشر على X · ${result.url}` : 'تم النشر على X')
      composer.reset()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'فشل النشر')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="write-page rise">
      <div className="write-heading">
        <div>
          <h1 className="page-title">اكتب</h1>
          <p className="page-sub">صندوق هادئ لثريد كامل — بدون تشتيت.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setShowAi((v) => !v)}>
          <Sparkles size={16} />
          ذكاء
        </button>
      </div>

      {connectedFlash && (
        <p className="banner ok">تم ربط حساب X بنجاح. تقدر تكتب وتنشر الحين.</p>
      )}

      {!session?.isAuthenticated && (
        <p className="banner warn">
          اربط حساب X الرسمي عشان تنشر مباشرة.
          <button type="button" className="linkish" onClick={connectX}>
            ربط الآن
          </button>
        </p>
      )}

      {showAi && (
        <AiPanel
          currentText={composer.parts.map((p) => p.text).join('\n\n')}
          onApply={(parts) => composer.replaceAll(parts)}
        />
      )}

      <div className="write-layout">
        <section className="composer surface">
          <div className="composer-toolbar">
            <label className="account-select">
              الحساب
              <select
                className="field"
                value={account?.id || ''}
                onChange={(e) => {
                  if (e.target.value) void setActiveAccount(e.target.value)
                }}
                disabled={!session?.accounts.length}
              >
                {session?.accounts.length ? (
                  session.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      @{a.handle}
                    </option>
                  ))
                ) : (
                  <option value="">لا يوجد حساب مربوط</option>
                )}
              </select>
            </label>
            <span className={`chip ${composer.remaining < 500 ? 'chip-accent' : ''}`}>
              {composer.totalChars.toLocaleString('ar-SA')} /{' '}
              {composer.maxChars.toLocaleString('ar-SA')}
            </span>
          </div>

          {composer.parts.map((part, index) => (
            <div key={part.id} className="part-block">
              <div className="part-head">
                <span>تغريدة {index + 1}</span>
                {composer.parts.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="حذف التغريدة"
                    onClick={() => composer.removePart(part.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <textarea
                className="field textarea part-input"
                value={part.text}
                onChange={(e) => composer.updateText(part.id, e.target.value)}
                placeholder={index === 0 ? 'ابدأ بجملة قوية…' : 'كمّل الثريد…'}
                rows={5}
              />
              {part.media.length > 0 && (
                <div className="media-row">
                  {part.media.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="media-thumb"
                      onClick={() => composer.removeMedia(part.id, m.id)}
                      title="إزالة"
                    >
                      {m.type === 'image' ? (
                        <img src={m.url} alt={m.name} />
                      ) : (
                        <span>{m.type.toUpperCase()}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" className="btn btn-ghost media-btn" onClick={() => onPickMedia(part.id)}>
                <ImagePlus size={16} />
                صورة / فيديو / GIF
              </button>
            </div>
          ))}

          <button type="button" className="btn btn-ghost add-part" onClick={composer.addPart}>
            <Plus size={16} />
            أضف تغريدة للثريد
          </button>

          <div className="schedule-box">
            <label>
              موعد النشر
              <input
                type="datetime-local"
                className="field"
                value={toLocalInput(scheduledAt)}
                min={toLocalInput(new Date())}
                max={toLocalInput(scheduleMax)}
                onChange={(e) => setScheduledAt(new Date(e.target.value))}
              />
            </label>
            <button type="button" className="btn btn-soft" onClick={suggestNearest}>
              <CalendarClock size={16} />
              أقرب موعد فارغ
            </button>
          </div>

          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={schedulePost}>
              جدولة
            </button>
            <button type="button" className="btn btn-primary" disabled={publishing} onClick={publish}>
              <Send size={16} />
              {publishing ? 'جارٍ النشر…' : 'انشر الآن'}
            </button>
          </div>

          {status && <p className="status-line muted">{status}</p>}
        </section>

        <aside className="preview-pane surface">
          <div className="preview-label">معاينة X</div>
          <TweetPreview parts={composer.parts} account={account} />
        </aside>
      </div>

      <input
        ref={fileRef}
        type="file"
        className="sr-only"
        accept="image/*,video/*,.gif"
        multiple
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  )
}

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
