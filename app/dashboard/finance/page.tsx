'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { cn } from '@/lib/utils'
import {
  Download, ArrowUpFromLine, Wallet, Clock, TrendingUp, Percent,
  ShoppingBag, UserPlus, Undo2, ArrowUpRight, ArrowDownRight,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Search, Calendar, Tag, CircleCheck, Inbox, X,
  Zap, Landmark, Info, AlertTriangle, AlertCircle, Check,
  ArrowRight, ArrowLeft, CreditCard, FileText, ArrowLeftRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { exportCSV } from '@/lib/csv'

/* ── Icon map ─────────────────────────────────────────────── */

const iconMap: Record<string, LucideIcon> = {
  'download': Download,
  'arrow-up-from-line': ArrowUpFromLine,
  'wallet': Wallet,
  'clock': Clock,
  'trending-up': TrendingUp,
  'percent': Percent,
  'shopping-bag': ShoppingBag,
  'user-plus': UserPlus,
  'undo-2': Undo2,
  'arrow-up-right': ArrowUpRight,
  'arrow-down-right': ArrowDownRight,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'search': Search,
  'calendar': Calendar,
  'tag': Tag,
  'circle-check': CircleCheck,
  'inbox': Inbox,
  'x': X,
  'zap': Zap,
  'landmark': Landmark,
  'info': Info,
  'alert-triangle': AlertTriangle,
  'alert-circle': AlertCircle,
  'check': Check,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'credit-card': CreditCard,
  'file-text': FileText,
  'arrow-left-right': ArrowLeftRight,
}

function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Comp = iconMap[name]
  if (!Comp) return null
  return <Comp size={size} className={className} />
}

/* ── Formatters ───────────────────────────────────────────── */

const fmtNum    = (v: number) => v.toLocaleString('pt-BR')
const fmtBRL    = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
const fmtBRLdec = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
const fmtPct    = (v: number, d = 1) => `${v.toFixed(d)}%`
const fmtDate   = (dt: string) =>
  new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDateTime = (dt: string) =>
  new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmtDateShort = (dt: string) =>
  new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const fmtTime   = (dt: string) =>
  new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/* ── Types ────────────────────────────────────────────────── */

interface TxDetail {
  customer: string; email: string; product: string; gateway: string; method: string
  gross: number; gatewayFee: number; platformFee: number; net: number; bot: string; flow: string
}

interface Transaction {
  id: string; dt: string; type: 'sale' | 'fee' | 'commission' | 'refund' | 'withdraw'
  desc: string; value: number; status: 'available' | 'pending' | 'completed' | 'failed'
  detail?: TxDetail
}

interface Withdrawal {
  id: string; date: string; amount: number; account: string
  status: 'completed' | 'pending' | 'failed'; concluded: string
}

interface Invoice {
  id: string; period: string; value: number; due: string
  status: 'paid' | 'pending' | 'overdue'
}

interface Conta { id: string; label: string; bank: string; kind: string }

/* ── Mock data ────────────────────────────────────────────── */

