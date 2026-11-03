import { useState } from 'react'
import { Sparkles, Wand2, Languages, Link2 } from 'lucide-react'
import { PLANS } from '../../data/plans'
import { useApp } from '../../context/AppContext'
import type { TweetPart } from '../../types'
import { createEmptyPart } from '../../hooks/useThreadComposer'
import './AiPanel.css'

interface Props {
  onApply: (parts: TweetPart[]) => void
  currentText: string
}

function saudiRewrite(text: string) {
  return text
    .replace(/\bماذا\b/g, 'وش')
    .replace(/\bكيف\b/g, 'كيف')
    .replace(/\bأيضا\b/g, 'تقدر')
    .replace(/\bيجب\b/g, 'لازم')
    .replace(/\bالآن\b/g, 'الحين')
    .trim()
}

function strengthen(text: string) {
  const body = text.trim()
  if (!body) return body
  const opener = body.split('\n')[0]
  const rest = body.slice(opener.length).trim()
  return `${opener}\n\n${rest ? `${rest}\n\n` : ''}لو استفدت، احفظ التغريدة وارجع لها لاحقاً.`
}

function ideaToThread(idea: string): TweetPart[] {
  const clean = idea.trim() || 'فكرة بسيطة'
  const parts = [
    `${clean}\n\nأكثر الناس يضيعون هنا قبل ما يبدأون.`,
    `خلّها بسيطة:\n١) اكتب أول جملة\n٢) كمّل بدون ما توقف\n٣) انشر وكمّل بكره`,
    `الهدوء يساعد… مو السرعة.\n\nابدأ الحين، وخلّ الباقي يجي لوحده.\n\nتابعني لو تبي أدوات كتابة بهدوء.`,
  ]
  return parts.map((text) => ({ ...createEmptyPart(), text }))
}

export function AiPanel({ onApply, currentText }: Props) {
  const { session, planId } = useApp()
  const plan = PLANS[planId]
  const used = session?.aiAttemptsUsed ?? 0
  const unlimited = plan.aiAttempts === 'unlimited'
  const left = unlimited ? null : Math.max(0, Number(plan.aiAttempts) - used)
  const [idea, setIdea] = useState('')
  const [importUrl, setImportUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const run = async (fn: () => void) => {
    if (!unlimited && (left ?? 0) <= 0) {
      setNote('خلصت محاولات الذكاء في الخطة المجانية.')
      return
    }
    setBusy(true)
    setNote('')
    await new Promise((r) => setTimeout(r, 450))
    fn()
    setBusy(false)
    setNote('تم — راجع النص وعدّل لو تبي.')
  }

  return (
    <section className="ai-panel surface rise">
      <div className="row">
        <Sparkles size={18} color="var(--accent-strong)" />
        <strong>أدوات الذكاء</strong>
        <span className="spacer" />
        <span className="chip chip-accent">
          {unlimited ? 'بلا حدود' : `${left} محاولة`}
        </span>
      </div>

      <label className="ai-label">
        فكرة واحدة → ثريد كامل
        <textarea
          className="field textarea"
          rows={2}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="مثال: ليش الناس تؤجل الكتابة؟"
        />
      </label>
      <button
        type="button"
        className="btn btn-soft"
        disabled={busy}
        onClick={() => run(() => onApply(ideaToThread(idea)))}
      >
        <Wand2 size={16} />
        اكتب الثريد
      </button>

      <div className="ai-actions">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !currentText.trim()}
          onClick={() =>
            run(() => onApply([{ ...createEmptyPart(), text: strengthen(currentText) }]))
          }
        >
          حسّن النص
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !currentText.trim()}
          onClick={() =>
            run(() => onApply([{ ...createEmptyPart(), text: saudiRewrite(currentText) }]))
          }
        >
          <Languages size={16} />
          لهجة سعودية
        </button>
      </div>

      <label className="ai-label">
        استورد ثريد من رابط X
        <div className="row">
          <input
            className="field"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://x.com/.../status/..."
          />
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || !importUrl.trim()}
            onClick={() =>
              run(() =>
                onApply(
                  ideaToThread(
                    'ثريد مستورد — أعدنا صياغته بهدوء وبلهجة سعودية سلسة مع الحفاظ على الروابط والهاشتاقات.',
                  ),
                ),
              )
            }
          >
            <Link2 size={16} />
          </button>
        </div>
      </label>

      {note && <p className="ai-note muted">{note}</p>}
    </section>
  )
}
