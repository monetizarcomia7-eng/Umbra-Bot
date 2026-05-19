'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { exportCSV } from '@/lib/csv'
import { useAnalytics } from '@/hooks/use-analytics'
import type {
  RawTransaction, RawWithdrawal, RawFinanceBot, RawFinanceFlow, RawInvoice,
  RawFinanceSummary, Transaction, Withdrawal, Invoice, TxDetail, FinanceSummary,
} from './types'

import { txTypeMap, txStatusMap, wdStatusMap, invStatusMap } from './constants'
import { SummaryCard, Tabs, Btn, Spinner } from './atoms'
import { TransactionsSection } from './TransactionsSection'
import { WithdrawalsSection } from './WithdrawalsSection'
import { InvoicesSection } from './InvoicesSection'
import { WithdrawModal } from './WithdrawModal'
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

const GATEWAY_LABEL: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  pushinpay:   'Pushinpay',
  pagarme:     'Pagar.me',
  stripe:      'Stripe',
}

const METHOD_LABEL: Record<string, string> = {
  pix:    'Pix',
  card:   'Cartão',
  boleto: 'Boleto',
  ted:    'TED',
  other:  'Outro',
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
      utmSource:   row.utm_source   ?? undefined,
      utmCampaign: row.utm_campaign ?? undefined,
    } : undefined

    const status: Transaction['status'] =
      row.status === 'approved'   ? 'available'
      : row.status === 'pending'  ? 'pending'
      : row.status === 'expired'  ? 'expired'
      : row.status === 'cancelled'? 'cancelled'
      :                             'failed'  // refunded → failed

    return {
      id:     String(row.id),
      dt:     String(row.created_at),
      type:   txType,
      desc:   String(row.product_name || 'Venda'),
      value:  isRefund ? -Math.abs(gross) : net,
      status,
      detail,
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
}: {
  initialTransactions: RawTransaction[]
  initialWithdrawals:  RawWithdrawal[]
  initialBots:         RawFinanceBot[]
  initialFlows:        RawFinanceFlow[]
  initialInvoices:     RawInvoice[]
  initialSummary:      RawFinanceSummary | null
  limitReached:        boolean
}) {
  const router = useRouter()
  const [tab,          setTab]          = useState('tx')
  const [period,       setPeriod]       = useState<Period>('30d')
  const [modalOpen,    setModalOpen]    = useState(false)
  const [allRawTxs,    setAllRawTxs]    = useState<RawTransaction[]>(initialTransactions)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [hasMore,      setHasMore]      = useState(limitReached)
  const { track } = useAnalytics()

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

  // Filtros por período (roda só quando txRows ou period mudam)
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
        ['ID', 'Data', 'Tipo', 'Descrição', 'Valor (R$)', 'Status'],
        filteredTxs.map((t) => [t.id, t.dt, txTypeMap[t.type]?.label ?? t.type, t.desc, t.value, txStatusMap[t.status]?.label ?? t.status]),
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
    <DashboardLayout>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
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

      {tab === 'tx'        && <TransactionsSection data={filteredTxs} />}
      {tab === 'withdraws' && <WithdrawalsSection  data={filteredWds} onNew={() => setModalOpen(true)} />}
      {tab === 'invoices'  && <InvoicesSection     data={invoices} />}

      <WithdrawModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleWithdrawalSuccess}
        saldoDisponivel={summary.saldoDisponivel}
      />
    </DashboardLayout>
  )
}
