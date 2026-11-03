import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import './LandingPage.css'

export function LandingPage() {
  const { session, connectX } = useApp()
  const go = session?.isAuthenticated

  return (
    <div className="landing">
      <div className="landing-sky" aria-hidden>
        <span className="landing-orb landing-orb-a" />
        <span className="landing-orb landing-orb-b" />
        <span className="landing-orb landing-orb-c" />
        <span className="landing-grain" />
        <div className="landing-thread-field">
          <span className="field-line field-line-1" />
          <span className="field-line field-line-2" />
          <span className="field-line field-line-3" />
          <span className="field-pulse" />
        </div>
      </div>

      <header className="landing-nav">
        <Link to="/plans" className="landing-nav-link">
          الخطط
        </Link>
      </header>

      <main className="landing-hero">
        <h1 className="landing-brand">هدوء</h1>
        <p className="landing-line">اكتب. حسّن. انشر على X — بدون ضجيج.</p>
        <div className="landing-cta">
          {go ? (
            <Link to="/write" className="btn btn-primary landing-btn">
              افتح الكتابة
            </Link>
          ) : (
            <button type="button" className="btn btn-primary landing-btn" onClick={connectX}>
              ادخل بحساب X
            </button>
          )}
        </div>
        <a href="#more" className="landing-scroll" aria-label="المزيد">
          <span />
        </a>
      </main>

      <section id="more" className="landing-rest">
        <p className="landing-rest-kicker">كيف يشتغل</p>
        <h2>ثلاثة أشياء فقط</h2>
        <ul className="landing-points">
          <li>
            <strong>استورد</strong>
            <span>رابط X → نسخة سعودية مختلفة</span>
          </li>
          <li>
            <strong>راجع</strong>
            <span>معاينة قبل ما تنشر</span>
          </li>
          <li>
            <strong>انشر</strong>
            <span>الحين أو أقرب وقت فاضي</span>
          </li>
        </ul>
      </section>
    </div>
  )
}
