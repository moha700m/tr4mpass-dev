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
      <p className="page-sub">بسيط: ابدأ مجاناً، وارتَقِ لما تحتاج مساحة أكبر.</p>

      <div className="plans-grid">
        <article className="surface plan-card">
          <h2>{PLANS.free.name}</h2>
          <p className="price">٠ ر.س</p>
          <ul>
            <li>
              <Check size={16} /> حساب واحد
            </li>
            <li>
              <Check size={16} /> منشورات مجدولة محدودة
            </li>
            <li>
              <Check size={16} /> جدولة حتى ٧ أيام
            </li>
            <li>
              <Check size={16} /> محاولات ذكاء محدودة
            </li>
          </ul>
          {planId === 'free' ? (
            <span className="chip chip-accent">خطتك الحالية</span>
          ) : (
            <Link to="/write" className="btn btn-ghost">
              العودة للكتابة
            </Link>
          )}
        </article>

        <article className="surface plan-card featured">
          <div className="chip chip-accent">براند محمد</div>
          <h2>{PLANS.pro.name}</h2>
          <p className="price">
            {PRO_PRICE_SAR} ر.س <span>/ شهر</span>
          </p>
          <ul>
            <li>
              <Check size={16} /> منشورات وثريدات بلا حدود
            </li>
            <li>
              <Check size={16} /> جدولة حتى سنة
            </li>
            <li>
              <Check size={16} /> فيديو وGIF
            </li>
            <li>
              <Check size={16} /> ذكاء اصطناعي بلا حدود
            </li>
            <li>
              <Check size={16} /> حتى ٣ حسابات
            </li>
            <li>
              <Check size={16} /> استيراد جماعي بلا قيود
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
