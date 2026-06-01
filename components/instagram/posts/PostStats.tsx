'use client'

import { Users, Clock, CheckCircle2, XCircle } from 'lucide-react'
import type { IgStats } from '@/app/dashboard/instagram/page'

interface Props { stats: IgStats }

export default function PostStats({ stats }: Props) {
  const items = [
    { label: 'Contas ativas',     value: stats.accounts_count,  Icon: Users,        color: 'var(--primary)' },
    { label: 'Agendados',         value: stats.scheduled_count, Icon: Clock,        color: 'var(--warning)' },
    { label: 'Publicados (30d)',  value: stats.published_30d,   Icon: CheckCircle2, color: 'var(--success)' },
    { label: 'Falhas (30d)',      value: stats.failed_30d,      Icon: XCircle,      color: 'var(--danger)' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map(({ label, value, Icon, color }) => (
        <div key={label} className="rounded-xl p-4 flex items-start gap-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="rounded-lg p-2"
            style={{ background: `color-mix(in oklab, ${color} 12%, transparent)`, color }}>
            <Icon size={16} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-medium"
              style={{ color: 'var(--text-muted)' }}>
              {label}
            </p>
            <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--text)' }}>
              {value}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