const financeMock: {
  summary: { saldoDisponivel: number; aLiberar: number; totalRecebido: number; comissoesPlataforma: number; deltas: Record<string, number> }
  contas: Conta[]
  transactions: Transaction[]
  withdrawals: Withdrawal[]
  invoices: Invoice[]
} = {
  summary: {
    saldoDisponivel: 24380.42,
    aLiberar: 8742.18,
    totalRecebido: 184320.00,
    comissoesPlataforma: 5529.60,
    deltas: { saldo: 12.4, liberar: -3.2, total: 12.4, comissoes: 8.1 },
  },
  contas: [
    { id: 'bb',     label: 'Conta BB · Ag 1234 · final 8842', bank: 'Banco do Brasil', kind: 'PJ'  },
    { id: 'nubank', label: 'Nubank · final 0297',              bank: 'Nubank',          kind: 'PJ'  },
    { id: 'pix',    label: 'Pix · CPF 123.***.***-45',         bank: 'Chave Pix',       kind: 'CPF' },
  ],
  transactions: [
    { id: 'tx_2418', dt: '2026-05-18T14:32', type: 'sale',       desc: 'Mentoria Premium Anual',          value: 1297.00, status: 'available',
      detail: { customer: 'João da Silva',        email: 'joao.silva@gmail.com',  product: 'Mentoria Premium Anual',  gateway: 'Pushinpay',    method: 'Pix',        gross: 1297.00, gatewayFee: 47.45, platformFee: 38.91, net: 1210.64, bot: '@mentoria_vip_bot',     flow: 'Funil VIP — Lançamento'  } },
    { id: 'tx_2417', dt: '2026-05-18T13:15', type: 'fee',        desc: 'Taxa Pushinpay · #tx_2418',       value: -47.45,  status: 'available'  },
    { id: 'tx_2416', dt: '2026-05-18T11:42', type: 'commission', desc: 'Comissão afiliado · Ana Lima',    value: -129.70, status: 'available'  },
    { id: 'tx_2415', dt: '2026-05-18T10:05', type: 'sale',       desc: 'Curso Intensivo 90 dias',         value: 147.00,  status: 'pending',
      detail: { customer: 'Maria Souza',          email: 'maria.s@outlook.com',   product: 'Curso Intensivo 90 dias', gateway: 'Mercado Pago', method: 'Cartão 12x', gross: 147.00,  gatewayFee: 6.91,  platformFee: 4.41,  net: 135.68, bot: '@vendas_curso_bot',     flow: 'Bem-vindo + Oferta'      } },
    { id: 'tx_2414', dt: '2026-05-17T18:21', type: 'sale',       desc: 'Pack Templates Pro',              value: 70.00,   status: 'available',
      detail: { customer: 'Pedro Castro',         email: 'pcastro@empresa.com',   product: 'Pack Templates Pro',      gateway: 'Pushinpay',    method: 'Pix',        gross: 70.00,   gatewayFee: 2.56,  platformFee: 2.10,  net: 65.34,  bot: '@upsell_pos_bot',       flow: 'Upsell pós-compra'       } },
    { id: 'tx_2413', dt: '2026-05-17T16:08', type: 'refund',     desc: 'Estorno · #ord_8842',             value: -297.00, status: 'completed'  },
    { id: 'tx_2412', dt: '2026-05-17T09:21', type: 'sale',       desc: 'Consultoria Individual',          value: 675.00,  status: 'available',
      detail: { customer: 'Luana Andrade',        email: 'luana@studio.co',       product: 'Consultoria Individual',  gateway: 'Stripe',       method: 'Cartão',     gross: 675.00,  gatewayFee: 30.38, platformFee: 20.25, net: 624.37, bot: '@mentoria_vip_bot',     flow: 'Funil VIP — Lançamento'  } },
    { id: 'tx_2411', dt: '2026-05-16T22:14', type: 'sale',       desc: 'Curso Intensivo 90 dias',         value: 147.00,  status: 'available',
      detail: { customer: 'Rafael Mendes',        email: 'rmendes@gmail.com',     product: 'Curso Intensivo 90 dias', gateway: 'Pushinpay',    method: 'Pix',        gross: 147.00,  gatewayFee: 5.37,  platformFee: 4.41,  net: 137.22, bot: '@vendas_curso_bot',     flow: 'Carrinho abandonado 24h' } },
    { id: 'tx_2410', dt: '2026-05-16T18:45', type: 'withdraw',   desc: 'Saque · Conta BB · final 8842',  value: -12480.00, status: 'completed' },
    { id: 'tx_2409', dt: '2026-05-16T15:28', type: 'sale',       desc: 'Mentoria Premium Anual',          value: 1297.00, status: 'available',
      detail: { customer: 'Bianca Ramos',         email: 'bia.r@uol.com.br',      product: 'Mentoria Premium Anual',  gateway: 'Pushinpay',    method: 'Pix',        gross: 1297.00, gatewayFee: 47.45, platformFee: 38.91, net: 1210.64, bot: '@mentoria_vip_bot',     flow: 'Funil VIP — Lançamento'  } },
    { id: 'tx_2408', dt: '2026-05-16T11:03', type: 'sale',       desc: 'E-book Estratégias',              value: 20.00,   status: 'available',
      detail: { customer: 'Thiago Lopes',         email: 'tlopes@hotmail.com',    product: 'E-book Estratégias',      gateway: 'Pushinpay',    method: 'Pix',        gross: 20.00,   gatewayFee: 0.73,  platformFee: 0.60,  net: 18.67,  bot: '@vendas_curso_bot',     flow: 'Bem-vindo + Oferta'      } },
    { id: 'tx_2407', dt: '2026-05-15T20:17', type: 'sale',       desc: 'Pack Templates Pro',              value: 70.00,   status: 'pending',
      detail: { customer: 'Camila Oliveira',      email: 'camila.o@gmail.com',    product: 'Pack Templates Pro',      gateway: 'Mercado Pago', method: 'Boleto',     gross: 70.00,   gatewayFee: 3.29,  platformFee: 2.10,  net: 64.61,  bot: '@upsell_pos_bot',       flow: 'Remarketing 7 dias'      } },
    { id: 'tx_2406', dt: '2026-05-15T14:52', type: 'fee',        desc: 'Taxa Stripe · #tx_2412',          value: -30.38,  status: 'available'  },
    { id: 'tx_2405', dt: '2026-05-15T13:21', type: 'commission', desc: 'Comissão afiliado · Bruno Tavares', value: -67.50, status: 'available' },
    { id: 'tx_2404', dt: '2026-05-15T09:48', type: 'sale',       desc: 'Mentoria Premium Anual',          value: 1297.00, status: 'available',
      detail: { customer: 'Diego Antunes',        email: 'diego.a@dev.io',        product: 'Mentoria Premium Anual',  gateway: 'Pushinpay',    method: 'Pix',        gross: 1297.00, gatewayFee: 47.45, platformFee: 38.91, net: 1210.64, bot: '@mentoria_vip_bot',     flow: 'Funil VIP — Lançamento'  } },
    { id: 'tx_2403', dt: '2026-05-14T19:34', type: 'sale',       desc: 'Curso Intensivo 90 dias',         value: 147.00,  status: 'available',
      detail: { customer: 'Sabrina Pinheiro',     email: 'sa.pinheiro@ig.com',    product: 'Curso Intensivo 90 dias', gateway: 'Pushinpay',    method: 'Pix',        gross: 147.00,  gatewayFee: 5.37,  platformFee: 4.41,  net: 137.22, bot: '@vendas_curso_bot',     flow: 'Bem-vindo + Oferta'      } },
    { id: 'tx_2402', dt: '2026-05-14T15:09', type: 'sale',       desc: 'Consultoria Individual',          value: 675.00,  status: 'available',
      detail: { customer: 'Fernando Pires',       email: 'f.pires@empresa.co',    product: 'Consultoria Individual',  gateway: 'Stripe',       method: 'Cartão',     gross: 675.00,  gatewayFee: 30.38, platformFee: 20.25, net: 624.37, bot: '@mentoria_vip_bot',     flow: 'Funil VIP — Lançamento'  } },
    { id: 'tx_2401', dt: '2026-05-14T10:42', type: 'sale',       desc: 'Pack Templates Pro',              value: 70.00,   status: 'available',
      detail: { customer: 'Igor Bertolini',       email: 'igorb@trab.com',        product: 'Pack Templates Pro',      gateway: 'Pushinpay',    method: 'Pix',        gross: 70.00,   gatewayFee: 2.56,  platformFee: 2.10,  net: 65.34,  bot: '@upsell_pos_bot',       flow: 'Upsell pós-compra'       } },
    { id: 'tx_2400', dt: '2026-05-13T22:18', type: 'sale',       desc: 'E-book Estratégias',              value: 20.00,   status: 'available',
      detail: { customer: 'Renata Cavalcanti',    email: 'renata.c@globo.com',    product: 'E-book Estratégias',      gateway: 'Pushinpay',    method: 'Pix',        gross: 20.00,   gatewayFee: 0.73,  platformFee: 0.60,  net: 18.67,  bot: '@vendas_curso_bot',     flow: 'Bem-vindo + Oferta'      } },
    { id: 'tx_2399', dt: '2026-05-13T17:54', type: 'refund',     desc: 'Estorno · #ord_8765',             value: -147.00, status: 'completed'  },
    { id: 'tx_2398', dt: '2026-05-13T14:21', type: 'sale',       desc: 'Mentoria Premium Anual',          value: 1297.00, status: 'available',
      detail: { customer: 'Vinícius Costa',       email: 'vini.costa@yahoo.com',  product: 'Mentoria Premium Anual',  gateway: 'Pushinpay',    method: 'Pix',        gross: 1297.00, gatewayFee: 47.45, platformFee: 38.91, net: 1210.64, bot: '@mentoria_vip_bot',     flow: 'Funil VIP — Lançamento'  } },
    { id: 'tx_2397', dt: '2026-05-12T20:08', type: 'sale',       desc: 'Curso Intensivo 90 dias',         value: 147.00,  status: 'available',
      detail: { customer: 'Patrícia Albuquerque', email: 'paty.a@empresa.br',     product: 'Curso Intensivo 90 dias', gateway: 'Pushinpay',    method: 'Pix',        gross: 147.00,  gatewayFee: 5.37,  platformFee: 4.41,  net: 137.22, bot: '@vendas_curso_bot',     flow: 'Carrinho abandonado 24h' } },
    { id: 'tx_2396', dt: '2026-05-12T16:35', type: 'fee',        desc: 'Taxa Pushinpay · #tx_2398',       value: -47.45,  status: 'available'  },
    { id: 'tx_2395', dt: '2026-05-12T11:12', type: 'withdraw',   desc: 'Saque · Nubank · final 0297',     value: -3500.00, status: 'failed'    },
  ],
  withdrawals: [
    { id: 'wd_011', date: '2026-05-16T18:45', amount: 12480.00, account: 'Conta BB · final 8842', status: 'completed', concluded: '2026-05-17T09:22' },
    { id: 'wd_010', date: '2026-04-30T14:21', amount: 18750.00, account: 'Conta BB · final 8842', status: 'completed', concluded: '2026-05-02T08:14' },
    { id: 'wd_009', date: '2026-04-15T11:08', amount: 5200.00,  account: 'Nubank · final 0297',   status: 'completed', concluded: '2026-04-16T10:30' },
    { id: 'wd_008', date: '2026-03-30T16:42', amount: 22100.00, account: 'Conta BB · final 8842', status: 'completed', concluded: '2026-04-01T09:05' },
    { id: 'wd_007', date: '2026-03-08T10:15', amount: 3500.00,  account: 'Nubank · final 0297',   status: 'failed',    concluded: '2026-03-08T14:42' },
    { id: 'wd_006', date: '2026-02-28T13:30', amount: 14800.00, account: 'Conta BB · final 8842', status: 'completed', concluded: '2026-03-02T08:18' },
  ],
  invoices: [
    { id: 'inv_2026_05', period: 'Maio/2026',      value: 2184.30, due: '2026-06-10', status: 'pending' },
    { id: 'inv_2026_04', period: 'Abril/2026',     value: 1947.50, due: '2026-05-10', status: 'paid'    },
    { id: 'inv_2026_03', period: 'Março/2026',     value: 1622.80, due: '2026-04-10', status: 'paid'    },
    { id: 'inv_2026_02', period: 'Fevereiro/2026', value: 1284.10, due: '2026-03-10', status: 'paid'    },
    { id: 'inv_2026_01', period: 'Janeiro/2026',   value: 947.20,  due: '2026-02-10', status: 'paid'    },
    { id: 'inv_2025_12', period: 'Dezembro/2025',  value: 1834.60, due: '2026-01-10', status: 'paid'    },
  ],
}

