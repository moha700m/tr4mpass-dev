import { useState } from 'react'
import { Sparkles, Wand2, Languages, Link2 } from 'lucide-react'
import { PLANS } from '../../data/plans'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import type { TweetPart } from '../../types'
import { createEmptyPart } from '../../hooks/useThreadComposer'
import './AiPanel.css'

interface Props {
  onApply: (parts: TweetPart[]) => void
  currentText: string
}

export function AiPanel({ onApply, currentText }: Props) {
  const { session, planId, refreshSession, connectX } = useApp()
  const plan = PLANS[planId]
  const used = session?.aiAttemptsUsed ?? 0
  const unlimited = plan.aiAttempts === 'unlimited'
  const left = unlimited ? null : Math.max(0, Number(plan.aiAttempts) - used)
  const [idea, setIdea] = useState('')
  const [importUrl, setImportUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const guard = () => {
    if (!session?.isAuthenticated) {
      connectX()
      return false
    }
    if (!unlimited && (left ?? 0) <= 0) {
      setNote('خلصت محاولات الذكاء في الخطة المجانية.')
      return false
    }
    return true
  }

  const run = async (fn: () => Promise<void>) => {
    if (!guard()) return
    setBusy(true)
    setNote('')
    try {
      await fn()
      await refreshSession()
      setNote('تم — راجع النص وعدّل لو تبي.')
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'فشل الطلب')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ai-panel surface rise">
      <div className="row">
        <Sparkles size={18} color="var(--accent-strong)" />
        <strong>أدوات الذكاء</strong>
        <span className="spacer" />
        <span className="chip chip-accent">
          {unlimited ? 'بلا حدود' : `${left} متبقية`}
        </span>
      </div>

      <div className="ai-grid">
        <button
          type="button"
          className="btn btn-soft ai-tool"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const res = await api.aiThread(idea || currentText)
              onApply(res.parts.map((text) => ({ ...createEmptyPart(), text })))
            })
          }
        >
          <Wand2 size={16} />
          اكتب بالذكاء
          {!unlimited && <small>{left} متبقية</small>}
        </button>
        <button
          type="button"
          className="btn btn-ghost ai-tool"
          disabled={busy || !currentText.trim()}
          onClick={() =>
            run(async () => {
              const res = await api.aiImprove(currentText)
              onApply([{ ...createEmptyPart(), text: res.text }])
            })
          }
        >
          حسّن النص
          {!unlimited && <small>{left} متبقية</small>}
        </button>
        <button
          type="button"
          className="btn btn-ghost ai-tool"
          disabled={busy || !currentText.trim()}
          onClick={() =>
            run(async () => {
              const res = await api.aiSaudi(currentText)
              onApply([{ ...createEmptyPart(), text: res.text }])
            })
          }
        >
          <Languages size={16} />
          باللهجة السعودية
          {!unlimited && <small>{left} متبقية</small>}
        </button>
        <button
          type="button"
          className="btn btn-ghost ai-tool"
          disabled={busy || !importUrl.trim()}
          onClick={() =>
            run(async () => {
              const res = await api.aiImport(importUrl, true)
              onApply(
                res.parts.map((p) => ({
                  ...createEmptyPart(),
                  text: p.text,
                  media: p.media || [],
                })),
              )
            })
          }
        >
          <Link2 size={16} />
          استورد من X
          {!unlimited && <small>{left} متبقية</small>}
        </button>
      </div>

      <label className="ai-label">
        فكرة للثريد
        <textarea
          className="field textarea"
          rows={2}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="مثال: ليش الناس تؤجل الكتابة؟"
        />
      </label>

      <label className="ai-label">
        رابط ثريد من X
        <input
          className="field"
          value={importUrl}
          onChange={(e) => setImportUrl(e.target.value)}
          placeholder="https://x.com/.../status/..."
        />
      </label>

      {note && <p className="ai-note muted">{note}</p>}
    </section>
  )
}
