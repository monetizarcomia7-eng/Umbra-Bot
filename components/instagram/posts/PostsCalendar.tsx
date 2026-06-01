'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Video, Layers } from 'lucide-react'
import type { RawIgPost, RawIgAccount } from '@/app/dashboard/instagram/page'

interface Props {
  posts:    RawIgPost[]
  accounts: RawIgAccount[]
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const TYPE_ICONS = { IMAGE: ImageIcon, REELS: Video, CAROUSEL: Layers } as const
const STATUS_COLORS: Record<string, string> = {
  scheduled:  'var(--warning)',
  publishing: 'var(--info)',
  published:  'var(--success)',
  failed:     'var(--danger)',
  cancelled:  'var(--text-muted)',
  draft:      'var(--text-muted)',
}

export default function PostsCalendar({ posts, accounts }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])

  const calendarDays = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    // Pad com dias do mês anterior para alinhar com domingo (Dom = 0)
    const days: Array<{ date: Date; inMonth: boolean }> = []
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), inMonth: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: new Date(year, month, d), inMonth: true })
    }
    // Completa 6 semanas (42 células) para grid consistente
    while (days.length < 42) {
      const last = days[days.length - 1].date
      days.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false })
    }
    return days
  }, [cursor])

  // Mapeia posts por chave YYYY-MM-DD
  const postsByDay = useMemo(() => {
    const map = new Map<string, RawIgPost[]>()
    for (const p of posts) {
      const d = new Date(p.scheduled_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const arr = map.get(key) ?? []
      arr.push(p)
      map.set(key, arr)
    }
    return map
  }, [posts])

  const todayKey = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const monthLabel = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  function prevMonth() {
    setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))
  }
  function nextMonth() {
    setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))
  }
  function goToday() {
    const d = new Date()
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
  }

  return (
    <div className="rounded-xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold capitalize" style={{ color: 'var(--text)' }}>
          {monthLabel}
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={goToday}
            className="px-2.5 py-1 rounded-md text-xs font-medium"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
          >
            Hoje
          </button>
          <button onClick={prevMonth}
            className="p-1 rounded-md"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
            aria-label="Mês anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <button onClick={nextMonth}
            className="p-1 rounded-md"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
            aria-label="Próximo mês"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
        {WEEKDAYS.map(d => (
          <div key={d} className="px-2 py-2 text-[10px] uppercase tracking-wider font-semibold text-center"
            style={{ color: 'var(--text-muted)' }}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {calendarDays.map(({ date, inMonth }, i) => {
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          const dayPosts = postsByDay.get(key) ?? []
          const isToday = key === todayKey
          return (
            <div
              key={i}
              className="min-h-[90px] p-1.5 border-t border-r"
              style={{
                borderColor: 'var(--border)',
                background:  inMonth ? 'transparent' : 'color-mix(in oklab, var(--surface-2) 50%, transparent)',
                opacity:     inMonth ? 1 : 0.45,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-[10px] font-semibold inline-flex items-center justify-center"
                  style={{
                    width:      isToday ? 18 : undefined,
                    height:     isToday ? 18 : undefined,
                    borderRadius: isToday ? '50%' : undefined,
                    background: isToday ? 'var(--primary)' : 'transparent',
                    color:      isToday ? 'var(--accent-fg)' : 'var(--text-muted)',
                  }}
                >
                  {date.getDate()}
                </span>
                {dayPosts.length > 0 && (
                  <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    {dayPosts.length}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {dayPosts.slice(0, 3).map(p => {
                  const TypeIcon = TYPE_ICONS[p.media_type] ?? ImageIcon
                  const username = accountMap.get(p.account_id)?.username ?? '—'
                  const color = STATUS_COLORS[p.status] ?? 'var(--text-muted)'
                  return (
                    <div
                      key={p.id}
                      title={`@${username} — ${p.caption || '(sem legenda)'}`}
                      className="rounded text-[9px] px-1.5 py-1 flex items-center gap-1 truncate"
                      style={{
                        background: `color-mix(in oklab, ${color} 14%, transparent)`,
                        color,
                      }}
                    >
                      <TypeIcon size={9} />
                      <span className="truncate" style={{ color: 'var(--text)' }}>
                        {new Date(p.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {' '}@{username}
                      </span>
                    </div>
                  )
                })}
                {dayPosts.length > 3 && (
                  <p className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    +{dayPosts.length - 3} mais
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
