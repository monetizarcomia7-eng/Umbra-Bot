'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { exportCSV } from '@/lib/csv'
import { useAnalytics } from '@/hooks/use-analytics'
import { createClient } from '@/lib/supabase/client'
import type {
  RawTransaction, RawWithdrawal, RawFinanceBot, RawFinanceFlow, RawInvoice,
  RawFinanceSummary, Transaction, Withdrawal, Invoice, TxDetail, FinanceSummary,
} from './types'

import { txTypeMap, txStatusMap, wdStatusMap, invStatusMap, GATEWAY_LABEL } from './constants'
import { SummaryCard, Tabs, Btn, Spinner, Icon } from './atoms'
import { TransactionsSection } from './TransactionsSection'
import { WithdrawalsSection } from './WithdrawalsSection'
import { InvoicesSection } from './InvoicesSection'
import { WithdrawModal } from './WithdrawModal'
import { fmtBRLdec, fmtPct } from './formatters'
import { cn } from '@/lib/utils'

type Period = '7d' | '30d' | '90d' | 'all'

const LOAD_MORE_LIMIT = 500

const tabsDef = [
  { id: 'tx',        label: 'Transações', icon: 'arrow-left-right'   },
  { id: 'withdraws', label: 'Saques',     icon: 'arrow-up-from-line' },
  { id: 'invoices',  label: 'Faturas',    icon: 'file-text'          },
]

const netOf = (r: RawTransaction) =>
  Number(r.net ?? (Number(r.amount) - Number(r.fee ?? 0)))

const METHOD_LABEL: Record<string, string> = {
  pix:    'Pix',
  card:   'Cartão',
  boleto: 'Boleto',
  ted:    'TED',
  other:  'Outro',
}

// ── SmallStatCard ────────────────────────────────────────────────────────────

function SmallStatCard({ label, value, icon, note }: {
  label: string; value: string; icon: string; note?: string
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-text-muted">
        <Icon name={icon} size={13} />
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-[22px] font-semibold tnum text-text leading-tight">{value}</div>
      {note && <div className="text-[11px] text-text-subtle">{note}</div>}
    </div>
  )
}

// ── RevenueChart ─────────────────────────────────────────────────────────────

