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
        <div className="brand-mark lg" />
        <h1>دخول هدوء</h1>
        <p className="muted">اربط حساب X الرسمي فقط. ما نطلب كلمة المرور أبداً.</p>

        {error && (
          <p className="banner warn">
            {error === 'access_denied' ? 'رفضت الصلاحيات على X.' : error}
          </p>
        )}

        {session?.isAuthenticated ? (
          <Link to="/write" className="btn btn-primary">
            أنت داخل · اذهب للكتابة
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