/* ── Maps ─────────────────────────────────────────────────── */

const txTypeMap: Record<string, { label: string; icon: string; tone: string }> = {
  sale:       { label: 'Venda',    icon: 'shopping-bag',      tone: 'success'  },
  commission: { label: 'Comissão', icon: 'user-plus',         tone: 'warning'  },
  fee:        { label: 'Taxa',     icon: 'percent',           tone: 'muted'    },
  refund:     { label: 'Estorno',  icon: 'undo-2',            tone: 'danger'   },
  withdraw:   { label: 'Saque',    icon: 'arrow-up-from-line', tone: 'primary' },
}

const txStatusMap: Record<string, { label: string; tone: string }> = {
  available: { label: 'Disponível', tone: 'success' },
  pending:   { label: 'A liberar',  tone: 'warning' },
  completed: { label: 'Concluído',  tone: 'success' },
  failed:    { label: 'Falhou',     tone: 'danger'  },
}

const wdStatusMap: Record<string, { label: string; tone: string }> = {
  completed: { label: 'Concluído',  tone: 'success' },
  pending:   { label: 'Em análise', tone: 'warning' },
  failed:    { label: 'Falhou',     tone: 'danger'  },
}

const invStatusMap: Record<string, { label: string; tone: string }> = {
  paid:    { label: 'Paga',      tone: 'success' },
  pending: { label: 'Em aberto', tone: 'warning' },
  overdue: { label: 'Vencida',   tone: 'danger'  },
}

