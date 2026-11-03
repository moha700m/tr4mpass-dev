import { Link, useSearchParams } from 'react-router-dom'
import { LogOut, Moon, Sun, Monitor, Unplug } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PLANS, PRO_PRICE_SAR } from '../data/plans'
import type { ThemeMode } from '../types'
import './MorePage.css'

export function MorePage() {
  const {
    theme,
    setTheme,
    session,
    connectX,
    logout,
    disconnectAccount,
    planId,
    plan,
  } = useApp()
  const [params] = useSearchParams()
  const error = params.get('error')

  const themes: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
    { id: 'light', label: 'فاتح', icon: Sun },
    { id: 'dark', label: 'داكن', icon: Moon },
    { id: 'system', label: 'تلقائي', icon: Monitor },
  ]

  return (
    <div className="more-page rise">
      <h1 className="page-title">المزيد</h1>
      <p className="page-sub">حسابك، خطتك، وإعدادات الهدوء.</p>

      {error && <p className="banner warn">{error}</p>}

      <section className="surface more-card stack">
        <h2>حسابات X</h2>
        {session?.accounts.length ? (
          session.accounts.map((acc) => (
            <div key={acc.id} className="account-row">
              <img src={acc.avatarUrl} alt="" />
              <div>
                <strong>{acc.name}</strong>
                <div className="muted">@{acc.handle}</div>
              </div>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void disconnectAccount(acc.id)}
              >
                <Unplug size={16} />
                فصل
              </button>
            </div>
          ))
        ) : (
          <p className="muted">ما في حساب مربوط بعد.</p>
        )}

        <button
          type="button"
          className="btn btn-primary"
          onClick={connectX}
          disabled={(session?.accounts.length || 0) >= plan.maxAccounts}
        >
          {session?.accounts.length ? 'أضف حساب X آخر' : 'اربط حساب X'}
        </button>
        <p className="faint hint">
          الدخول عبر OAuth الرسمي فقط — ما نطلب كلمة مرورك أبداً.
          {` · حتى ${plan.maxAccounts} حساب في خطتك الحالية.`}
        </p>
        {!session?.xConfigured && (
          <p className="banner warn">
            لتشغيل الربط الحقيقي: أضف <code>X_CLIENT_ID</code> و<code>X_CLIENT_SECRET</code> في
            Environment Variables على Vercel من تطبيقك في{' '}
            <a href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noreferrer">
              Developer Console
            </a>
            .
          </p>
        )}
      </section>

      <section className="surface more-card stack">
        <h2>الخطة</h2>
        <div className="plan-current chip chip-accent">{plan.name}</div>
        <ul className="plan-list">
          <li>حسابات: {plan.maxAccounts}</li>
          <li>
            منشورات مجدولة:{' '}
            {plan.maxScheduled === 'unlimited' ? 'بلا حدود' : plan.maxScheduled}
          </li>
          <li>جدولة حتى: {plan.scheduleDays} يوم</li>
          <li>
            ذكاء اصطناعي:{' '}
            {plan.aiAttempts === 'unlimited' ? 'بلا حدود' : `${plan.aiAttempts} محاولة`}
          </li>
          <li>فيديو وGIF: {plan.videoGif ? 'نعم' : 'لا'}</li>
        </ul>

        {planId === 'free' ? (
          <Link to="/plans" className="btn btn-primary">
            ترقية لهدوء بلس — {PRO_PRICE_SAR} ر.س / شهر
          </Link>
        ) : (
          <p className="muted">أنت على خطة محمد المدفوعة · كل شيء مفتوح.</p>
        )}
      </section>

      <section className="surface more-card stack">
        <h2>المظهر</h2>
        <div className="theme-row">
          {themes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`btn ${theme === id ? 'btn-soft' : 'btn-ghost'}`}
              onClick={() => setTheme(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="surface more-card stack">
        <h2>عن هدوء</h2>
        <p className="muted">
          منتج شخصي من محمد (@justmgz) — يساعد أي شخص يكتب وينشر ثريدات على X بهدوء
          ووضوح.
        </p>
        {session?.isAuthenticated && (
          <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
            <LogOut size={16} />
            تسجيل الخروج
          </button>
        )}
      </section>

      <p className="faint compare">
        المجاني: {PLANS.free.name} · المدفوع: {PLANS.pro.name}
      </p>
    </div>
  )
}
