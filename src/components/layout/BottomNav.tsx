import { NavLink } from 'react-router-dom'
import { BarChart3, CalendarDays, MoreHorizontal, PenLine, Upload } from 'lucide-react'
import './BottomNav.css'

const items = [
  { to: '/write', label: 'اكتب', icon: PenLine },
  { to: '/calendar', label: 'التقويم', icon: CalendarDays },
  { to: '/import', label: 'استيراد', icon: Upload },
  { to: '/analytics', label: 'أرقام', icon: BarChart3 },
  { to: '/more', label: 'المزيد', icon: MoreHorizontal },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="التنقل الرئيسي">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Icon size={20} strokeWidth={1.8} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