const typeToFilter: Record<string, string>   = { 'Venda': 'sale', 'Comissão': 'commission', 'Taxa': 'fee', 'Estorno': 'refund', 'Saque': 'withdraw' }
const statusToFilter: Record<string, string> = { 'Disponível': 'available', 'A liberar': 'pending', 'Concluído': 'completed', 'Falhou': 'failed' }

/* ── Local helpers ────────────────────────────────────────── */

const toneClasses: Record<string, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger:  'bg-danger-soft text-danger',
  primary: 'bg-primary-soft text-primary',
  muted:   'bg-surface-2 text-text-muted',
}

function Badge({ tone = 'muted', icon, children }: { tone?: string; icon?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium', toneClasses[tone] ?? toneClasses.muted)}>
      {icon && <Icon name={icon} size={10} />}
      {children}
    </span>
  )
}

function Card({
  title, subtitle, action, noPadding, children,
}: {
  title?: string; subtitle?: string; action?: React.ReactNode; noPadding?: boolean; children?: React.ReactNode
}) {
  const hasHeader = !!(title || action)
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {hasHeader && (
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          {title && (
            <div>
              <div className="text-[14px] font-semibold text-text">{title}</div>
              {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
            </div>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'px-5 pb-5'}>{children}</div>
    </div>
  )
}

function Tabs({
  tabs, active, onChange, className,
}: {
  tabs: { id: string; label: string; icon?: string; count?: number }[]
  active: string; onChange: (id: string) => void; className?: string
}) {
  return (
    <div className={cn('flex items-center gap-0.5 border-b border-border', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium rounded-t-md -mb-px border-b-2 transition-colors',
            active === tab.id ? 'text-primary border-primary' : 'text-text-muted border-transparent hover:text-text',
          )}
        >
          {tab.icon && <Icon name={tab.icon} size={14} />}
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded-md min-w-[20px] text-center tnum',
              active === tab.id ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-text-muted',
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function Modal({
  open, onClose, title, subtitle, size = 'md', footer, children,
}: {
  open: boolean; onClose: () => void; title?: string | null; subtitle?: string | null
  size?: 'sm' | 'md' | 'lg'; footer?: React.ReactNode; children?: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={cn(
        'relative bg-surface border border-border rounded-xl shadow-xl flex flex-col max-h-[90vh] w-full',
        size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md',
      )}>
        {title && (
          <div className="flex items-start justify-between p-5 border-b border-border">
            <div>
              <h2 className="text-[15px] font-semibold text-text">{title}</h2>
              {subtitle && <p className="text-[12.5px] text-text-muted mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 p-4 border-t border-border">{footer}</div>
        )}
      </div>
    </div>
  )
}

function Dropdown({
  icon, label, value, options, onChange,
}: {
  icon?: string; label: string; value: string; options: string[]
  onChange: (v: string) => void
}) {
  const Ico = icon ? (iconMap[icon] ?? null) : null
  return (
    <div className="relative h-9 min-w-[140px]">
      {Ico && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none z-10">
          <Ico size={13} />
        </span>
      )}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-full w-full appearance-none bg-surface border border-border rounded-lg text-[12.5px] text-text pr-7',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
          Ico ? 'pl-8' : 'pl-3',
        )}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
        <ChevronDown size={12} />
      </span>
    </div>
  )
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" className="spin" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function Btn({
  variant = 'primary', size = 'md', iconName, children, onClick, disabled, className,
}: {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  iconName?: string
  children?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  const Ico = iconName ? (iconMap[iconName] ?? null) : null
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
        variant === 'primary'   ? 'bg-primary text-primary-fg hover:opacity-90' :
        variant === 'secondary' ? 'border border-border bg-surface text-text hover:bg-surface-2' :
                                  'text-text-muted hover:bg-surface-2 hover:text-text',
        className,
      )}
    >
      {Ico && <Ico size={size === 'sm' ? 12 : 14} className="shrink-0" />}
      {children}
    </button>
  )
}