function RevenueChart({
  data, collapsed, onToggle,
}: {
  data: { day: string; receita: number }[]
  collapsed: boolean
  onToggle: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const hasData = data.some((d) => d.receita > 0)

  return (
    <div className="bg-surface border border-border rounded-xl mb-5 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface-2/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 text-[13px] font-medium text-text">
          <Icon name="bar-chart-2" size={14} className="text-primary" />
          Receita por dia
        </div>
        {collapsed
          ? <ChevronDown size={15} className="text-text-muted" />
          : <ChevronUp   size={15} className="text-text-muted" />}
      </div>

      {!collapsed && (
        <div className="px-4 pb-4">
          {!mounted ? (
            <div className="h-[160px] animate-pulse bg-surface-2 rounded-lg" />
          ) : !hasData ? (
            <div className="h-[160px] flex items-center justify-center text-[13px] text-text-muted">
              Nenhuma receita aprovada no período selecionado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="receitaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v) => `R$${(v as number) >= 1000 ? `${((v as number) / 1000).toFixed(1)}k` : String(v)}`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--text)',
                  }}
                  formatter={(value: number) => [fmtBRLdec(value), 'Receita']}
                />
                <Area
                  type="monotone"
                  dataKey="receita"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#receitaGrad)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  )
}

// ── Memo A: mapeamento caro de rows brutos → tipados (sem dependência de period) ──

function mapRawRows(
  rows:           RawTransaction[],
  rawWithdrawals: RawWithdrawal[],
  bots:           RawFinanceBot[],
  flows:          RawFinanceFlow[],
  rawInvoices:    RawInvoice[],
): { txRows: Transaction[]; wdRows: Withdrawal[]; invoices: Invoice[] } {
  const botMap  = new Map(bots.map((b)  => [b.id, b.username ? `@${b.username}` : b.name]))
  const flowMap = new Map(flows.map((f) => [f.id, f.name]))

  const txRows: Transaction[] = rows.map((row) => {
    const dbType   = row.type as string | null
    const isRefund = dbType === 'refund' || row.status === 'refunded' || row.status === 'cancelled'
    const txType: Transaction['type'] =
      dbType === 'fee'          ? 'fee'
      : dbType === 'commission' ? 'commission'
      : isRefund                ? 'refund'
      :                           'sale'

    const gross = Number(row.amount)
    const fee   = Number(row.fee ?? 0)
    const net   = netOf(row)

    const paymentMethod = row.payment_method
      ? (METHOD_LABEL[row.payment_method] ?? row.payment_method)
      : 'Pix'

    const detail: TxDetail | undefined = (!isRefund && row.status === 'approved') ? {
      customer:    row.customer_name  || '—',
      email:       row.customer_email || '—',
      product:     row.product_name   || '—',
      gateway:     GATEWAY_LABEL[row.gateway ?? ''] ?? (row.gateway || '—'),
      method:      paymentMethod,
      gross,
      gatewayFee:  fee,
      platformFee: 0,
      net,
      bot:         row.bot_id  ? (botMap.get(row.bot_id)  ?? '—') : '—',
      flow:        row.flow_id ? (flowMap.get(row.flow_id) ?? '—') : '—',
      utmSource:   row.utm_source    ?? undefined,
      utmCampaign: row.utm_campaign  ?? undefined,
      phone:       row.customer_phone  ?? undefined,
      device:      row.customer_device ?? undefined,
      checkoutId:  row.checkout_id     ?? undefined,
    } : undefined

    const status: Transaction['status'] =
      row.status === 'approved'    ? 'available'
      : row.status === 'pending'   ? 'pending'
      : row.status === 'expired'   ? 'expired'
      : row.status === 'cancelled' ? 'cancelled'
      :                              'failed'  // refunded → failed

    return {
      id:         String(row.id),
      dt:         String(row.created_at),
      type:       txType,
      desc:       String(row.product_name || 'Venda'),
      value:      isRefund ? -Math.abs(gross) : net,
      status,
      detail,
      botId:      row.bot_id      ?? null,
      gatewayRaw: row.gateway     ?? null,
    }
  })

  const wdRows: Withdrawal[] = rawWithdrawals.map((w) => ({
    id:        w.id,
    date:      w.created_at,
    amount:    Number(w.amount),
    account:   w.account_label,
    status:    w.status,
    concluded: w.concluded_at ?? '',
    notes:     w.notes ?? null,
  }))

  const invoices: Invoice[] = rawInvoices.length > 0
    ? rawInvoices.map((inv) => ({
        id:     inv.id,
        period: inv.period,
        value:  Number(inv.value),
        due:    inv.due_date,
        status: inv.status,
      }))
    : []

  return { txRows, wdRows, invoices }
}

// ── Memo B: summary + deltas (apenas esta parte depende de period) ──

function buildPeriodSummary(
  rawRows:   RawTransaction[],
  rawWds:    RawWithdrawal[],
  period:    Period,
  dbSummary: RawFinanceSummary | null,
): FinanceSummary {
  let saldoDisponivel: number
  let aLiberar: number
  let totalRecebido: number
  let comissoesPlataforma: number

  if (dbSummary) {
    saldoDisponivel     = Number(dbSummary.saldo_disponivel)
    aLiberar            = Number(dbSummary.a_liberar)
    totalRecebido       = Number(dbSummary.total_recebido)
    comissoesPlataforma = Number(dbSummary.comissoes_plataforma)
  } else {
    const approved = rawRows.filter((r) => r.status === 'approved')
    const pending  = rawRows.filter((r) => r.status === 'pending')
    const totalApprovedNet = approved.reduce((s, r) => s + netOf(r), 0)
    const totalWithdrawn   = rawWds
      .filter((w) => w.status === 'pending' || w.status === 'completed')
      .reduce((s, w) => s + Number(w.amount), 0)
    saldoDisponivel     = Math.max(0, totalApprovedNet - totalWithdrawn)
    aLiberar            = pending.reduce((s, r) => s + netOf(r), 0)
    totalRecebido       = approved.reduce((s, r) => s + Number(r.amount), 0)
    comissoesPlataforma = approved.reduce((s, r) => s + Number(r.fee ?? 0), 0)
  }

  let deltas = { saldo: 0, liberar: 0, total: 0, comissoes: 0 }
  if (period !== 'all' && rawRows.length > 0) {
    const approved = rawRows.filter((r) => r.status === 'approved')
    const pending  = rawRows.filter((r) => r.status === 'pending')
    const days      = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const now       = Date.now()
    const curStart  = now - days * 86_400_000
    const prevStart = now - 2 * days * 86_400_000

    const inCur  = (r: RawTransaction) => new Date(r.created_at).getTime() >= curStart
    const inPrev = (r: RawTransaction) => {
      const t = new Date(r.created_at).getTime()
      return t >= prevStart && t < curStart
    }

    const pct = (cur: number, prev: number) =>
      prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : 0

    deltas = {
      saldo:     pct(approved.filter(inCur).reduce((s, r) => s + netOf(r), 0),           approved.filter(inPrev).reduce((s, r) => s + netOf(r), 0)),
      liberar:   pct(pending.filter(inCur).reduce((s, r) => s + netOf(r), 0),            pending.filter(inPrev).reduce((s, r) => s + netOf(r), 0)),
      total:     pct(approved.filter(inCur).reduce((s, r) => s + Number(r.amount), 0),   approved.filter(inPrev).reduce((s, r) => s + Number(r.amount), 0)),
      comissoes: pct(approved.filter(inCur).reduce((s, r) => s + Number(r.fee ?? 0), 0), approved.filter(inPrev).reduce((s, r) => s + Number(r.fee ?? 0), 0)),
    }
  }

  return { saldoDisponivel, aLiberar, totalRecebido, comissoesPlataforma, deltas }
}

const PERIOD_LABEL: Record<Period, string> = { '7d': '7d', '30d': '30d', '90d': '90d', 'all': 'Tudo' }

export function FinanceDashboard({
  initialTransactions,
  initialWithdrawals,
  initialBots,
  initialFlows,
  initialInvoices,
  initialSummary,
  limitReached,
  userId,
}: {
  initialTransactions: RawTransaction[]
  initialWithdrawals:  RawWithdrawal[]
  initialBots:         RawFinanceBot[]
  initialFlows:        RawFinanceFlow[]
  initialInvoices:     RawInvoice[]
  initialSummary:      RawFinanceSummary | null
  limitReached:        boolean
  userId:              string
}) {
  const router = useRouter()
  const [tab,            setTab]           = useState('tx')
  const [period,         setPeriod]        = useState<Period>('30d')
  const [modalOpen,      setModalOpen]     = useState(false)
  const [allRawTxs,      setAllRawTxs]     = useState<RawTransaction[]>(initialTransactions)
  const [loadingMore,    setLoadingMore]   = useState(false)
  const [hasMore,        setHasMore]       = useState(limitReached)
  const [chartCollapsed, setChartCollapsed] = useState(false)
  const { track } = useAnalytics()

  // Realtime — novas transações em tempo real
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('finance-tx-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as unknown as RawTransaction
          setAllRawTxs((prev) => [row, ...prev])
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Memo A: mapeamento raw → tipado (caro, sem dependência de period)
  const { txRows, wdRows, invoices } = useMemo(
    () => mapRawRows(allRawTxs, initialWithdrawals, initialBots, initialFlows, initialInvoices),
    [allRawTxs, initialWithdrawals, initialBots, initialFlows, initialInvoices],
  )

  // Memo B: summary + deltas (leve, só roda quando period muda)
  const summary = useMemo(
    () => buildPeriodSummary(allRawTxs, initialWithdrawals, period, initialSummary),
    [allRawTxs, initialWithdrawals, period, initialSummary],
  )

  // Filtros por período
  const filteredTxs = useMemo(() => {
    if (period === 'all') return txRows
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const ts = Date.now() - days * 86_400_000
    return txRows.filter((t) => new Date(t.dt).getTime() >= ts)
  }, [txRows, period])

  const filteredWds = useMemo(() => {
    if (period === 'all') return wdRows
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const ts = Date.now() - days * 86_400_000
    return wdRows.filter((w) => new Date(w.date).getTime() >= ts)
  }, [wdRows, period])

  const openInvCount = useMemo(
    () => invoices.filter((i) => i.status !== 'paid').length,
    [invoices],
  )

  // Memo C: KPIs secundários do período
  const periodKpis = useMemo(() => {
    const saleTxs  = filteredTxs.filter((t) => t.type === 'sale')
    const approved = saleTxs.filter((t) => t.status === 'available')
    const refunds  = filteredTxs.filter((t) => t.type === 'refund')
    const qtdVendas   = approved.length
    const ticketMedio = qtdVendas > 0
      ? approved.reduce((s, t) => s + t.value, 0) / qtdVendas
      : 0
    const taxaAprov = saleTxs.length > 0
      ? (approved.length / saleTxs.length) * 100
      : 0
    return { qtdVendas, ticketMedio, taxaAprov, qtdReembolsos: refunds.length }
  }, [filteredTxs])

  // Memo D: receita por dia para o gráfico
  const revenueByDay = useMemo(() => {
    const TZ = 'America/Sao_Paulo'
    const numDays = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const approved = filteredTxs.filter((t) => t.type === 'sale' && t.status === 'available')
    const byDay = new Map<string, number>()
    for (const tx of approved) {
      const key = new Date(tx.dt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ })
      byDay.set(key, (byDay.get(key) ?? 0) + tx.value)
    }
    const result: { day: string; receita: number }[] = []
    const now = new Date()
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ })
      result.push({ day: key, receita: byDay.get(key) ?? 0 })
    }
    return result
  }, [filteredTxs, period])

  const loadMoreTransactions = useCallback(async () => {
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/finance/transactions?offset=${allRawTxs.length}`)
      if (!res.ok) return
      const data: RawTransaction[] = await res.json()
      setAllRawTxs((prev) => [...prev, ...data])
      setHasMore(data.length >= LOAD_MORE_LIMIT)
    } finally {
      setLoadingMore(false)
    }
  }, [allRawTxs.length])

  function handleTabChange(id: string) {
    setTab(id)
    track('finance_tab_changed', { tab: id })
  }

  function handlePeriodChange(p: Period) {
    setPeriod(p)
    track('finance_period_changed', { period: p })
  }

  function handleWithdrawalSuccess() {
    setModalOpen(false)
    router.refresh()
  }

  function handleExport() {
    const today = new Date().toISOString().slice(0, 10)
    if (tab === 'tx') {
      exportCSV(`transacoes_${today}.csv`,
        ['ID', 'Data', 'Tipo', 'Descrição', 'Valor líquido (R$)', 'Status', 'Método', 'Gateway', 'Bot', 'Cliente', 'E-mail', 'Telefone', 'Dispositivo', 'Origem UTM', 'Campanha UTM'],
        filteredTxs.map((t) => [
          t.id, t.dt, txTypeMap[t.type]?.label ?? t.type, t.desc, t.value,
          txStatusMap[t.status]?.label ?? t.status,
          t.detail?.method ?? '',
          t.detail?.gateway ?? (t.gatewayRaw ? (GATEWAY_LABEL[t.gatewayRaw] ?? t.gatewayRaw) : ''),
          t.detail?.bot ?? '',
          t.detail?.customer ?? '',
          t.detail?.email ?? '',
          t.detail?.phone ?? '',
          t.detail?.device ?? '',
          t.detail?.utmSource ?? '',
          t.detail?.utmCampaign ?? '',
        ]),
      )
      track('csv_exported', { section: 'financeiro_transacoes', rows: filteredTxs.length, period })
    } else if (tab === 'withdraws') {
      exportCSV(`saques_${today}.csv`,
        ['ID', 'Solicitado em', 'Conta', 'Valor (R$)', 'Status', 'Concluído', 'Observação'],
        filteredWds.map((w) => [w.id, w.date, w.account, w.amount, wdStatusMap[w.status]?.label ?? w.status, w.concluded ?? '', w.notes ?? '']),
      )
      track('csv_exported', { section: 'financeiro_saques', rows: filteredWds.length, period })
    } else {
      exportCSV(`faturas_${today}.csv`,
        ['ID', 'Período', 'Vencimento', 'Valor (R$)', 'Status'],
        invoices.map((i) => [i.id, i.period, i.due, i.value, invStatusMap[i.status]?.label ?? i.status]),
      )
      track('csv_exported', { section: 'financeiro_faturas', rows: invoices.length })
    }
  }

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Receitas, saques e conciliações da sua operação."
        actions={
          <>
            <Btn variant="secondary" iconName="download" onClick={handleExport}>Exportar CSV</Btn>
            <Btn variant="primary" iconName="arrow-up-from-line" onClick={() => setModalOpen(true)}>Solicitar saque</Btn>
          </>
        }
      />

      {hasMore && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-warning-soft border border-warning/30 rounded-xl text-[12.5px] text-warning mb-4">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1">
            Exibindo <strong>{allRawTxs.length}</strong> transações. Os totais nos cards são precisos, mas a tabela pode estar incompleta.{' '}
            <button
              onClick={loadMoreTransactions}
              disabled={loadingMore}
              className="font-semibold underline hover:no-underline disabled:opacity-60 inline-flex items-center gap-1"
            >
              {loadingMore ? <><Spinner /> Carregando…</> : 'Carregar mais →'}
            </button>
          </span>
        </div>
      )}

      {/* KPI cards principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
        <SummaryCard
          label="Saldo disponível"
          value={summary.saldoDisponivel}
          delta={summary.deltas.saldo}
          icon="wallet"
          tone="primary"
          accessory={
            <button onClick={() => setModalOpen(true)} className="text-[11px] font-medium text-primary hover:underline">
              Solicitar saque →
            </button>
          }
        />
        <SummaryCard label="A liberar"                  value={summary.aLiberar}            delta={summary.deltas.liberar}   icon="clock"       />
        <SummaryCard label="Total recebido (histórico)" value={summary.totalRecebido}        delta={summary.deltas.total}     icon="trending-up" />
        <SummaryCard label="Comissões da plataforma"    value={summary.comissoesPlataforma}  delta={summary.deltas.comissoes} icon="percent"     />
      </div>

      {/* KPI cards secundários do período */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SmallStatCard
          label="Vendas no período"
          value={String(periodKpis.qtdVendas)}
          icon="shopping-bag"
          note={PERIOD_LABEL[period]}
        />
        <SmallStatCard
          label="Ticket médio"
          value={fmtBRLdec(periodKpis.ticketMedio)}
          icon="trending-up"
          note={`${periodKpis.qtdVendas} vendas`}
        />
        <SmallStatCard
          label="Taxa de aprovação"
          value={fmtPct(periodKpis.taxaAprov)}
          icon="circle-check"
          note={periodKpis.taxaAprov >= 80 ? 'Boa taxa' : 'Verificar rejeições'}
        />
        <SmallStatCard
          label="Reembolsos"
          value={String(periodKpis.qtdReembolsos)}
          icon="undo-2"
          note={periodKpis.qtdReembolsos === 0 ? 'Nenhum no período' : undefined}
        />
      </div>

      {/* Gráfico de receita — só na aba de transações e não em 'all' */}
      {tab === 'tx' && period !== 'all' && (
        <RevenueChart
          data={revenueByDay}
          collapsed={chartCollapsed}
          onToggle={() => setChartCollapsed((c) => !c)}
        />
      )}

      <div className="flex items-end justify-between border-b border-border mb-4">
        <Tabs
          className="border-b-0"
          tabs={[
            { ...tabsDef[0], count: filteredTxs.length },
            { ...tabsDef[1], count: filteredWds.length  },
            { ...tabsDef[2], count: openInvCount > 0 ? openInvCount : undefined },
          ]}
          active={tab}
          onChange={handleTabChange}
        />
        <div className="mb-1.5 flex gap-0.5 bg-surface-2 p-0.5 rounded-lg">
          {(['7d', '30d', '90d', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={cn(
                'px-2.5 h-7 text-[11px] font-medium rounded-md tnum transition-colors',
                period === p
                  ? 'bg-surface text-text border border-border'
                  : 'text-text-muted hover:text-text',
              )}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {tab === 'tx'        && <TransactionsSection data={filteredTxs} bots={initialBots} />}
      {tab === 'withdraws' && <WithdrawalsSection  data={filteredWds} onNew={() => setModalOpen(true)} />}
      {tab === 'invoices'  && <InvoicesSection     data={invoices} />}

      <WithdrawModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleWithdrawalSuccess}
        saldoDisponivel={summary.saldoDisponivel}
      />
    </>
  )
}
