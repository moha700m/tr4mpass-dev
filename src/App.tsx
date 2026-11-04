import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AppShell } from './components/layout/AppShell'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { WritePage } from './pages/WritePage'
import { CalendarPage } from './pages/CalendarPage'
import { ImportPage } from './pages/ImportPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { MorePage } from './pages/MorePage'
import { PlansPage } from './pages/PlansPage'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppShell />}>
            <Route path="/write" element={<WritePage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/more" element={<MorePage />} />
            <Route path="/plans" element={<PlansPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
