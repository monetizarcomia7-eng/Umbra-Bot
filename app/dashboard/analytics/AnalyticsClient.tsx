'use client'

import React, { useTransition, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { exportCSV } from '@/lib/csv'
import { cn } from '@/lib/utils'
import { AlertTriangle, Download, RefreshCw } from 'lucide-react'
import { useAnalytics } from '@/hooks/use-analytics'
import { getExportRows } from './_actions'
import type { AnalyticsSummary, Filters } from './_types'
import { fmtBRL, fmtNum } from './_utils'
import { FilterBar } from './_components/FilterBar'
import { FunnelChart } from './_components/FunnelChart'
import { BarListCard } from './_components/BarListCard'
import { StatusCard } from './_components/StatusCard'
import { CohortTable } from './_components/CohortTable'

function LimitBanner({ show, limit }: { show: boolean; limit: number }) {
  if (!show) return null
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-warning-soft border border-warning/30 rounded-xl text-[12.5px] text-warning mb-4">
      <AlertTriangle size={14} className="shrink-0" />
      <span>
        Exibindo os <strong>{limit.toLocaleString('pt-BR')}</strong> registros mais recentes.
        Dados históricos mais antigos podem não aparecer nos gráficos de coorte.
      </span>
    </div>
  )
}

function Btn({
  variant = 'primary', loading, icon: Icon, children, onClick,
}: {
  variant?: 'primary' | 'secondary'
  loading?: boolean
  icon?: React.ElementType
  children?: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        variant === 'primary'
          ? 'bg-primary text-primary-fg hover:opacity-90'
          : 'border border-border bg-surface text-text hover:bg-surface-2',
      )}
    >
      {loading ? (
        <svg viewBox="0 0 24 24" width="13" height="13" className="spin shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : Icon ? <Icon size={14} className="shrink-0" /> : null}
      {children}
    </button>
  )
}

export function AnalyticsClient({ summary }: { summary: AnalyticsSummary }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [exporting, setExporting] = useState(false)

  const { filters } = summary
  const { track } = useAnalytics()

  function handleFilterChange(patch: Partial<Filters>) {
    const next = { ...filters, ...patch }
    const params = new URLSearchParams()
    if (next.period !== '30d')   params.set('period',      next.period)
    if (next.botId !== 'all')    params.set('botId',       next.botId)
    if (next.productName !== 'all') params.set('productName', next.productName)
    if (next.flowId !== 'all')   params.set('flowId',      next.flowId)
    if (next.utmSource !== 'all') params.set('utmSource',  next.utmSource)
    if (next.compare)            params.set('compare',     '1')
    track('analytics_filter_changed', {
      period:           next.period,
      compare:          next.compare,
      bot_filtered:     next.botId !== 'all',
      product_filtered: next.productName !== 'all',
      flow_filtered:    next.flowId !== 'all',
      utm_filtered:     next.utmSource !== 'all',
    })
    startTransition(() => {
      router.replace(
        `/dashboard/analytics${params.size > 0 ? `?${params.toString()}` : ''}`,
        { scroll: false },
      )
    })
  }

  function handleClear() {
    track('analytics_filter_changed', {
      period: '30d', compare: false,
      bot_filtered: false, product_filtered: false,
      flow_filtered: false, utm_filtered: false,
    })
    startTransition(() => router.replace('/dashboard/analytics', { scroll: false }))
  }

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const rows = await getExportRows(filters)
      track('csv_exported', { section: 'analytics', rows: rows.length, period: filters.period })
      exportCSV(
        `analytics-${filters.period}-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Data', 'Produto', 'Valor bruto (R$)', 'Taxa (R$)', 'Valor líquido (R$)', 'Bot', 'Fluxo', 'Origem (UTM)', 'Campanha (UTM)'],
        rows.map((r) => [
          r.date, r.product, r.amount, r.fee, r.net,
          r.bot, r.flow, r.utmSource, r.utmCampaign,
        ]),
      )
    } finally {
      setExporting(false)
    }
  }, [filters, track])

  const flowHasRealData = summary.byFlow.some((f) => f.isReal)

  return (
    <>
    <PageHeader
        title="Análises"
        subtitle="Funis, retenção e desempenho dos seus bots — dados reais."
        actions={
          <>
            <Btn variant="secondary" icon={RefreshCw} onClick={() => router.refresh()}>
              Atualizar
            </Btn>
            <Btn
              variant="primary"
              icon={exporting ? undefined : Download}
              loading={exporting}
              onClick={handleExport}
            >
              {exporting ? 'Exportando…' : 'Exportar CSV'}
            </Btn>
          </>
        }
      />

      {summary.error && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-danger-soft border border-danger/30 rounded-xl text-[13px] text-danger mb-5">
          <AlertTriangle size={15} className="shrink-0" />
          <span>Erro ao carregar dados: {summary.error}. Tente atualizar a página.</span>
        </div>
      )}

      <LimitBanner show={summary.limitReached} limit={summary.queryLimit} />

      <FilterBar
        filters={filters}
        isPending={isPending}
        botOptions={summary.botOptions}
        productOptions={summary.productOptions}
        flowOptions={summary.flowOptions}
        utmOptions={summary.utmOptions}
        onFilterChange={handleFilterChange}
        onClear={handleClear}
      />

      <div className="space-y-5">
        <FunnelChart stages={summary.funnel} compare={filters.compare} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <BarListCard
            title="Desempenho por bot"
            subtitle="Receita aprovada no período"
            items={summary.byBot}
            getLabel={(b) => b.name}
            getValue={(b) => b.revenue}
            getSecondary={(b) => `${fmtNum(b.sales)} vendas · ticket médio ${fmtBRL(b.ticket)}`}
            format={fmtBRL}
          />
          <BarListCard
            title="Por produto"
            subtitle="Receita aprovada no período"
            items={summary.byProduct}
            getLabel={(p) => p.name}
            getValue={(p) => p.revenue}
            getSecondary={(p) => `${fmtNum(p.units)} unidades · ticket ${fmtBRL(p.ticket)}`}
            format={fmtBRL}
          />
          {flowHasRealData ? (
            <BarListCard
              title="Por fluxo de venda"
              subtitle="Receita por fluxo no período"
              items={summary.byFlow}
              getLabel={(f) => f.name}
              getValue={(f) => f.revenue}
              getSecondary={(f) => `${fmtNum(f.sales)} vendas · ticket ${fmtBRL(f.ticket)}`}
              format={fmtBRL}
            />
          ) : (
            <BarListCard
              title="Por fluxo de venda"
              subtitle="Execuções totais (dados estimados)"
              items={summary.byFlow}
              getLabel={(f) => f.name}
              getValue={(f) => f.sales}
              getSecondary={(f) => `${fmtNum(f.sales)} execuções`}
              format={fmtNum}
            />
          )}
        </div>

        <BarListCard
          title="Vendas por origem (UTM)"
          subtitle="Receita aprovada por canal de origem no período"
          items={summary.byUtm}
          getLabel={(u) => u.source}
          getValue={(u) => u.revenue}
          getSecondary={(u) => `${fmtNum(u.sales)} vendas · ticket médio ${fmtBRL(u.ticket)}`}
          format={fmtBRL}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StatusCard data={summary.statusBreakdown} />
          <CohortTable rows={summary.cohortRows} />
        </div>
      </div>
    </>
  )
}
