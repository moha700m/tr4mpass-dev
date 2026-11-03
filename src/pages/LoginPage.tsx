import { useSearchParams, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import './LoginPage.css'

export function LoginPage() {
  const { connectX, session } = useApp()
  const [params] = useSearchParams()
  const error = params.get('error')

  return (
    <div className="login-page">
      <div className="login-card surface rise">
        <p className="login-brand">هدوء</p>
        <h1>ادخل بهدوء</h1>
        <p className="muted">ربط رسمي بحساب X فقط.</p>

        {error && (
          <p className="banner warn">
            {error === 'access_denied' ? 'رفضت الصلاحيات على X.' : error}
          </p>
        )}

        {session?.isAuthenticated ? (
          <Link to="/write" className="btn btn-primary">
            افتح الكتابة
          </Link>
        ) : (
          <button type="button" className="btn btn-primary" onClick={connectX}>
            المتابعة مع X
          </button>
        )}

        <Link to="/" className="muted back">
          العودة
        </Link>
      </div>
    </div>
  )
}
