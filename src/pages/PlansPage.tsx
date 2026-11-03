import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { PLANS, PRO_PRICE_SAR } from '../data/plans'
import { useApp } from '../context/AppContext'
import './PlansPage.css'

export function PlansPage() {
  const { planId, connectX, session } = useApp()

  return (
    <div className="plans-page rise">
      <h1 className="page-title">الخطط</h1>
      <p className="page-sub">ابدأ مجاناً. ارتَقِ لما تحتاج أكثر.</p>

      <div className="plans-grid">
        <article className="surface plan-card">
          <h2>{PLANS.free.name}</h2>
          <p className="price">٠ ر.س</p>
          <ul>
            <li>
              <Check size={16} /> حساب واحد
            </li>
            <li>
              <Check size={16} /> جدولة ٧ أيام
            </li>
            <li>
              <Check size={16} /> ذكاء محدود
            </li>
          </ul>
          {planId === 'free' ? (
            <span className="chip chip-accent">خطتك الحالية</span>
          ) : (
            <Link to="/write" className="btn btn-ghost">
              الكتابة
            </Link>
          )}
        </article>

        <article className="surface plan-card featured">
          <h2>{PLANS.pro.name}</h2>
          <p className="price">
            {PRO_PRICE_SAR} ر.س <span>/ شهر</span>
          </p>
          <ul>
            <li>
              <Check size={16} /> بلا حدود تقريباً
            </li>
            <li>
              <Check size={16} /> فيديو وGIF
            </li>
            <li>
              <Check size={16} /> حتى ٣ حسابات
            </li>
            <li>
              <Check size={16} /> استيراد جماعي
            </li>
          </ul>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (!session?.isAuthenticated) connectX()
              else alert('الدفع سيُربط لاحقاً — الواجهة جاهزة.')
            }}
          >
            ابدأ هدوء بلس
          </button>
        </article>
      </div>
    </div>
  )
}
