'use client'

import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Filters, BotOption, FlowOption, Period } from '../_types'
import { PERIOD_LABELS } from '../_utils'

const PERIOD_OPTS = (Object.keys(PERIOD_LABELS) as Period[]).map((v) => ({
  value: v,
  label: PERIOD_LABELS[v],
}))

function Select({
  label, value, options, onChange, width,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  width?: number
}) {
  return (
    <div className="relative h-9" style={{ width: width ?? 180 }}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full w-full appearance-none bg-surface border border-border rounded-lg text-[12.5px] text-text pl-3 pr-7 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
        <ChevronDown size={12} />
      </span>
    </div>
  )
}

interface FilterBarProps {
  filters: Filters
  isPending: boolean
  botOptions: BotOption[]
  productOptions: string[]
  flowOptions: FlowOption[]
  utmOptions: string[]
  onFilterChange: (patch: Partial<Filters>) => void
  onClear: () => void
}

export function FilterBar({
  filters, isPending, botOptions, productOptions, flowOptions, utmOptions,
  onFilterChange, onClear,
}: FilterBarProps) {
  const isDefault =
    filters.period      === '30d' &&
    filters.botId       === 'all' &&
    filters.productName === 'all' &&
    filters.flowId      === 'all' &&
    filters.utmSource   === 'all' &&
    !filters.compare

  const botOpts = [
    { value: 'all', label: 'Todos os bots' },
    ...botOptions.map((b) => ({ value: b.id, label: b.username ? `@${b.username}` : b.name })),
  ]
  const productOpts = [
    { value: 'all', label: 'Todos os produtos' },
    ...productOptions.map((n) => ({ value: n, label: n })),
  ]
  const flowOpts = [
    { value: 'all', label: 'Todos os fluxos' },
    ...flowOptions.map((f) => ({ value: f.id, label: f.name })),
  ]
  const utmOpts = [
    { value: 'all', label: 'Todas as origens' },
    ...utmOptions.map((s) => ({ value: s, label: s })),
  ]

  return (
    <div
      className={cn(
        'bg-surface border border-border rounded-xl p-2.5 flex flex-wrap items-center gap-2 mb-5 transition-opacity',
        isPending && 'opacity-60 pointer-events-none',
      )}
    >
      <Select
        label="Período"
        value={filters.period}
        options={PERIOD_OPTS}
        onChange={(v) => onFilterChange({ period: v as Period })}
        width={155}
      />
      <Select
        label="Bot"
        value={filters.botId}
        options={botOpts}
        onChange={(v) => onFilterChange({ botId: v })}
        width={190}
      />
      <Select
        label="Produto"
        value={filters.productName}
        options={productOpts}
        onChange={(v) => onFilterChange({ productName: v })}
        width={200}
      />
      <Select
        label="Fluxo"
        value={filters.flowId}
        options={flowOpts}
        onChange={(v) => onFilterChange({ flowId: v })}
        width={190}
      />
      <Select
        label="Origem"
        value={filters.utmSource}
        options={utmOpts}
        onChange={(v) => onFilterChange({ utmSource: v })}
        width={175}
      />

      {!isDefault && (
        <button
          onClick={onClear}
          className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2"
        >
          <X size={13} />
          Limpar
        </button>
      )}

      <div className="flex-1" />

      <label className="flex items-center gap-2 cursor-pointer select-none h-9 px-2 border-l border-border ml-1 pl-3">
        <div className="relative w-8 h-[18px] shrink-0">
          <input
            type="checkbox"
            checked={filters.compare}
            onChange={(e) => onFilterChange({ compare: e.target.checked })}
            className="sr-only"
          />
          <div className={cn(
            'absolute inset-0 rounded-full transition-colors',
            filters.compare ? 'bg-primary' : 'bg-surface-3 border border-border',
          )} />
          <div className={cn(
            'absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform',
            filters.compare ? 'translate-x-[18px]' : 'translate-x-[2px]',
          )} />
        </div>
        <span className="text-[12.5px] text-text-muted whitespace-nowrap">Comparar período anterior</span>
      </label>
    </div>
  )
}
