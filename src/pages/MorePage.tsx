import { Link, useSearchParams } from 'react-router-dom'
import { LogOut, Moon, Sun, Monitor, Unplug } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PRO_PRICE_SAR } from '../data/plans'
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
      <p className="page-sub">حسابك والمظهر.</p>

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
          {session?.accounts.length ? 'أضف حساب' : 'اربط حساب X'}
        </button>
      </section>

      <section className="surface more-card stack">
        <h2>الخطة</h2>
        <p className="plan-line">
          <span className="chip chip-accent">{plan.name}</span>
          {planId === 'free' ? (
            <Link to="/plans" className="btn btn-soft">
              ترقية — {PRO_PRICE_SAR} ر.س
            </Link>
          ) : (
            <span className="muted">كل شيء مفتوح.</span>
          )}
        </p>
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

      {session?.isAuthenticated && (
        <button type="button" className="btn btn-ghost logout-btn" onClick={() => void logout()}>
          <LogOut size={16} />
          تسجيل الخروج
        </button>
      )}
    </div>
  )
}
