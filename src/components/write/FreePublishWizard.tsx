import { useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, X } from 'lucide-react'
import { extractStatusId } from '../../lib/xUrl'
import type { TweetPart } from '../../types'
import './FreePublishWizard.css'

interface Props {
  parts: TweetPart[]
  handle?: string
  onClose: () => void
  onDone: (tweetIds: string[], url: string | null) => void
}

function partText(part: TweetPart) {
  return (part.text || '').trim()
}

function intentUrl(text: string, replyToId?: string | null) {
  const u = new URL('https://x.com/intent/post')
  u.searchParams.set('text', text)
  if (replyToId) u.searchParams.set('in_reply_to', replyToId)
  return u.toString()
}

export function FreePublishWizard({ parts, handle, onClose, onDone }: Props) {
  const steps = useMemo(() => parts.filter((p) => partText(p) || p.media?.length), [parts])
  const [index, setIndex] = useState(0)
  const [ids, setIds] = useState<string[]>([])
  const [pasted, setPasted] = useState('')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)

  const current = steps[index]
  const text = current ? partText(current) : ''
  const prevId = ids[index - 1] || null
  const openUrl = current ? intentUrl(text, prevId) : '#'

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setNote('ما قدرنا ننسخ — انسخ يدوياً من الصندوق.')
    }
  }

  const openX = () => {
    window.open(openUrl, '_blank', 'noopener,noreferrer')
  }

  const confirmStep = () => {
    const id = extractStatusId(pasted) || pasted.trim()
    if (!/^\d{5,}$/.test(id)) {
      setNote('الصق رابط التغريدة بعد ما تنشرها (أو رقم الـ ID).')
      return
    }
    const nextIds = [...ids.slice(0, index), id]
    setIds(nextIds)
    setPasted('')
    setNote('')
    if (index >= steps.length - 1) {
      const url = handle ? `https://x.com/${handle}/status/${nextIds[0]}` : `https://x.com/i/status/${nextIds[0]}`
      onDone(nextIds, url)
      return
    }
    setIndex(index + 1)
  }

  if (!steps.length) {
    return (
      <div className="fpw-backdrop" role="dialog" aria-modal="true">
        <div className="fpw-card surface">
          <p>ما في نص للنشر.</p>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fpw-backdrop" role="dialog" aria-modal="true">
      <div className="fpw-card surface rise">
        <div className="fpw-head">
          <div>
            <strong>نشر مجاني عبر X</strong>
            <p className="muted">
              بدون رصيد API — نفتح X جاهز بالنص، وأنت تضغط نشر فقط.
              {steps.length > 1 ? ` · تغريدة ${index + 1} من ${steps.length}` : ''}
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="إغلاق" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="fpw-progress" aria-hidden>
          {steps.map((_, i) => (
            <span key={i} className={i < index ? 'done' : i === index ? 'current' : ''} />
          ))}
        </div>

        <div className="fpw-body">
          <div className="fpw-text">{text || 'بدون نص — أرفق الوسائط يدوياً في X'}</div>
          {!!current?.media?.length && (
            <p className="fpw-media-hint faint">
              فيه {current.media.length} وسائط — بعد ما تفتح X، أرفقها يدوياً قبل النشر.
            </p>
          )}

          <div className="fpw-actions">
            <button type="button" className="btn btn-ghost" onClick={() => void copyText()}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'تم النسخ' : 'نسخ النص'}
            </button>
            <button type="button" className="btn btn-primary" onClick={openX}>
              <ExternalLink size={16} />
              افتح X وانشر
            </button>
          </div>

          <label className="fpw-label">
            بعد النشر: الصق رابط التغريدة
            <input
              className="field"
              dir="ltr"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="https://x.com/you/status/123..."
            />
          </label>

          {note && <p className="fpw-note">{note}</p>}

          <button type="button" className="btn btn-soft fpw-next" onClick={confirmStep}>
            {index >= steps.length - 1 ? 'تم — احفظ النشر' : 'التالي في الثريد'}
          </button>
        </div>
      </div>
    </div>
  )
}
