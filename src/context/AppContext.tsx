import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { MOCK_ANALYTICS, MOCK_POSTS } from '../data/mock'
import { PLANS } from '../data/plans'
import { api, startXLogin, type SessionResponse } from '../lib/api'
import type {
  AnalyticsPost,
  PlanId,
  ScheduledPost,
  ThemeMode,
  TweetPart,
} from '../types'

interface AppContextValue {
  theme: ThemeMode
  resolvedTheme: 'light' | 'dark'
  setTheme: (mode: ThemeMode) => void
  session: SessionResponse | null
  loadingSession: boolean
  refreshSession: () => Promise<void>
  connectX: () => void
  logout: () => Promise<void>
  disconnectAccount: (id: string) => Promise<void>
  setActiveAccount: (id: string) => Promise<void>
  posts: ScheduledPost[]
  setPosts: React.Dispatch<React.SetStateAction<ScheduledPost[]>>
  analytics: AnalyticsPost[]
  planId: PlanId
  plan: (typeof PLANS)[PlanId]
  publishNow: (parts: TweetPart[], accountId?: string) => Promise<{ url: string | null }>
}

const AppContext = createContext<AppContextValue | null>(null)

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('hudu-theme') as ThemeMode) || 'system'
  })
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark')
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [posts, setPosts] = useState<ScheduledPost[]>(MOCK_POSTS)
  const [analytics] = useState<AnalyticsPost[]>(MOCK_ANALYTICS)

  const applyTheme = useCallback((mode: ThemeMode) => {
    const resolved = mode === 'system' ? getSystemTheme() : mode
    setResolvedTheme(resolved)
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.style.colorScheme = resolved
  }, [])

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode)
    localStorage.setItem('hudu-theme', mode)
    applyTheme(mode)
  }

  const refreshSession = useCallback(async () => {
    try {
      const me = await api.me()
      setSession(me)
    } catch {
      setSession({
        isAuthenticated: false,
        plan: 'free',
        aiAttemptsUsed: 0,
        activeAccountId: null,
        accounts: [],
        xConfigured: false,
      })
    } finally {
      setLoadingSession(false)
    }
  }, [])

  useEffect(() => {
    applyTheme(theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (theme === 'system') applyTheme('system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme, applyTheme])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  const planId = session?.plan || 'free'

  const value: AppContextValue = {
    theme,
    resolvedTheme,
    setTheme,
    session,
    loadingSession,
    refreshSession,
    connectX: startXLogin,
    logout: async () => {
      await api.logout()
      await refreshSession()
    },
    disconnectAccount: async (id) => {
      await api.disconnect(id)
      await refreshSession()
    },
    setActiveAccount: async (id) => {
      const next = await api.setActive(id)
      setSession(next)
    },
    posts,
    setPosts,
    analytics,
    planId,
    plan: PLANS[planId],
    publishNow: async (parts, accountId) => {
      const result = await api.publish(
        parts.map((p) => p.text),
        accountId,
      )
      return { url: result.url }
    },
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
