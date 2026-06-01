'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LayoutGrid, List, Calendar as CalendarIcon, Plus } from 'lucide-react'
import Link from 'next/link'
import PostFilters from './PostFilters'
import PostStats from './PostStats'
import PostsTable from './PostsTable'
import PostCards from './PostCards'
import PostsCalendar from './PostsCalendar'
import Toast from '../shared/Toast'
import type { RawIgPost, RawIgAccount, IgStats } from '@/app/dashboard/instagram/page'

interface Props {
  initialPosts: RawIgPost[]
  accounts:     RawIgAccount[]
  stats:        IgStats
  userId:       string
}

type ViewMode = 'cards' | 'table' | 'calendar'
type StatusFilter = 'all' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled'

const VIEW_OPTIONS: Array<{ key: ViewMode; label: string; Icon: React.ElementType }> = [
  { key: 'cards',    label: 'Cards',     Icon: LayoutGrid },
  { key: 'table',    label: 'Tabela',    Icon: List },
  { key: 'calendar', label: 'Calendário', Icon: CalendarIcon },
]

export default function PostsClient({ initialPosts, accounts, stats, userId }: Props) {
  const [posts,        setPosts]        = useState(initialPosts)
  const [view,         setView]         = useState<ViewMode>('cards')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [search,       setSearch]       = useState('')
  const [toast,        setToast]        = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4_000)
  }, [])

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('instagram-posts-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'instagram_posts', filter: `user_id=eq.${userId}` },
        payload => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as RawIgPost
            setPosts(arr => arr.some(p => p.id === row.id) ? arr : [row, ...arr])
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as RawIgPost
            setPosts(arr => arr.map(p => p.id === row.id ? row : p))
          } else if (payload.eventType === 'DELETE') {
            const del = payload.old as { id: string }
            setPosts(arr => arr.filter(p => p.id !== del.id))
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId])

  const filtered = useMemo(() => {
    return posts.filter(p => {
      if (statusFilter !== 'all'  && p.status !== statusFilter)       return false
      if (accountFilter !== 'all' && p.account_id !== accountFilter)  return false
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        if (!p.caption.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [posts, statusFilter, accountFilter, search])

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">
        <PostStats stats={stats} />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg p-0.5"
            style={{ background: 'var(--surface-2)' }}>
            {VIEW_OPTIONS.map(({ key, label, Icon }) => {
              const active = view === key
              return (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  style={{
                    background: active ? 'var(--surface)' : 'transparent',
                    color:      active ? 'var(--primary)' : 'var(--text-muted)',
                    boxShadow:  active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  <Icon size={13} />
                  {label}
                </button>
              )
            })}
          </div>

          <Link
            href="/dashboard/instagram/schedule"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}
          >
            <Plus size={14} />
            Novo post
          </Link>
        </div>

        <PostFilters
          posts={posts}
          accounts={accounts}
          statusFilter={statusFilter}
          accountFilter={accountFilter}
          search={search}
          onStatusChange={setStatusFilter}
          onAccountChange={setAccountFilter}
          onSearchChange={setSearch}
        />

        {filtered.length === 0 ? (
          <div className="rounded-xl p-8 text-center"
            style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {posts.length === 0 ? 'Nenhum post agendado ainda' : 'Nenhum post encontrado nesses filtros'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {posts.length === 0
                ? 'Crie seu primeiro post na aba "Agendar".'
                : 'Tente ajustar os filtros acima.'}
            </p>
          </div>
        ) : (
          <>
            {view === 'cards'    && <PostCards posts={filtered} accounts={accounts} onToast={showToast} />}
            {view === 'table'    && <PostsTable posts={filtered} accounts={accounts} onToast={showToast} />}
            {view === 'calendar' && <PostsCalendar posts={filtered} accounts={accounts} />}
          </>
        )}
      </div>
    </>
  )
}
