import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import './TopBar.css'

export function TopBar() {
  const { session, connectX } = useApp()
  const account = session?.accounts.find((a) => a.id === session.activeAccountId)

  return (
    <header className="top-bar">
      <Link to="/" className="brand">
        <span className="brand-mark" aria-hidden />
        <span className="brand-name">هدوء</span>
      </Link>

      {account ? (
        <Link to="/more" className="account-pill" title="إدارة الحسابات">
          <img src={account.avatarUrl} alt="" />
          <span className="account-meta">
            <strong>{account.name}</strong>
            <small>@{account.handle}</small>
          </span>
          <ChevronDown size={14} className="account-chevron" aria-hidden />
        </Link>
      ) : (
        <button type="button" className="btn btn-soft top-connect" onClick={connectX}>
          اربط X
        </button>
      )}
    </header>
  )
}
