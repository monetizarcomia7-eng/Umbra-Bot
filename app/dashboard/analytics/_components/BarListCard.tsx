import { TrendingUp } from 'lucide-react'

function Card({ title, subtitle, children }: {
  title: string; subtitle: string; children: React.ReactNode
}) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4">
        <div className="text-[14px] font-semibold text-text">{title}</div>
        <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <TrendingUp size={28} className="text-text-subtle mb-2" />
      <p className="text-[13px] text-text-muted">{message}</p>
    </div>
  )
}

interface BarListCardProps<T> {
  title: string
  subtitle: string
  items: T[]
  getLabel: (item: T) => string
  getValue: (item: T) => number
  getSecondary: (item: T) => string
  format: (v: number) => string
}

export function BarListCard<T>({
  title, subtitle, items, getLabel, getValue, getSecondary, format,
}: BarListCardProps<T>) {
  if (items.length === 0) {
    return (
      <Card title={title} subtitle={subtitle}>
        <EmptyState message="Nenhum dado no período." />
      </Card>
    )
  }

  const max = Math.max(...items.map(getValue)) || 1

  return (
    <Card title={title} subtitle={subtitle}>
      <div className="space-y-3.5 mt-2">
        {items.map((it, i) => {
          const v = getValue(it)
          return (
            <div key={i}>
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <span className="text-[12.5px] font-medium text-text truncate">{getLabel(it)}</span>
                <span className="text-[12.5px] tnum font-semibold text-text shrink-0">{format(v)}</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(v / max) * 100}%` }}
                />
              </div>
              <div className="mt-1 text-[10.5px] text-text-muted tnum">{getSecondary(it)}</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
