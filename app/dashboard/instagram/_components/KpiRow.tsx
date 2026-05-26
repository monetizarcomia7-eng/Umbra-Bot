import { Users, Calendar, CheckCircle2, AlertCircle } from 'lucide-react'
import type { IgStats } from '../page'

export default function KpiRow({ stats }: { stats: IgStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card label="Contas ativas"        value={stats.accounts_count}  Icon={Users}        color="var(--primary)" />
      <Card label="Posts agendados"      value={stats.scheduled_count} Icon={Calendar}     color="var(--info)" />
      <Card label="Publicados (30 dias)" value={stats.published_30d}   Icon={CheckCircle2} color="var(--success)" />
      <Card label="Falhas (30 dias)"     value={stats.failed_30d}      Icon={AlertCircle}
        color={stats.failed_30d > 0 ? 'var(--danger)' : 'var(--text-muted)'} />
    </div>
  )
}

function Card({
  label, value, Icon, color,
}: {
  label: string; value: number; Icon: React.ElementType; color: string
}) {
  return (
    <div className="rounded-xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} style={{ color }} />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
      <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
        {value.toLocaleString('pt-BR')}
      </p>
    </div>
  )
}
