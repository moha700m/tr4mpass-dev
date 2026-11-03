import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import './LandingPage.css'

export function LandingPage() {
  const { session, connectX } = useApp()

  return (
    <div className="landing">
      <div className="landing-bg" aria-hidden />
      <header className="landing-nav">
        <span className="landing-brand">هدوء</span>
        <Link to="/plans" className="muted">
          الخطط
        </Link>
      </header>

      <main className="landing-hero">
        <p className="eyebrow">من محمد · @justmgz</p>
        <h1 className="hero-brand">هدوء</h1>
        <p className="hero-line">اكتب وانشر ثريداتك على X… بدون تعقيد وبدون ما تضيع.</p>
        <div className="hero-cta">
          {session?.isAuthenticated ? (
            <Link to="/write" className="btn btn-primary">
              افتح صندوق الكتابة
            </Link>
          ) : (
            <button type="button" className="btn btn-primary" onClick={connectX}>
              ادخل بحساب X
            </button>
          )}
          <Link to="/write" className="btn btn-ghost">
            جرّب الواجهة
          </Link>
        </div>
      </main>

      <section className="landing-rest">
        <h2>كل شيء في مكان واحد</h2>
        <p className="muted">اكتب · جدوِل · استورد · تابع الأرقام — بهدوء.</p>
        <div className="feature-lines">
          <p>ثريد كامل من فكرة واحدة</p>
          <p>معاينة تشبه X قبل ما تنشر</p>
          <p>تقويم أسبوعي بالسحب والإفلات</p>
        </div>
      </section>
    </div>
  )
}
