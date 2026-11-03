import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  ImagePlus,
  Languages,
  Link2,
  PenLine,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import { FreePublishWizard } from '../components/write/FreePublishWizard'
import { TweetPreview } from '../components/write/TweetPreview'
import { useApp } from '../context/AppContext'
import { SUGGESTED_SLOTS } from '../data/mock'
import { createEmptyPart, useThreadComposer } from '../hooks/useThreadComposer'
import { ApiError, api } from '../lib/api'
import { formatArabicDateTime, nextFreeSlot } from '../lib/schedule'
import type { TweetPart } from '../types'
import './WritePage.css'

type Intent = 'idea' | 'improve' | 'saudi' | 'import' | 'blank'
type Step = 'ask' | 'input' | 'edit' | 'ship'

const INTENTS: {
  id: Intent
  title: string
  hint: string
  icon: typeof Wand2
}[] = [
  { id: 'idea', title: 'عندي فكرة', hint: 'حوّلها لثريد جاهز', icon: Wand2 },
  { id: 'import', title: 'عندي رابط X', hint: 'استورد وأعد الصياغة سعودي', icon: Link2 },
  { id: 'improve', title: 'حسّن نصي', hint: 'اخعله أقوى وأوضح', icon: Sparkles },
  { id: 'saudi', title: 'لهجة سعودية', hint: 'صيّغ النص بلهجتنا', icon: Languages },
  { id: 'blank', title: 'أكتب بنفسي', hint: 'صندوق فاضي بدون ذكاء', icon: PenLine },
]

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.split(',')[1] || '')
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function WritePage() {
  const {
    session,
    posts,
    connectX,
    publishNow,
    schedulePost,
    plan,
    setActiveAccount,
    refreshSession,
  } = useApp()
  const composer = useThreadComposer()
  const [step, setStep] = useState<Step>('ask')
  const [intent, setIntent] = useState<Intent | null>(null)
  const [seed, setSeed] = useState('')
  const [busy, setBusy] = useState(false)
  const [scheduledAt, setScheduledAt] = useState(() => nextFreeSlot(posts))
  const [status, setStatus] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [freeParts, setFreeParts] = useState<TweetPart[] | null>(null)
  const [params] = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaTarget = useRef<string | null>(null)

  const account = session?.accounts.find((a) => a.id === session.activeAccountId)
  const connectedFlash = params.get('connected') === '1'

  useEffect(() => {
    if (posts.length) setScheduledAt(nextFreeSlot(posts))
  }, [posts])

  const scheduleMax = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + plan.scheduleDays)
    return d
  }, [plan.scheduleDays])

  const dayOptions = useMemo(() => buildDayOptions(new Date(), scheduleMax), [scheduleMax])
  const timeOptions = useMemo(() => buildTimeOptions(), [])
  const dayValue = toDayKey(scheduledAt)
  const timeValue = toTimeKey(scheduledAt)

  const pickIntent = (id: Intent) => {
    setIntent(id)
    setSeed('')
    setStatus('')
    if (id === 'blank') {
      composer.reset()
      setStep('edit')
      return
    }
    setStep('input')
  }

  const backToAsk = () => {
    setStep('ask')
    setIntent(null)
    setSeed('')
    setStatus('')
  }

  const runIntent = async () => {
    if (!intent || intent === 'blank') return
    if (!session?.isAuthenticated) {
      connectX()
      return
    }
    const value = seed.trim()
    if (!value) {
      setStatus(intent === 'import' ? 'الصق رابط التغريدة.' : 'اكتب شيء أولاً.')
      return
    }

    setBusy(true)
    setStatus('')
    try {
      if (intent === 'idea') {
        const res = await api.aiThread(value)
        composer.replaceAll(res.parts.map((text) => ({ ...createEmptyPart(), text })))
      } else if (intent === 'import') {
        const res = await api.aiImport(value, true, account?.id)
        composer.replaceAll(
          res.parts.map((p) => ({
            ...createEmptyPart(),
            text: p.text,
            media: p.media || [],
          })),
        )
      } else if (intent === 'improve') {
        const res = await api.aiImprove(value)
        composer.replaceAll([{ ...createEmptyPart(), text: res.text }])
      } else if (intent === 'saudi') {
        const res = await api.aiSaudi(value)
        composer.replaceAll([{ ...createEmptyPart(), text: res.text }])
      }
      await refreshSession()
      setStep('edit')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'فشل الطلب')
    } finally {
      setBusy(false)
    }
  }

  const setDay = (key: string) => {
    const [y, m, d] = key.split('-').map(Number)
    const next = new Date(scheduledAt)
    next.setFullYear(y, m - 1, d)
    setScheduledAt(next)
  }

  const setTime = (key: string) => {
    const [hh, mm] = key.split(':').map(Number)
    const next = new Date(scheduledAt)
    next.setHours(hh, mm, 0, 0)
    setScheduledAt(next)
  }

  const suggestNearest = async () => {
    try {
      const { slot } = await api.nextSlot()
      setScheduledAt(new Date(slot))
    } catch {
      setScheduledAt(nextFreeSlot(posts))
    }
  }

  const onPickMedia = (partId: string) => {
    mediaTarget.current = partId
    fileRef.current?.click()
  }

  const onFiles = async (files: FileList | null) => {
    const partId = mediaTarget.current
    if (!partId || !files?.length) return
    for (const file of Array.from(files)) {
      const type = file.type.startsWith('video/')
        ? 'video'
        : file.type === 'image/gif'
          ? 'gif'
          : 'image'
      if ((type === 'video' || type === 'gif') && !plan.videoGif) {
        setStatus('الفيديو وGIF متاحة في الخطة المدفوعة.')
        continue
      }
      const url = URL.createObjectURL(file)
      const base64 = await fileToBase64(file)
      let mediaId: string | undefined
      try {
        if (account) {
          const uploaded = await api.uploadMedia(base64, file.type, account.id)
          mediaId = uploaded.mediaId
        }
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'تعذر رفع الوسائط — ستُحفظ محلياً')
      }
      composer.addMedia(partId, {
        id: `m_${Math.random().toString(36).slice(2, 8)}`,
        type,
        url,
        name: file.name,
        mimeType: file.type,
        base64,
        mediaId,
      })
    }
  }

  const prepareParts = () =>
    composer.parts
      .filter((p) => p.text.trim() || p.media.length)
      .map((p) => ({ ...p, media: p.media }))

  const onSchedule = async () => {
    if (!account) {
      connectX()
      return
    }
    const parts = prepareParts()
    if (!parts.length) {
      setStatus('اكتب شيئاً أولاً.')
      return
    }
    if (scheduledAt > scheduleMax) {
      setStatus(`خطتك تسمح بالجدولة حتى ${plan.scheduleDays} يوم فقط.`)
      return
    }
    setPublishing(true)
    try {
      await schedulePost(parts, scheduledAt.toISOString(), account.id)
      setStatus(`تم الجدولة · ${formatArabicDateTime(scheduledAt)}`)
      composer.reset()
      backToAsk()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'فشل الجدولة')
    } finally {
      setPublishing(false)
    }
  }

  const startFreePublish = (parts: TweetPart[]) => {
    setFreeParts(parts)
    setStatus('نكمل النشر المجاني عبر X.')
  }

  const publish = async (preferFree = false) => {
    if (!account) {
      connectX()
      return
    }
    const parts = prepareParts()
    if (!parts.length) {
      setStatus('اكتب شيئاً أولاً.')
      return
    }
    if (preferFree) {
      startFreePublish(parts)
      return
    }
    setPublishing(true)
    setStatus('')
    try {
      const result = await publishNow(parts, account.id)
      setStatus(result.url ? `نُشر على X · ${result.url}` : 'تم النشر على X')
      composer.reset()
      backToAsk()
    } catch (err) {
      if (err instanceof ApiError && (err.freeFallback || err.status === 402)) {
        startFreePublish(parts)
      } else {
        setStatus(err instanceof Error ? err.message : 'فشل النشر')
      }
    } finally {
      setPublishing(false)
    }
  }

  const finishFreePublish = async (tweetIds: string[], url: string | null) => {
    if (!account || !freeParts) return
    setPublishing(true)
    try {
      const result = await api.recordManualPublish(freeParts, tweetIds, account.id)
      setStatus(result.url || url ? `نُشر مجاناً عبر X · ${result.url || url}` : 'تم حفظ النشر')
      setFreeParts(null)
      composer.reset()
      backToAsk()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'تم النشر على X لكن فشل الحفظ محلياً')
      setFreeParts(null)
    } finally {
      setPublishing(false)
    }
  }

  const stepIndex = step === 'ask' ? 0 : step === 'input' ? 1 : step === 'edit' ? 2 : 3
  const intentMeta = INTENTS.find((i) => i.id === intent)

  return (
    <div className="write-page">
      <header className="write-hero">
        <p className="write-kicker">هدوء · اكتب بوضوح</p>
        <h1 className="write-title">
          {step === 'ask' && 'وش تبي تسوي الحين؟'}
          {step === 'input' && (intentMeta?.title || 'كمّل التفاصيل')}
          {step === 'edit' && 'عدّل الثريد بهدوء'}
          {step === 'ship' && 'متى ينزل؟'}
        </h1>
        <p className="write-sub">
          {step === 'ask' && 'اختر شيء واحد. نمشي معك خطوة خطوة.'}
          {step === 'input' && intentMeta?.hint}
          {step === 'edit' && 'راجع النص، أضف صورة، أو قسّم الثريد.'}
          {step === 'ship' && 'انشر الحين أو جدول لأقرب وقت فاضي.'}
        </p>
        <div className="write-steps" aria-hidden>
          {['النوع', 'المدخل', 'التحرير', 'النشر'].map((label, i) => (
            <span key={label} className={i <= stepIndex ? 'on' : ''}>
              {label}
            </span>
          ))}
        </div>
      </header>

      {connectedFlash && <p className="banner ok">تم ربط حساب X بنجاح.</p>}
      {!session?.isAuthenticated && (
        <p className="banner warn">
          اربط حساب X عشان تقدر تستورد وتنشر.
          <button type="button" className="linkish" onClick={connectX}>
            ربط الآن
          </button>
        </p>
      )}

      {step === 'ask' && (
        <section className="intent-grid rise">
          {INTENTS.map(({ id, title, hint, icon: Icon }) => (
            <button key={id} type="button" className="intent-card" onClick={() => pickIntent(id)}>
              <span className="intent-icon">
                <Icon size={22} strokeWidth={1.7} />
              </span>
              <span className="intent-copy">
                <strong>{title}</strong>
                <small>{hint}</small>
              </span>
              <ArrowRight size={18} className="intent-arrow" aria-hidden />
            </button>
          ))}
        </section>
      )}

      {step === 'input' && intent && (
        <section className="write-panel rise">
          <button type="button" className="back-link" onClick={backToAsk}>
            رجوع
          </button>
          <label className="seed-label">
            {intent === 'import' ? 'رابط التغريدة من X' : intent === 'idea' ? 'فكرتك بجملة' : 'الصق النص هنا'}
            {intent === 'import' ? (
              <input
                className="field seed-field"
                dir="ltr"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="https://x.com/.../status/..."
                autoFocus
              />
            ) : (
              <textarea
                className="field textarea seed-field"
                rows={5}
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder={
                  intent === 'idea'
                    ? 'مثال: ليش الناس تؤجل الكتابة؟'
                    : 'الصق النص اللي تبي نشتغل عليه…'
                }
                autoFocus
              />
            )}
          </label>
          <button type="button" className="btn btn-primary seed-go" disabled={busy} onClick={() => void runIntent()}>
            {busy ? 'جاي يشتغل…' : intent === 'import' ? 'استورد وصِغ سعودي' : 'كمّل'}
          </button>
        </section>
      )}

      {(step === 'edit' || step === 'ship') && (
        <div className="write-layout rise">
          <section className="composer">
            <div className="composer-bar">
              <button type="button" className="back-link" onClick={backToAsk}>
                ابدأ من جديد
              </button>
              {session?.accounts.length ? (
                <label className="account-select compact">
                  انشر من
                  <select
                    className="field"
                    value={account?.id || ''}
                    onChange={(e) => {
                      if (e.target.value) void setActiveAccount(e.target.value)
                    }}
                  >
                    {session.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        @{a.handle}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            {composer.parts.map((part, index) => (
              <div key={part.id} className="part-block">
                <div className="part-head">
                  <span className="part-index">{index + 1}</span>
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
                  placeholder={index === 0 ? 'ما الذي تريد قوله؟' : 'كمّل الثريد…'}
                  rows={4}
                />
                <div className="part-foot">
                  <button type="button" className="icon-btn media-icon" onClick={() => onPickMedia(part.id)}>
                    <ImagePlus size={18} />
                    <span className="sr-only">إضافة وسائط</span>
                  </button>
                  <span className="char-count faint">
                    {Math.max(0, composer.maxChars - [...part.text].length).toLocaleString('ar-SA')}
                  </span>
                </div>
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
                        {m.type === 'image' ? <img src={m.url} alt={m.name} /> : <span>{m.type.toUpperCase()}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <button type="button" className="btn btn-ghost add-part" onClick={composer.addPart}>
              <Plus size={16} />
              أضف تغريدة
            </button>

            {step === 'edit' && (
              <button type="button" className="btn btn-primary ship-next" onClick={() => setStep('ship')}>
                تمام — متى ينزل؟
              </button>
            )}

            {step === 'ship' && (
              <div className="schedule-box">
                <strong>متى يُنشر؟</strong>
                <div className="schedule-grid">
                  <label className="schedule-field">
                    اليوم
                    <select className="field schedule-select" value={dayValue} onChange={(e) => setDay(e.target.value)}>
                      {dayOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="schedule-field">
                    الوقت
                    <select
                      className="field schedule-select"
                      value={timeValue}
                      onChange={(e) => setTime(e.target.value)}
                    >
                      {timeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button type="button" className="btn btn-ghost suggest-slot" onClick={() => void suggestNearest()}>
                  <CalendarClock size={16} />
                  <span>أقرب موعد فاضي: {formatArabicDateTime(scheduledAt)}</span>
                </button>
                <div className="actions">
                  <button type="button" className="btn btn-ghost" disabled={publishing} onClick={() => void onSchedule()}>
                    جدولة
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={publishing}
                    onClick={() => void publish(true)}
                  >
                    <Send size={16} />
                    {publishing ? 'جارٍ…' : 'انشر مجاناً'}
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-soft free-publish"
                  disabled={publishing}
                  onClick={() => void publish(false)}
                >
                  جرّب النشر عبر API
                </button>
                <button type="button" className="back-link" onClick={() => setStep('edit')}>
                  رجوع للتحرير
                </button>
              </div>
            )}
          </section>

          <aside className="preview-pane">
            <div className="preview-label">معاينة</div>
            <TweetPreview parts={composer.parts} account={account} />
          </aside>
        </div>
      )}

      {status && <p className="status-line muted">{status}</p>}

      <input
        ref={fileRef}
        type="file"
        className="sr-only"
        accept="image/*,video/*,.gif"
        multiple
        onChange={(e) => void onFiles(e.target.files)}
      />

      {freeParts && (
        <FreePublishWizard
          parts={freeParts}
          handle={account?.handle}
          onClose={() => setFreeParts(null)}
          onDone={(tweetIds, url) => void finishFreePublish(tweetIds, url)}
        />
      )}
    </div>
  )
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toDayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toTimeKey(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function buildDayOptions(from: Date, max: Date) {
  const options: { value: string; label: string }[] = []
  const cursor = new Date(from)
  cursor.setHours(12, 0, 0, 0)
  const end = new Date(max)
  end.setHours(12, 0, 0, 0)
  while (cursor.getTime() <= end.getTime() && options.length < 60) {
    options.push({
      value: toDayKey(cursor),
      label: new Intl.DateTimeFormat('ar-SA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(cursor),
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return options
}

function buildTimeOptions() {
  const hours = new Set<number>([...SUGGESTED_SLOTS, ...Array.from({ length: 24 }, (_, i) => i)])
  return [...hours]
    .sort((a, b) => a - b)
    .map((hour) => {
      const value = `${pad(hour)}:00`
      const label = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(2000, 0, 1, hour, 0))
      return { value, label }
    })
}
