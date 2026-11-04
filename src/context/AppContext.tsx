import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
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
  refreshPosts: () => Promise<void>
  analytics: AnalyticsPost[]
  analyticsTotals: {
    views: number
    likes: number
    replies: number
    reposts: number
    bookmarks: number
  }
  refreshAnalytics: (range?: string, sort?: string) => Promise<void>
  planId: PlanId
  plan: (typeof PLANS)[PlanId]
  publishNow: (parts: TweetPart[], accountId?: string) => Promise<{ url: string | null }>
  schedulePost: (
    parts: TweetPart[],
    scheduledAt: string,
    accountId?: string,
  ) => Promise<ScheduledPost>
}

const AppContext = createContext<AppContextValue | null>(null)

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('trenda-theme') as ThemeMode) || 'system'
  })
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark')
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsPost[]>([])
  const [analyticsTotals, setAnalyticsTotals] = useState({
    views: 0,
    likes: 0,
    replies: 0,
    reposts: 0,
    bookmarks: 0,
  })

  const applyTheme = useCallback((mode: ThemeMode) => {
    const resolved = mode === 'system' ? getSystemTheme() : mode
    setResolvedTheme(resolved)
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.style.colorScheme = resolved
  }, [])

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode)
    localStorage.setItem('trenda-theme', mode)
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
        bulkImportsUsed: 0,
        activeAccountId: null,
        accounts: [],
        xConfigured: false,
      })
    } finally {
      setLoadingSession(false)
    }
  }, [])

  const refreshPosts = useCallback(async () => {
    try {
      const data = await api.listPosts()
      setPosts(data.posts)
    } catch {
      // not authenticated yet
    }
  }, [])

  const refreshAnalytics = useCallback(async (range = '30d', sort = 'views') => {
    try {
      const data = await api.analytics(range, sort)
      setAnalytics(data.posts)
      setAnalyticsTotals(data.totals)
    } catch {
      setAnalytics([])
      setAnalyticsTotals({ views: 0, likes: 0, replies: 0, reposts: 0, bookmarks: 0 })
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

  useEffect(() => {
    if (session?.isAuthenticated) {
      void refreshPosts()
      void refreshAnalytics()
    }
  }, [session?.isAuthenticated, refreshPosts, refreshAnalytics])

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
      setPosts([])
      setAnalytics([])
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
    refreshPosts,
    analytics,
    analyticsTotals,
    refreshAnalytics,
    planId,
    plan: PLANS[planId],
    publishNow: async (parts, accountId) => {
      const result = await api.publish(parts, accountId)
      await refreshPosts()
      return { url: result.url }
    },
    schedulePost: async (parts, scheduledAt, accountId) => {
      const { post } = await api.schedule(parts, scheduledAt, accountId)
      await refreshPosts()
      return post
    },
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
