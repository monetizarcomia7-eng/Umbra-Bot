'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAnalytics } from '@/hooks/use-analytics'

export interface AlertRow {
  id: string
  title: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  created_at: string
}

export interface UserInfo {
  id: string
  name: string
  email: string
  initials: string
  plan: 'free' | 'pro' | 'enterprise'
}

interface DashboardContextValue {
  user: UserInfo
  userLoaded: boolean
  alerts: AlertRow[]
  alertCount: number
  botsCount: number | null
  markAllAlertsRead: () => Promise<void>
  refreshBotsCount: () => Promise<void>
  logout: () => Promise<void>
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo>({ id: '', name: '', email: '', initials: '', plan: 'free' })
  const [userLoaded, setUserLoaded] = useState(false)
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [botsCount, setBotsCount] = useState<number | null>(null)
  const { identify, reset } = useAnalytics()
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return

      const name =
        (data.user.user_metadata?.full_name as string | undefined) ||
        data.user.email?.split('@')[0] ||
        'Usuário'
      const uid = data.user.id

      const [profileRes, alertsRes, botsRes] = await Promise.all([
        supabase.from('profiles').select('plan').eq('id', uid).single(),
        supabase
          .from('alerts')
          .select('id, title, description, severity, created_at')
          .eq('resolved', false)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('bots').select('id', { count: 'exact', head: true }),
      ])

      setUser({
        id: uid,
        name,
        email: data.user.email ?? '',
        initials: getInitials(name),
        plan: (profileRes.data?.plan as UserInfo['plan']) ?? 'free',
      })
      setAlerts((alertsRes.data as AlertRow[]) ?? [])
      setBotsCount(botsRes.count ?? 0)
      setUserLoaded(true)

      identify(uid, { email: data.user.email, name })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const markAllAlertsRead = useCallback(async () => {
    if (alerts.length === 0) return
    const supabase = createClient()
    await supabase
      .from('alerts')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .in('id', alerts.map((a) => a.id))
    setAlerts([])
  }, [alerts])

  const refreshBotsCount = useCallback(async () => {
    const supabase = createClient()
    const { count } = await supabase.from('bots').select('id', { count: 'exact', head: true })
    setBotsCount(count ?? 0)
  }, [])

  const logout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    reset()
    router.push('/login')
    router.refresh()
  }, [reset, router])

  return (
    <DashboardContext.Provider
      value={{
        user,
        userLoaded,
        alerts,
        alertCount: alerts.length,
        botsCount,
        markAllAlertsRead,
        refreshBotsCount,
        logout,
      }}
    >
      {children}
    </DashboardContext.Provider>
  )
}
