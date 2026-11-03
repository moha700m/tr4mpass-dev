import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { nextFreeSlot } from '../lib/schedule'
import { createEmptyPart } from '../hooks/useThreadComposer'
import './ImportPage.css'

export function ImportPage() {
  const { posts, setPosts, session, connectX, plan } = useApp()
  const [links, setLinks] = useState('')
  const [rewrite, setRewrite] = useState(true)
  const [keepMedia, setKeepMedia] = useState(true)
  const [promo, setPromo] = useState(true)
  const [promoText, setPromoText] = useState('لو عجبك الأسلوب، تابعني لمزيد من الثريدات الهادئة.')
  const [promoPlace, setPromoPlace] = useState<'end' | 'start'>('end')
  const [message, setMessage] = useState('')

  const run = () => {
    if (!session?.isAuthenticated) {
      connectX()
      return
    }

    const urls = links
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.includes('x.com/') || l.includes('twitter.com/'))

    if (!urls.length) {
      setMessage('الصق رابط ثريد واحد على الأقل من X.')
      return
    }

    if (!plan.bulkImportUnlimited && urls.length > 5) {
      setMessage('الخطة المجانية محدودة بـ 5 روابط في المرة. ارتقِ لهدوء بلس.')
      return
    }

    let cursor = nextFreeSlot(posts)
    const created = urls.map((url, i) => {
      if (i > 0) cursor = nextFreeSlot([...posts], new Date(cursor.getTime() + 60 * 60 * 1000))
      const body = rewrite
        ? `ثريد معاد صياغته بلهجة سعودية سلسة.\n\nالمصدر: ${url}\n\nالفكرة نفسها، بأسلوب أوضح وأهدأ.`
        : `ثريد مستورد كما هو.\n\n${url}`

      const parts = [{ ...createEmptyPart(), text: body }]
      if (promo && promoText.trim()) {
        const promoPart = { ...createEmptyPart(), text: promoText.trim() }
        if (promoPlace === 'end') parts.push(promoPart)
        else parts.unshift(promoPart)
      }

      const item = {
        id: `imp_${Date.now()}_${i}`,
        accountId: session.activeAccountId || session.accounts[0].id,
        parts,
        scheduledAt: cursor.toISOString(),
        status: 'scheduled' as const,
        createdAt: new Date().toISOString(),
      }
      cursor = new Date(cursor.getTime() + 3 * 60 * 60 * 1000)
      return item
    })

    setPosts((prev) => [...created, ...prev])
    setMessage(
      `تمت جدولة ${created.length} ثريد في أقرب الأوقات الفارغة${keepMedia ? ' (مع خيار الاحتفاظ بالوسائط عند الاستيراد الحقيقي)' : ''}.`,
    )
    setLinks('')
  }

  return (
    <div className="import-page rise">
      <h1 className="page-title">استيراد جماعي</h1>
      <p className="page-sub">الصق روابط ثريدات X، وأعد صياغتها، وجدوِلها بهدوء.</p>

      <section className="surface import-card stack">
        <label className="field-label">
          روابط الثريدات (سطر لكل رابط)
          <textarea
            className="field textarea"
            rows={7}
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder={'https://x.com/user/status/123\nhttps://x.com/user/status/456'}
          />
        </label>

        <label className="check">
          <input type="checkbox" checked={rewrite} onChange={(e) => setRewrite(e.target.checked)} />
          إعادة صياغة باللهجة السعودية
        </label>
        <label className="check">
          <input type="checkbox" checked={keepMedia} onChange={(e) => setKeepMedia(e.target.checked)} />
          الاحتفاظ بالصور والفيديو الأصلية
        </label>
        <label className="check">
          <input type="checkbox" checked={promo} onChange={(e) => setPromo(e.target.checked)} />
          أضف تغريدة ترويجية
        </label>

        {promo && (
          <>
            <label className="field-label">
              نص التغريدة الإضافية
              <textarea
                className="field textarea"
                rows={3}
                value={promoText}
                onChange={(e) => setPromoText(e.target.value)}
              />
            </label>
            <label className="field-label">
              مكانها
              <select
                className="field"
                value={promoPlace}
                onChange={(e) => setPromoPlace(e.target.value as 'end' | 'start')}
              >
                <option value="end">في نهاية الثريد</option>
                <option value="start">في بداية الثريد</option>
              </select>
            </label>
          </>
        )}

        <button type="button" className="btn btn-primary" onClick={run}>
          استورد وجدوِل تلقائياً
        </button>
        {message && <p className="muted">{message}</p>}
      </section>
    </div>
  )
}