/* ── Summary Cards ────────────────────────────────────────── */

function SummaryCard({ label, value, delta, icon, tone, accessory }: {
  label: string; value: number; delta?: number; icon: string; tone?: string; accessory?: React.ReactNode
}) {
  const positive = (delta ?? 0) >= 0
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[12px] text-text-muted font-medium">{label}</div>
        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center', tone === 'primary' ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-text-muted')}>
          <Icon name={icon} size={14} />
        </div>
      </div>
      <div className="text-[24px] font-semibold tnum tracking-tight text-text leading-none">{fmtBRLdec(value)}</div>
      <div className="flex items-center gap-2 mt-2.5">
        {delta !== undefined && (
          <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md tnum font-medium text-[11px]', positive ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
            <Icon name={positive ? 'arrow-up-right' : 'arrow-down-right'} size={11} />
            {fmtPct(Math.abs(delta))}
          </span>
        )}
        {accessory}
      </div>
    </div>
  )
}

/* ── Transactions ─────────────────────────────────────────── */

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px]">
      <span className="text-text-muted shrink-0">{label}</span>
      <span className="text-text text-right truncate">{value}</span>
    </div>
  )
}

function BreakdownRow({ label, value, sign, emphasize }: { label: string; value: number; sign: '+' | '−'; emphasize?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 text-[12px]', emphasize ? 'font-semibold text-text' : 'text-text-muted')}>
      <span>{label}</span>
      <span className={cn('tnum', emphasize ? 'text-text' : '')}>
        {sign === '−' ? '−' : ''}{fmtBRLdec(value)}
      </span>
    </div>
  )
}

function TransactionDetail({ tx }: { tx: Transaction }) {
  const d = tx.detail!
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-w-3xl">
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle">Cliente & origem</div>
        <DetailRow label="Cliente" value={d.customer} />
        <DetailRow label="E-mail"  value={d.email} />
        <DetailRow label="Produto" value={d.product} />
        <DetailRow label="Bot"     value={<span className="tnum">{d.bot}</span>} />
        <DetailRow label="Fluxo"   value={d.flow} />
      </div>
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle">Pagamento & repasse</div>
        <DetailRow label="Gateway" value={`${d.gateway} · ${d.method}`} />
        <div className="border-t border-border pt-2 space-y-1.5">
          <BreakdownRow label="Valor bruto" value={d.gross} sign="+" />
          <BreakdownRow label={`Taxa do gateway (${fmtPct((d.gatewayFee / d.gross) * 100)})`} value={d.gatewayFee} sign="−" />
          <BreakdownRow label={`Comissão Umbra Bot (${fmtPct((d.platformFee / d.gross) * 100)})`} value={d.platformFee} sign="−" />
          <div className="h-px bg-border my-1" />
          <BreakdownRow label="Valor líquido" value={d.net} sign="+" emphasize />
        </div>
      </div>
    </div>
  )
}

function TransactionRow({ tx, expanded, onToggle }: { tx: Transaction; expanded: boolean; onToggle: () => void }) {
  const t = txTypeMap[tx.type]
  const s = txStatusMap[tx.status]
  const isExpandable = tx.type === 'sale' && !!tx.detail
  const isNegative = tx.value < 0

  return (
    <>
      <tr
        className={cn('border-t border-border transition-colors', isExpandable ? 'cursor-pointer hover:bg-surface-2/60' : '', expanded ? 'bg-surface-2/40' : '')}
        onClick={isExpandable ? onToggle : undefined}
      >
        <td className="py-2.5 pl-4 pr-2 whitespace-nowrap">
          <div className="text-[12.5px] text-text tnum">{fmtDateShort(tx.dt)}</div>
          <div className="text-[10.5px] text-text-muted tnum">{fmtTime(tx.dt)}</div>
        </td>
        <td className="py-2.5 px-2 whitespace-nowrap">
          <Badge tone={t.tone} icon={t.icon}>{t.label}</Badge>
        </td>
        <td className="py-2.5 px-2 text-[12.5px] text-text max-w-[280px] truncate">{tx.desc}</td>
        <td className="py-2.5 px-2 text-right whitespace-nowrap">
          <span className={cn('text-[13px] font-semibold tnum', isNegative ? 'text-danger' : 'text-text')}>
            {isNegative ? '−' : '+'}{fmtBRLdec(Math.abs(tx.value))}
          </span>
        </td>
        <td className="py-2.5 px-2 whitespace-nowrap">
          <Badge tone={s.tone}>{s.label}</Badge>
        </td>
        <td className="py-2.5 pl-2 pr-4 text-right">
          {isExpandable && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-text-muted">
              <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} />
            </span>
          )}
        </td>
      </tr>
      {expanded && isExpandable && (
        <tr className="bg-surface-2/40 border-t border-border">
          <td colSpan={6} className="px-4 py-4">
            <TransactionDetail tx={tx} />
          </td>
        </tr>
      )}
    </>
  )
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages = useMemo(() => Array.from({ length: totalPages }, (_, i) => i + 1), [totalPages])
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed focus-ring"
      >
        <ChevronLeft size={14} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn('min-w-[32px] h-8 px-2 text-[12px] font-medium rounded-md tnum focus-ring', p === page ? 'bg-primary-soft text-primary' : 'text-text-muted hover:bg-surface-2 hover:text-text')}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed focus-ring"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

