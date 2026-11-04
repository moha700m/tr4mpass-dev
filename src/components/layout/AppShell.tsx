import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { TopBar } from './TopBar'

export function AppShell() {
  return (
    <div className="app-shell">
      <TopBar />
      <BottomNav />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
