import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { FREE_BULK_LIMIT } from '../data/plans'
import { api } from '../lib/api'
import './ImportPage.css'

export function ImportPage() {
  const { session, connectX, plan, refreshPosts, setActiveAccount } = useApp()
  const [links, setLinks] = useState('')
  const [rewrite, setRewrite] = useState(true)
  const [keepMedia, setKeepMedia] = useState(true)
  const [promo, setPromo] = useState(true)
  const [promoText, setPromoText] = useState(
    'مثال: لو استفدت، تابعني لمزيد من المحتوى بهدوء 👇',
  )
  const [promoPlace, setPromoPlace] = useState<'end' | 'start'>('end')
  const [rewritePromo, setRewritePromo] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const remaining = useMemo(() => {
    if (plan.bulkImportUnlimited) return null
    const used = session?.bulkImportsUsed ?? 0
    return Math.max(0, FREE_BULK_LIMIT - used)
  }, [plan.bulkImportUnlimited, session?.bulkImportsUsed])

  const run = async () => {
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

    setBusy(true)
    setMessage('')
    try {
      const result = await api.bulkImport({
        links: urls,
        accountId: session.activeAccountId || undefined,
        rewrite,
        keepMedia,
        promoText: promo ? promoText : '',
        promoPlace,
        rewritePromo: promo && rewritePromo,
      })
      await refreshPosts()
      setMessage(`تمت جدولة ${result.posts.length} ثريد في أقرب الأوقات الفارغة (9ص / 12م / 4م / 8م).`)
      setLinks('')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'فشل الاستيراد')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="import-page rise">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="spacer">
          <h1 className="page-title">استيراد جماعي</h1>
          <p className="page-sub">
            الصق روابط ثريدات X. نستورد كل ثريد، نعيد صياغته بلهجة سعودية، ونجدولّه في أقرب موعد
            فارغ (9ص، 12م، 4م، 8م).
          </p>
        </div>
        {remaining !== null && <span className="chip chip-accent">{remaining} متبقية</span>}
      </div>

      <section className="surface import-card stack">
        <label className="field-label">
          الروابط (رابط في كل سطر)
          <textarea
            className="field textarea"
            rows={7}
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder={'https://x.com/user/status/123\nhttps://x.com/user/status/456'}
          />
        </label>

        <label className="field-label">
          انشر من
          <select
            className="field"
            value={session?.activeAccountId || ''}
            onChange={(e) => {
              if (e.target.value) void setActiveAccount(e.target.value)
            }}
            disabled={!session?.accounts.length}
          >
            {session?.accounts?.length ? (
              session.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.handle}
                </option>
              ))
            ) : (
              <option value="">اربط حساباً أولاً</option>
            )}
          </select>
        </label>

        <label className="check">
          <input type="checkbox" checked={keepMedia} onChange={(e) => setKeepMedia(e.target.checked)} />
          احتفظ بالصور والفيديو
        </label>
        <label className="check">
          <input type="checkbox" checked={rewrite} onChange={(e) => setRewrite(e.target.checked)} />
          إعادة صياغة باللهجة السعودية
        </label>
        <label className="check">
          <input type="checkbox" checked={promo} onChange={(e) => setPromo(e.target.checked)} />
          أضف تغريدة لكل ثريد
        </label>

        {promo && (
          <>
            <label className="field-label">
              تغريدة تُضاف لكل ثريد (اختياري)
              <textarea
                className="field textarea"
                rows={3}
                value={promoText}
                onChange={(e) => setPromoText(e.target.value)}
              />
            </label>
            <label className="field-label">
              مكانها في الثريد
              <select
                className="field"
                value={promoPlace}
                onChange={(e) => setPromoPlace(e.target.value as 'end' | 'start')}
              >
                <option value="end">في النهاية (آخر تغريدة)</option>
                <option value="start">في البداية</option>
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={rewritePromo}
                onChange={(e) => setRewritePromo(e.target.checked)}
              />
              أعد صياغتها مع الثريد
            </label>
            <p className="faint" style={{ margin: 0, fontSize: '0.85rem' }}>
              افتراضياً تبقى كما كتبتها. فعّل الخيار أعلاه لإعادة صياغتها.
            </p>
          </>
        )}

        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run()}>
          {busy ? 'جارٍ الاستيراد…' : `استورد وجدول (${links.split(/\n+/).filter(Boolean).length})`}
        </button>
        {message && <p className="muted">{message}</p>}
      </section>
    </div>
  )
}
