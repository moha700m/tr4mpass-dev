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

type ToolId = 'write' | 'improve' | 'saudi' | 'import'

export function AiPanel({ onApply, currentText }: Props) {
  const { session, planId, refreshSession, connectX } = useApp()
  const plan = PLANS[planId]
  const used = session?.aiAttemptsUsed ?? 0
  const unlimited = plan.aiAttempts === 'unlimited'
  const left = unlimited ? null : Math.max(0, Number(plan.aiAttempts) - used)
  const [active, setActive] = useState<ToolId>('write')
  const [idea, setIdea] = useState('')
  const [importUrl, setImportUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const remainingLabel = unlimited ? 'بلا حدود' : `${left} متبقية`

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

  const runWrite = () =>
    run(async () => {
      const seed = (idea || currentText).trim()
      if (!seed) {
        setNote('اكتب فكرة أولاً.')
        return
      }
      const res = await api.aiThread(seed)
      onApply(res.parts.map((text) => ({ ...createEmptyPart(), text })))
    })

  const runImprove = () =>
    run(async () => {
      const res = await api.aiImprove(currentText)
      onApply([{ ...createEmptyPart(), text: res.text }])
    })

  const runSaudi = () =>
    run(async () => {
      const res = await api.aiSaudi(currentText)
      onApply([{ ...createEmptyPart(), text: res.text }])
    })

  const runImport = () =>
    run(async () => {
      if (!importUrl.trim()) {
        setNote('الصق رابط الثريد أولاً.')
        return
      }
      const res = await api.aiImport(importUrl.trim(), true)
      onApply(
        res.parts.map((p) => ({
          ...createEmptyPart(),
          text: p.text,
          media: p.media || [],
        })),
      )
    })

  const tools: {
    id: ToolId
    label: string
    icon: typeof Wand2
    disabled?: boolean
    onClick: () => void
  }[] = [
    {
      id: 'write',
      label: 'اكتب بالذكاء',
      icon: Wand2,
      onClick: () => setActive('write'),
    },
    {
      id: 'improve',
      label: 'حسّن النص',
      icon: Sparkles,
      disabled: !currentText.trim(),
      onClick: () => {
        setActive('improve')
        void runImprove()
      },
    },
    {
      id: 'saudi',
      label: 'باللهجة السعودية',
      icon: Languages,
      disabled: !currentText.trim(),
      onClick: () => {
        setActive('saudi')
        void runSaudi()
      },
    },
    {
      id: 'import',
      label: 'استورد من X',
      icon: Link2,
      onClick: () => setActive('import'),
    },
  ]

  return (
    <section className="ai-panel rise">
      <div className="ai-tools">
        {tools.map(({ id, label, icon: Icon, disabled, onClick }) => (
          <button
            key={id}
            type="button"
            className={`ai-pill${active === id ? ' is-active' : ''}`}
            disabled={busy || disabled}
            onClick={onClick}
          >
            <Icon size={15} strokeWidth={1.9} />
            <span className="ai-pill-label">{label}</span>
            <span className="ai-pill-meta">{remainingLabel}</span>
          </button>
        ))}
      </div>

      {(active === 'write' || active === 'import') && (
        <div className="ai-fields">
          {active === 'write' && (
            <>
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
              <button type="button" className="btn btn-soft ai-run" disabled={busy} onClick={() => void runWrite()}>
                <Wand2 size={16} />
                توليد الثريد
              </button>
            </>
          )}
          {active === 'import' && (
            <>
              <label className="ai-label">
                رابط ثريد من X
                <input
                  className="field"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://x.com/.../status/..."
                  dir="ltr"
                />
              </label>
              <button type="button" className="btn btn-soft ai-run" disabled={busy} onClick={() => void runImport()}>
                <Link2 size={16} />
                استيراد وإعادة صياغة
              </button>
            </>
          )}
        </div>
      )}

      {note && <p className="ai-note muted">{note}</p>}
    </section>
  )
}