const filterPeriods = ['Últimos 7 dias', 'Últimos 30 dias', 'Últimos 90 dias', 'Este mês', 'Personalizado']
const filterTypes   = ['Todos os tipos', 'Venda', 'Comissão', 'Taxa', 'Estorno', 'Saque']
const filterStatus  = ['Todos os status', 'Disponível', 'A liberar', 'Concluído', 'Falhou']

function TransactionsSection({ data }: { data: Transaction[] }) {
  const [filters, setFilters] = useState({ period: 'Últimos 30 dias', type: 'Todos os tipos', status: 'Todos os status', search: '' })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const perPage = 8

  const filtered = useMemo(() => data.filter((tx) => {
    if (filters.type !== 'Todos os tipos' && tx.type !== typeToFilter[filters.type]) return false
    if (filters.status !== 'Todos os status' && tx.status !== statusToFilter[filters.status]) return false
    if (filters.search && !tx.desc.toLowerCase().includes(filters.search.toLowerCase())) return false
    return true
  }), [data, filters])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * perPage
  const pageItems = filtered.slice(start, start + perPage)

  useEffect(() => { setPage(1); setExpanded(new Set()) }, [filters])

  function toggleExpand(id: string) {
    setExpanded((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  const hasFilters = filters.type !== 'Todos os tipos' || filters.status !== 'Todos os status' || !!filters.search

  return (
    <Card noPadding>
      <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Buscar por descrição…"
            className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[12.5px] placeholder:text-text-subtle text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>
        <Dropdown icon="calendar"     label="Período" value={filters.period} options={filterPeriods} onChange={(v) => setFilters((f) => ({ ...f, period: v }))} />
        <Dropdown icon="tag"          label="Tipo"    value={filters.type}   options={filterTypes}   onChange={(v) => setFilters((f) => ({ ...f, type: v }))} />
        <Dropdown icon="circle-check" label="Status"  value={filters.status} options={filterStatus}  onChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
        {hasFilters && (
          <button
            onClick={() => setFilters({ period: 'Últimos 30 dias', type: 'Todos os tipos', status: 'Todos os status', search: '' })}
            className="h-9 px-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text rounded-lg hover:bg-surface-2 focus-ring"
          >
            <X size={13} />
            Limpar
          </button>
        )}
        <div className="flex-1" />
        <div className="text-[11.5px] text-text-muted tnum">
          {filtered.length} {filtered.length === 1 ? 'transação' : 'transações'}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4">
            <Inbox size={20} />
          </div>
          <div className="text-[14px] font-semibold text-text">Nenhuma transação encontrada</div>
          <div className="text-[12.5px] text-text-muted mt-1 max-w-xs">Ajuste os filtros ou amplie o período para ver mais resultados.</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse min-w-[760px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-wider text-text-subtle font-semibold">
                <th className="text-left  font-semibold pl-4 pr-2 py-2.5">Data</th>
                <th className="text-left  font-semibold px-2 py-2.5">Tipo</th>
                <th className="text-left  font-semibold px-2 py-2.5">Descrição</th>
                <th className="text-right font-semibold px-2 py-2.5">Valor</th>
                <th className="text-left  font-semibold px-2 py-2.5">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} expanded={expanded.has(tx.id)} onToggle={() => toggleExpand(tx.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="px-5 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11.5px] text-text-muted tnum">
            Mostrando <span className="text-text font-medium">{start + 1}–{Math.min(start + perPage, filtered.length)}</span> de <span className="text-text font-medium">{filtered.length}</span>
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </Card>
  )
}

/* ── Withdrawals ──────────────────────────────────────────── */

function WithdrawalsSection({ data, onNew }: { data: Withdrawal[]; onNew: () => void }) {
  return (
    <Card title="Histórico de saques" subtitle="Saques solicitados nos últimos 90 dias" action={<Btn variant="secondary" size="sm" iconName="arrow-up-from-line" onClick={onNew}>Solicitar saque</Btn>} noPadding>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-[12.5px] border-collapse min-w-[640px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wider text-text-subtle font-semibold">
              <th className="text-left  font-semibold pl-4 pr-2 py-2.5">Solicitado em</th>
              <th className="text-left  font-semibold px-2 py-2.5">Conta de destino</th>
              <th className="text-right font-semibold px-2 py-2.5">Valor</th>
              <th className="text-left  font-semibold px-2 py-2.5">Status</th>
              <th className="text-left  font-semibold pl-2 pr-4 py-2.5">Concluído</th>
            </tr>
          </thead>
          <tbody>
            {data.map((w) => {
              const st = wdStatusMap[w.status]
              return (
                <tr key={w.id} className="border-t border-border hover:bg-surface-2/40">
                  <td className="py-2.5 pl-4 pr-2 whitespace-nowrap">
                    <div className="text-[12.5px] text-text tnum">{fmtDate(w.date)}</div>
                    <div className="text-[10.5px] text-text-muted tnum">{fmtTime(w.date)}</div>
                  </td>
                  <td className="py-2.5 px-2 text-text">{w.account}</td>
                  <td className="py-2.5 px-2 text-right tnum font-semibold text-text">{fmtBRLdec(w.amount)}</td>
                  <td className="py-2.5 px-2"><Badge tone={st.tone}>{st.label}</Badge></td>
                  <td className="py-2.5 pl-2 pr-4 text-text-muted tnum">{w.status === 'completed' ? fmtDateTime(w.concluded) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ── Invoices ─────────────────────────────────────────────── */

function InvoicesSection({ data }: { data: Invoice[] }) {
  const totalOpen = data.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.value, 0)
  const openCount = data.filter((i) => i.status !== 'paid').length
  return (
    <Card
      title="Faturas da plataforma"
      subtitle={`Assinatura + variável por uso · ${openCount} em aberto`}
      action={totalOpen > 0 ? (
        <div className="text-right">
          <div className="text-[10.5px] text-text-muted uppercase tracking-wider font-medium">Em aberto</div>
          <div className="text-[16px] font-semibold tnum text-warning leading-none mt-0.5">{fmtBRLdec(totalOpen)}</div>
        </div>
      ) : undefined}
      noPadding
    >
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-[12.5px] border-collapse min-w-[640px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wider text-text-subtle font-semibold">
              <th className="text-left  font-semibold pl-4 pr-2 py-2.5">Período</th>
              <th className="text-left  font-semibold px-2 py-2.5">Vencimento</th>
              <th className="text-right font-semibold px-2 py-2.5">Valor</th>
              <th className="text-left  font-semibold px-2 py-2.5">Status</th>
              <th className="text-right pl-2 pr-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((inv) => {
              const st = invStatusMap[inv.status]
              return (
                <tr key={inv.id} className="border-t border-border hover:bg-surface-2/40">
                  <td className="py-2.5 pl-4 pr-2 text-text">{inv.period}</td>
                  <td className="py-2.5 px-2 text-text-muted tnum">{fmtDate(inv.due)}</td>
                  <td className="py-2.5 px-2 text-right tnum font-semibold text-text">{fmtBRLdec(inv.value)}</td>
                  <td className="py-2.5 px-2"><Badge tone={st.tone}>{st.label}</Badge></td>
                  <td className="py-2.5 pl-2 pr-4 text-right">
                    <div className="inline-flex items-center gap-0.5">
                      {inv.status !== 'paid' && (
                        <Btn variant="ghost" size="sm" iconName="credit-card">Pagar</Btn>
                      )}
                      <button className="h-8 w-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text focus-ring" title="Baixar PDF">
                        <Download size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ── Withdraw modal ───────────────────────────────────────── */

function CurrencyInput({ valueCents, onChange, error }: { valueCents: number; onChange: (v: number) => void; error?: string | null }) {
  const formatted = useMemo(() => (valueCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [valueCents])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    onChange(parseInt(digits || '0', 10))
  }

  return (
    <div>
      <label className="block text-[12.5px] font-medium text-text mb-1.5">Valor do saque</label>
      <div className={cn(
        'relative flex items-center bg-surface border rounded-lg transition-colors focus-within:ring-2 focus-within:ring-primary/30',
        error ? 'border-danger focus-within:border-danger focus-within:ring-danger/25' : 'border-border focus-within:border-primary/60',
      )}>
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-[15px] font-medium">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={formatted}
          onChange={handleChange}
          autoFocus
          className="w-full h-14 pl-11 pr-3 bg-transparent text-[24px] font-semibold tnum text-text focus:outline-none placeholder:text-text-subtle"
        />
      </div>
      {error && (
        <div className="mt-1.5 flex items-center gap-1 text-[11.5px] text-danger">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

function WithdrawModal({ open, onClose, saldoDisponivel, contas }: {
  open: boolean; onClose: () => void; saldoDisponivel: number; contas: Conta[]
}) {
  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form')
  const [valorCents, setValorCents] = useState(0)
  const [contaId, setContaId] = useState(contas[0].id)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) { setStep('form'); setValorCents(0); setContaId(contas[0].id); setLoading(false) }
  }, [open, contas])

  const valor = valorCents / 100
  const conta = contas.find((c) => c.id === contaId)!

  const error = valor <= 0 ? null : valor > saldoDisponivel ? `Valor acima do saldo disponível (${fmtBRLdec(saldoDisponivel)}).` : null
  const canContinue = valor > 0 && !error

  function handleQuick(pct: number) { setValorCents(Math.floor(saldoDisponivel * pct * 100)) }

  function handleConfirm() {
    setLoading(true)
    setTimeout(() => { setLoading(false); setStep('success') }, 1200)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 'success' ? null : 'Solicitar saque'}
      subtitle={step === 'form' ? `Saldo disponível: ${fmtBRLdec(saldoDisponivel)}` : null}
      size="md"
      footer={
        step === 'form' ? (
          <>
            <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" iconName="arrow-right" disabled={!canContinue} onClick={() => setStep('confirm')}>Continuar</Btn>
          </>
        ) : step === 'confirm' ? (
          <>
            <Btn variant="secondary" iconName="arrow-left" onClick={() => setStep('form')}>Voltar</Btn>
            <Btn variant="primary" onClick={handleConfirm} disabled={loading}>
              {loading ? <><Spinner /> Processando…</> : 'Confirmar saque'}
            </Btn>
          </>
        ) : (
          <Btn variant="primary" onClick={onClose} className="ml-auto">Fechar</Btn>
        )
      }
    >
      {step === 'form' && (
        <div className="space-y-4 fade-up">
          <CurrencyInput valueCents={valorCents} onChange={setValorCents} error={error} />

          <div className="flex gap-1.5">
            {([{ label: '25%', pct: 0.25 }, { label: '50%', pct: 0.50 }, { label: '75%', pct: 0.75 }, { label: 'Tudo', pct: 1 }]).map((q) => (
              <button
                key={q.label}
                onClick={() => handleQuick(q.pct)}
                className="flex-1 h-8 text-[12px] font-medium bg-surface-2 hover:bg-surface-3 border border-border text-text-muted hover:text-text rounded-md focus-ring tnum"
              >
                {q.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">Conta de destino</label>
            <div className="space-y-2">
              {contas.map((c) => (
                <label
                  key={c.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    contaId === c.id ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:bg-surface-2',
                  )}
                >
                  <input type="radio" name="conta" checked={contaId === c.id} onChange={() => setContaId(c.id)} className="sr-only" />
                  <span className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0', contaId === c.id ? 'border-primary' : 'border-border-strong')}>
                    {contaId === c.id && <span className="w-2 h-2 rounded-full bg-primary" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-text truncate">{c.label}</div>
                    <div className="text-[11px] text-text-muted">{c.bank} · {c.kind}</div>
                  </div>
                  <Icon name={c.id === 'pix' ? 'zap' : 'landmark'} size={15} className="text-text-muted" />
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 bg-surface-2/50 border border-border rounded-lg p-3">
            <Info size={14} className="text-text-muted mt-0.5 shrink-0" />
            <div className="text-[11.5px] text-text-muted leading-relaxed">
              Saques via Pix são processados em até <strong className="text-text">1 dia útil</strong>. Não há taxa adicional sobre o valor solicitado.
            </div>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4 fade-up">
          <div className="bg-surface-2/50 border border-border rounded-lg p-4">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-text-subtle">Valor a sacar</div>
            <div className="text-[32px] font-semibold tnum text-text leading-none mt-1.5 tracking-tight">{fmtBRLdec(valor)}</div>
            <div className="text-[11.5px] text-text-muted mt-1.5 tnum">Saldo após o saque: {fmtBRLdec(saldoDisponivel - valor)}</div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-4 space-y-2.5">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-text-subtle">Destino</div>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-md bg-surface-2 text-text-muted flex items-center justify-center">
                <Icon name={conta.id === 'pix' ? 'zap' : 'landmark'} size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-text truncate">{conta.label}</div>
                <div className="text-[11px] text-text-muted">{conta.bank} · {conta.kind}</div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-warning-soft border border-warning/30 rounded-lg p-3">
            <AlertTriangle size={14} className="text-warning mt-0.5 shrink-0" />
            <div className="text-[11.5px] text-warning leading-relaxed">
              Confirme os dados antes de prosseguir. Saques solicitados não podem ser cancelados após confirmação.
            </div>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="text-center py-6 fade-up">
          <div className="w-14 h-14 mx-auto rounded-full bg-success-soft text-success flex items-center justify-center mb-4">
            <Check size={26} />
          </div>
          <h3 className="text-[16px] font-semibold text-text">Saque solicitado</h3>
          <p className="text-[12.5px] text-text-muted mt-1.5 max-w-xs mx-auto">
            <span className="text-text font-medium tnum">{fmtBRLdec(valor)}</span> serão transferidos para <span className="text-text">{conta.label}</span> em até 1 dia útil.
          </p>
        </div>
      )}
    </Modal>
  )
}

/* ── Page ─────────────────────────────────────────────────── */

const tabsDef = [
  { id: 'tx',        label: 'Transações', icon: 'arrow-left-right'   },
  { id: 'withdraws', label: 'Saques',     icon: 'arrow-up-from-line' },
  { id: 'invoices',  label: 'Faturas',    icon: 'file-text'          },
]

export default function FinancePage() {
  const [tab, setTab] = useState('tx')
  const [modalOpen, setModalOpen] = useState(false)

  const m = financeMock
  const openInvCount = m.invoices.filter((i) => i.status !== 'paid').length

  function handleExport() {
    const today = new Date().toISOString().slice(0, 10)
    if (tab === 'tx') {
      exportCSV(`transacoes_${today}.csv`,
        ['ID', 'Data', 'Tipo', 'Descrição', 'Valor (R$)', 'Status'],
        m.transactions.map((t) => [
          t.id, t.dt, txTypeMap[t.type]?.label ?? t.type,
          t.desc, t.value, txStatusMap[t.status]?.label ?? t.status,
        ]),
      )
    } else if (tab === 'withdraws') {
      exportCSV(`saques_${today}.csv`,
        ['ID', 'Solicitado em', 'Conta', 'Valor (R$)', 'Status', 'Concluído'],
        m.withdrawals.map((w) => [
          w.id, w.date, w.account, w.amount, wdStatusMap[w.status]?.label ?? w.status, w.concluded ?? '',
        ]),
      )
    } else {
      exportCSV(`faturas_${today}.csv`,
        ['ID', 'Período', 'Vencimento', 'Valor (R$)', 'Status'],
        m.invoices.map((i) => [
          i.id, i.period, i.due, i.value, invStatusMap[i.status]?.label ?? i.status,
        ]),
      )
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
