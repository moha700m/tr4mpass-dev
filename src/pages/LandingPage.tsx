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
        <span className="landing-nav-brand">Trenda</span>
        <Link to="/plans" className="landing-nav-link">
          الخطط
        </Link>
      </header>

      <main className="landing-hero">
        <h1 className="landing-brand">تريندا</h1>
        <p className="landing-line">استورد أي تغريدة → صياغة سعودية → انشر وطلّع ترند.</p>
        <div className="landing-cta">
          {go ? (
            <Link to="/write" className="btn btn-primary landing-btn">
              افتح تريندا
            </Link>
          ) : (
            <button type="button" className="btn btn-primary landing-btn" onClick={connectX}>
              ابدأ مجاناً بحساب X
            </button>
          )}
        </div>
        <a href="#more" className="landing-scroll" aria-label="المزيد">
          <span />
        </a>
      </main>

      <section id="more" className="landing-rest">
        <p className="landing-rest-kicker">ليش تريندا؟</p>
        <h2>مصنوع للسوق السعودي على X</h2>
        <ul className="landing-points">
          <li>
            <strong>تغييره سعودي</strong>
            <span>مو ترجمة — نسخة مختلفة جاهزة للنشر</span>
          </li>
          <li>
            <strong>استيراد ثريد</strong>
            <span>من رابط X مع الصور، ثم أعد صياغته</span>
          </li>
          <li>
            <strong>جدولة هادئة</strong>
            <span>9ص · 12م · 4م · 8م — أقرب وقت فاضي</span>
          </li>
        </ul>
      </section>
    </div>
  )
}
