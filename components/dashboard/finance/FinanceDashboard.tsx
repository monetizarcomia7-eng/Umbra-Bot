'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { exportCSV } from '@/lib/csv'
import { useAnalytics } from '@/hooks/use-analytics'
import type { FinanceData, RawTransaction, RawWithdrawal, Transaction, Withdrawal } from './types'
import { financeMock } from './mock-data'
import { txTypeMap, txStatusMap, wdStatusMap, invStatusMap } from './constants'
import { SummaryCard, Tabs, Btn } from './atoms'
import { TransactionsSection } from './TransactionsSection'
import { WithdrawalsSection } from './WithdrawalsSection'
import { InvoicesSection } from './InvoicesSection'
import { WithdrawModal } from './WithdrawModal'
import { cn } from '@/lib/utils'

type Period = '7d' | '30d' | '90d' | 'all'

const tabsDef = [
  { id: 'tx',        label: 'Transações', icon: 'arrow-left-right'   },
  { id: 'withdraws', label: 'Saques',     icon: 'arrow-up-from-line' },
  { id: 'invoices',  label: 'Faturas',    icon: 'file-text'          },
]

const netOf = (r: RawTransaction) =>
  Number(r.net ?? (Number(r.amount) - Number(r.fee ?? 0)))

function buildLiveData(
  rows: RawTransaction[],
  rawWithdrawals: RawWithdrawal[],
  period: Period,
): FinanceData {
  const txRows: Transaction[] = rows.map((row) => {
    const isRefund = row.status === 'refunded' || row.status === 'cancelled'
    return {
      id:     String(row.id),
      dt:     String(row.created_at),
      type:   isRefund ? 'refund' : 'sale',
      desc:   String(row.product_name || 'Venda'),
      value:  isRefund ? -Math.abs(Number(row.amount)) : netOf(row),
      status: row.status === 'approved' ? 'available'
            : row.status === 'pending'  ? 'pending'
            : 'completed',
    }
  })

  const wdRows: Withdrawal[] = rawWithdrawals.map((w) => ({
    id:        w.id,
    date:      w.created_at,
    amount:    Number(w.amount),
    account:   w.account_label,
    status:    w.status,
    concluded: w.concluded_at ?? '',
  }))

  const approved = rows.filter((r) => r.status === 'approved')
  const pending  = rows.filter((r) => r.status === 'pending')

  // Saldo = soma líquida de aprovadas − total já sacado (pendente ou concluído)
  const totalApprovedNet = approved.reduce((s, r) => s + netOf(r), 0)
  const totalWithdrawn   = rawWithdrawals
    .filter((w) => w.status === 'pending' || w.status === 'completed')
    .reduce((s, w) => s + Number(w.amount), 0)
  const saldoDisponivel  = Math.max(0, totalApprovedNet - totalWithdrawn)

  // Deltas reais: período atual vs período anterior equivalente
  let deltas = { saldo: 0, liberar: 0, total: 0, comissoes: 0 }
  if (period !== 'all' && rows.length > 0) {
    const days      = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const now       = Date.now()
    const curStart  = new Date(now - days * 86_400_000)
    const prevStart = new Date(now - 2 * days * 86_400_000)

    const inCur  = (r: RawTransaction) => new Date(r.created_at) >= curStart
    const inPrev = (r: RawTransaction) =>
      new Date(r.created_at) >= prevStart && new Date(r.created_at) < curStart

    const curApproved  = approved.filter(inCur)
    const prevApproved = approved.filter(inPrev)
    const curPending   = pending.filter(inCur)
    const prevPending  = pending.filter(inPrev)

    const pct = (cur: number, prev: number) =>
      prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : 0

    deltas = {
      saldo:     pct(
        curApproved.reduce((s, r) => s + netOf(r), 0),
        prevApproved.reduce((s, r) => s + netOf(r), 0),
      ),
      liberar:   pct(
        curPending.reduce((s, r) => s + netOf(r), 0),
        prevPending.reduce((s, r) => s + netOf(r), 0),
      ),
      total:     pct(
        curApproved.reduce((s, r) => s + Number(r.amount), 0),
        prevApproved.reduce((s, r) => s + Number(r.amount), 0),
      ),
      comissoes: pct(
        curApproved.reduce((s, r) => s + Number(r.fee ?? 0), 0),
        prevApproved.reduce((s, r) => s + Number(r.fee ?? 0), 0),
      ),
    }
  }

  return {
    ...financeMock,
    summary: {
      saldoDisponivel,
      aLiberar:            pending.reduce((s, r) => s + netOf(r), 0),
      totalRecebido:       approved.reduce((s, r) => s + Number(r.amount), 0),
      comissoesPlataforma: approved.reduce((s, r) => s + Number(r.fee ?? 0), 0),
      deltas,
    },
    transactions: txRows,
    withdrawals:  wdRows,
  }
}

