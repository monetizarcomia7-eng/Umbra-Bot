'use client'

import React, { useState } from 'react'
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

const tabsDef = [
  { id: 'tx',        label: 'Transações', icon: 'arrow-left-right'   },
  { id: 'withdraws', label: 'Saques',     icon: 'arrow-up-from-line' },
  { id: 'invoices',  label: 'Faturas',    icon: 'file-text'          },
]

function buildLiveData(rows: RawTransaction[], rawWithdrawals: RawWithdrawal[]): FinanceData {
  const txRows: Transaction[] = rows.map((row) => {
    const isRefund = row.status === 'refunded' || row.status === 'cancelled'
    return {
      id:     String(row.id),
      dt:     String(row.created_at),
      type:   isRefund ? 'refund' : 'sale',
      desc:   String(row.product_name || 'Venda'),
      value:  isRefund ? -Math.abs(Number(row.amount)) : Number(row.net ?? row.amount),
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

  return {
    ...financeMock,
    summary: {
      saldoDisponivel:     approved.reduce((s, r) => s + Number(r.net ?? r.amount), 0),
      aLiberar:            pending.reduce((s, r) => s + Number(r.net ?? r.amount), 0),
      totalRecebido:       approved.reduce((s, r) => s + Number(r.amount), 0),
      comissoesPlataforma: approved.reduce((s, r) => s + Number(r.fee ?? 0), 0),
      deltas: { saldo: 0, liberar: 0, total: 0, comissoes: 0 },
    },
    transactions: txRows,
    withdrawals:  wdRows.length > 0 ? wdRows : financeMock.withdrawals,
  }
}

export function FinanceDashboard({
  initialTransactions,
  initialWithdrawals,
}: {
  initialTransactions: RawTransaction[]
  initialWithdrawals:  RawWithdrawal[]
}) {
  const [tab,       setTab]       = useState('tx')
  const [modalOpen, setModalOpen] = useState(false)
  const { track } = useAnalytics()

  const m = initialTransactions.length > 0
    ? buildLiveData(initialTransactions, initialWithdrawals)
    : financeMock

  const openInvCount = m.invoices.filter((i) => i.status !== 'paid').length

  function handleExport() {
    const today = new Date().toISOString().slice(0, 10)
    if (tab === 'tx') {
      exportCSV(`transacoes_${today}.csv`,
        ['ID', 'Data', 'Tipo', 'Descrição', 'Valor (R$)', 'Status'],
        m.transactions.map((t) => [t.id, t.dt, txTypeMap[t.type]?.label ?? t.type, t.desc, t.value, txStatusMap[t.status]?.label ?? t.status]),
      )
      track('csv_exported', { section: 'financeiro_transacoes', rows: m.transactions.length })
    } else if (tab === 'withdraws') {
      exportCSV(`saques_${today}.csv`,
        ['ID', 'Solicitado em', 'Conta', 'Valor (R$)', 'Status', 'Concluído'],
        m.withdrawals.map((w) => [w.id, w.date, w.account, w.amount, wdStatusMap[w.status]?.label ?? w.status, w.concluded ?? '']),
      )
      track('csv_exported', { section: 'financeiro_saques', rows: m.withdrawals.length })
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
        <SummaryCard label="Total recebido no período"  value={m.summary.totalRecebido}        delta={m.summary.deltas.total}     icon="trending-up" />
        <SummaryCard label="Comissões da plataforma"    value={m.summary.comissoesPlataforma}  delta={m.summary.deltas.comissoes} icon="percent"     />
      </div>

      <Tabs
        className="mb-4"
        tabs={[
          { ...tabsDef[0], count: m.transactions.length },
          { ...tabsDef[1], count: m.withdrawals.length  },
          { ...tabsDef[2], count: openInvCount > 0 ? openInvCount : undefined },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'tx'        && <TransactionsSection data={m.transactions} />}
      {tab === 'withdraws' && <WithdrawalsSection  data={m.withdrawals} onNew={() => setModalOpen(true)} />}
      {tab === 'invoices'  && <InvoicesSection     data={m.invoices} />}

      <WithdrawModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        saldoDisponivel={m.summary.saldoDisponivel}
        contas={m.contas}
      />
    </DashboardLayout>
  )
}