function periodSince(period: Period): Date | null {
  if (period === 'all') return null
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  return new Date(Date.now() - days * 86_400_000)
}

const PERIOD_LABEL: Record<Period, string> = { '7d': '7d', '30d': '30d', '90d': '90d', 'all': 'Tudo' }

export function FinanceDashboard({
  initialTransactions,
  initialWithdrawals,
  limitReached,
}: {
  initialTransactions: RawTransaction[]
  initialWithdrawals:  RawWithdrawal[]
  limitReached:        boolean
}) {
  const router = useRouter()
  const [tab,       setTab]       = useState('tx')
  const [period,    setPeriod]    = useState<Period>('30d')
  const [modalOpen, setModalOpen] = useState(false)
  const { track } = useAnalytics()

  const m = useMemo(
    () => buildLiveData(initialTransactions, initialWithdrawals, period),
    [initialTransactions, initialWithdrawals, period],
  )

  const since       = periodSince(period)
  const filteredTxs = since ? m.transactions.filter((t) => new Date(t.dt)   >= since) : m.transactions
  const filteredWds = since ? m.withdrawals.filter((w)  => new Date(w.date) >= since) : m.withdrawals

  const openInvCount = m.invoices.filter((i) => i.status !== 'paid').length

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
        ['ID', 'Solicitado em', 'Conta', 'Valor (R$)', 'Status', 'Concluído'],
        filteredWds.map((w) => [w.id, w.date, w.account, w.amount, wdStatusMap[w.status]?.label ?? w.status, w.concluded ?? '']),
      )
      track('csv_exported', { section: 'financeiro_saques', rows: filteredWds.length, period })
    } else {
      exportCSV(`faturas_${today}.csv`,
        ['ID', 'Período', 'Vencimento', 'Valor (R$)', 'Status'],
        m.invoices.map((i) => [i.id, i.period, i.due, i.value, invStatusMap[i.status]?.label ?? i.status]),
      )
      track('csv_exported', { section: 'financeiro_faturas', rows: m.invoices.length })
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

      {limitReached && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-warning-soft border border-warning/30 rounded-xl text-[12.5px] text-warning mb-4">
          <AlertTriangle size={14} className="shrink-0" />
          <span>
            Exibindo as <strong>500</strong> transações mais recentes. Totais podem estar incompletos para históricos maiores.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <SummaryCard
          label="Saldo disponível"
          value={m.summary.saldoDisponivel}
          delta={m.summary.deltas.saldo}
          icon="wallet"
          tone="primary"
          accessory={
            <button onClick={() => setModalOpen(true)} className="text-[11px] font-medium text-primary hover:underline">
              Solicitar saque →
            </button>
          }
        />
        <SummaryCard label="A liberar"                  value={m.summary.aLiberar}            delta={m.summary.deltas.liberar}   icon="clock"       />
        <SummaryCard label="Total recebido (histórico)" value={m.summary.totalRecebido}        delta={m.summary.deltas.total}     icon="trending-up" />
        <SummaryCard label="Comissões da plataforma"    value={m.summary.comissoesPlataforma}  delta={m.summary.deltas.comissoes} icon="percent"     />
      </div>

      {/* Tabs + seletor de período lado a lado */}
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
      {tab === 'invoices'  && <InvoicesSection     data={m.invoices} />}

      <WithdrawModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleWithdrawalSuccess}
        saldoDisponivel={m.summary.saldoDisponivel}
      />
    </DashboardLayout>
  )
}
