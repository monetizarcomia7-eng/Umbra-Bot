'use client'

import { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import {
  BookOpen, Plus, CheckCircle2, X, Webhook, Send, AlertTriangle,
  ChevronUp, ChevronDown, Zap, RotateCw, Eye, EyeOff, Copy, Check,
  RefreshCw, AlertCircle, Trash2, Pencil, XCircle, Globe,
} from 'lucide-react'

/* ============================================================
   Types
   ============================================================ */

interface Delivery {
  id: string; event: string; dt: number; status: number
  ms: number; success: boolean; attempt: number
}

interface WebhookItem {
  id: string; name: string; url: string; events: string[]
  secret: string; status: 'healthy' | 'failing' | 'paused'
  active: boolean; createdAt: number; lastDelivery: number | null
  deliveries24h: number; successRate: number; deliveries: Delivery[]
}

/* ============================================================
   Event catalogue
   ============================================================ */

const eventCatalogue = [
  { id: 'sale.approved',         label: 'sale.approved',         desc: 'Venda aprovada e paga.',                  group: 'Vendas' },
  { id: 'sale.pending',          label: 'sale.pending',          desc: 'Venda iniciada, pagamento pendente.',     group: 'Vendas' },
  { id: 'sale.refunded',         label: 'sale.refunded',         desc: 'Venda estornada.',                        group: 'Vendas' },
  { id: 'sale.chargeback',       label: 'sale.chargeback',       desc: 'Chargeback recebido do gateway.',         group: 'Vendas' },
  { id: 'lead.created',          label: 'lead.created',          desc: 'Novo lead capturado no funil.',           group: 'Leads' },
  { id: 'lead.tagged',           label: 'lead.tagged',           desc: 'Tag aplicada a um lead.',                 group: 'Leads' },
  { id: 'lead.unsubscribed',     label: 'lead.unsubscribed',     desc: 'Lead saiu do bot ou bloqueou.',           group: 'Leads' },
  { id: 'subscription.created',  label: 'subscription.created',  desc: 'Nova assinatura ativada.',                group: 'Assinaturas' },
  { id: 'subscription.canceled', label: 'subscription.canceled', desc: 'Assinatura cancelada.',                   group: 'Assinaturas' },
  { id: 'subscription.renewed',  label: 'subscription.renewed',  desc: 'Renovação cobrada com sucesso.',          group: 'Assinaturas' },
  { id: 'bot.disconnected',      label: 'bot.disconnected',      desc: 'Bot perdeu conexão com o Telegram.',      group: 'Sistema' },
  { id: 'flow.completed',        label: 'flow.completed',        desc: 'Lead chegou ao final de um fluxo.',       group: 'Sistema' },
]

const NOW_W = new Date('2026-05-18T15:30:00').getTime()

const whStatusMap: Record<string, { label: string; tone: string; dot: string; pulse: boolean }> = {
  healthy: { label: 'Saudável',       tone: 'success', dot: 'bg-green-500',             pulse: true  },
  failing: { label: 'Falhas recentes', tone: 'danger',  dot: 'bg-red-500',               pulse: false },
  paused:  { label: 'Pausado',        tone: 'muted',   dot: 'bg-[var(--text-muted)]',   pulse: false },
}

/* ============================================================
   Static mock deliveries
   ============================================================ */

const D_CRM: Delivery[] = [
  { id: 'd0', event: 'sale.approved', dt: NOW_W -   3*60*1000, status: 200, ms: 145,  success: true,  attempt: 1 },
  { id: 'd1', event: 'lead.created',  dt: NOW_W -  18*60*1000, status: 200, ms: 280,  success: true,  attempt: 1 },
  { id: 'd2', event: 'lead.tagged',   dt: NOW_W -  33*60*1000, status: 200, ms: 192,  success: true,  attempt: 1 },
  { id: 'd3', event: 'sale.approved', dt: NOW_W -  48*60*1000, status: 200, ms: 318,  success: true,  attempt: 1 },
  { id: 'd4', event: 'lead.created',  dt: NOW_W -  73*60*1000, status: 500, ms: 3218, success: false, attempt: 2 },
  { id: 'd5', event: 'sale.approved', dt: NOW_W -  95*60*1000, status: 200, ms: 225,  success: true,  attempt: 1 },
  { id: 'd6', event: 'lead.tagged',   dt: NOW_W - 120*60*1000, status: 200, ms: 167,  success: true,  attempt: 1 },
  { id: 'd7', event: 'sale.approved', dt: NOW_W - 145*60*1000, status: 200, ms: 204,  success: true,  attempt: 1 },
]
const D_SLACK: Delivery[] = [
  { id: 'ds0', event: 'sale.approved', dt: NOW_W -   8*60*1000, status: 200, ms: 97,  success: true,  attempt: 1 },
  { id: 'ds1', event: 'sale.approved', dt: NOW_W -  65*60*1000, status: 200, ms: 113, success: true,  attempt: 1 },
  { id: 'ds2', event: 'sale.approved', dt: NOW_W - 130*60*1000, status: 200, ms: 88,  success: true,  attempt: 1 },
  { id: 'ds3', event: 'sale.approved', dt: NOW_W - 200*60*1000, status: 200, ms: 102, success: true,  attempt: 1 },
]
const D_TRACKER: Delivery[] = [
  { id: 'dt0', event: 'sale.approved',      dt: NOW_W -  42*60*1000, status: 503, ms: 5100, success: false, attempt: 3 },
  { id: 'dt1', event: 'subscription.created', dt: NOW_W -  80*60*1000, status: 500, ms: 4200, success: false, attempt: 3 },
  { id: 'dt2', event: 'sale.pending',       dt: NOW_W - 110*60*1000, status: 200, ms: 340,  success: true,  attempt: 1 },
  { id: 'dt3', event: 'sale.approved',      dt: NOW_W - 145*60*1000, status: 500, ms: 6800, success: false, attempt: 3 },
  { id: 'dt4', event: 'lead.created',       dt: NOW_W - 180*60*1000, status: 503, ms: 3900, success: false, attempt: 2 },
]
const D_SHEETS: Delivery[] = [
  { id: 'dsh0', event: 'sale.approved', dt: NOW_W -  22*60*1000, status: 200, ms: 520,  success: true,  attempt: 1 },
  { id: 'dsh1', event: 'sale.approved', dt: NOW_W -  90*60*1000, status: 404, ms: 1200, success: false, attempt: 1 },
  { id: 'dsh2', event: 'sale.approved', dt: NOW_W - 160*60*1000, status: 200, ms: 480,  success: true,  attempt: 1 },
  { id: 'dsh3', event: 'sale.approved', dt: NOW_W - 230*60*1000, status: 200, ms: 395,  success: true,  attempt: 1 },
]
const D_MAKE: Delivery[] = [
  { id: 'dm0', event: 'lead.created',  dt: NOW_W - 5*24*3600*1000,           status: 200, ms: 210,  success: true,  attempt: 1 },
  { id: 'dm1', event: 'lead.tagged',   dt: NOW_W - 5*24*3600*1000 - 3600*1000, status: 200, ms: 188,  success: true,  attempt: 1 },
]
const D_BACKUP: Delivery[] = [
  { id: 'db0', event: 'sale.approved', dt: NOW_W -  12*60*1000, status: 200, ms: 128,  success: true,  attempt: 1 },
  { id: 'db1', event: 'sale.refunded', dt: NOW_W -  55*60*1000, status: 200, ms: 154,  success: true,  attempt: 1 },
  { id: 'db2', event: 'sale.approved', dt: NOW_W -  98*60*1000, status: 200, ms: 142,  success: true,  attempt: 1 },
  { id: 'db3', event: 'sale.approved', dt: NOW_W - 130*60*1000, status: 200, ms: 161,  success: true,  attempt: 1 },
  { id: 'db4', event: 'sale.approved', dt: NOW_W - 170*60*1000, status: 200, ms: 137,  success: true,  attempt: 1 },
]

const MOCK_WEBHOOKS: WebhookItem[] = [
  { id: 'wh_001', name: 'CRM principal',           url: 'https://api.minhaempresa.com.br/webhooks/umbra',       events: ['sale.approved','sale.refunded','lead.created','lead.tagged'],                                              secret: 'whsec_R9k8L7m4N2p1Q5x', status: 'healthy', active: true,  createdAt: NOW_W-60*24*3600*1000,  lastDelivery: NOW_W-3*60*1000,          deliveries24h: 482, successRate: 99.4, deliveries: D_CRM },
  { id: 'wh_002', name: 'Slack #vendas',            url: 'https://hooks.slack.com/services/T01XXX/B02YYY/abc',   events: ['sale.approved'],                                                                                           secret: 'whsec_K8m9N3p4Q7r2T6w', status: 'healthy', active: true,  createdAt: NOW_W-30*24*3600*1000,  lastDelivery: NOW_W-8*60*1000,          deliveries24h: 84,  successRate: 100,  deliveries: D_SLACK },
  { id: 'wh_003', name: 'Tracker — integrations',  url: 'https://integrations.com/umbra/receive',               events: ['sale.approved','sale.pending','lead.created','subscription.created','subscription.renewed'],               secret: 'whsec_P3q5R8t1V4w7X9z', status: 'failing', active: true,  createdAt: NOW_W-14*24*3600*1000,  lastDelivery: NOW_W-42*60*1000,         deliveries24h: 312, successRate: 34.2, deliveries: D_TRACKER },
  { id: 'wh_004', name: 'Sheets — Apps Script',    url: 'https://script.google.com/macros/s/AKfycby/exec',      events: ['sale.approved'],                                                                                           secret: 'whsec_J6m8N1p3Q5r7T9w', status: 'healthy', active: true,  createdAt: NOW_W-90*24*3600*1000,  lastDelivery: NOW_W-22*60*1000,         deliveries24h: 84,  successRate: 96.4, deliveries: D_SHEETS },
  { id: 'wh_005', name: 'Make.com — automation',   url: 'https://hook.eu2.make.com/abc123def456ghi',            events: ['lead.created','lead.tagged','flow.completed'],                                                             secret: 'whsec_L4m6N8p2Q4r6T8w', status: 'paused',  active: false, createdAt: NOW_W-7*24*3600*1000,   lastDelivery: NOW_W-5*24*3600*1000,     deliveries24h: 0,   successRate: 92.8, deliveries: D_MAKE },
  { id: 'wh_006', name: 'Backup — armazenamento',  url: 'https://backup.minhaempresa.com.br/v2/receive',         events: ['sale.approved','sale.refunded','sale.chargeback','subscription.created','subscription.canceled'],          secret: 'whsec_X1y2Z3a4B5c6D7e', status: 'healthy', active: true,  createdAt: NOW_W-180*24*3600*1000, lastDelivery: NOW_W-12*60*1000,         deliveries24h: 624, successRate: 99.8, deliveries: D_BACKUP },
]

/* ============================================================
   Helpers
   ============================================================ */

const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
const fmtPct = (n: number, d = 0) => n.toFixed(d).replace('.', ',') + '%'
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function relTimeW(dt: number | null) {
  if (!dt) return '—'
  const s = Math.floor((NOW_W - dt) / 1000)
  if (s < 60) return 'agora'
  const m = Math.floor(s / 60)
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.floor(h / 24)} d`
}

function maskSecret(secret: string) {
  if (!secret) return ''
  return secret.slice(0, 8) + '••••••••'
}

function genSecret() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = 'whsec_'
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

/* ============================================================
   Micro components
   ============================================================ */

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const cls: Record<string, string> = {
    success: 'bg-green-500/10 text-green-600 dark:text-green-400',
    danger:  'bg-red-500/10 text-red-600 dark:text-red-400',
    primary: 'bg-[var(--primary)]/10 text-[var(--primary)]',
    muted:   'bg-[var(--surface-2)] text-[var(--text-muted)]',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-medium ${cls[tone] ?? cls.muted}`}>
      {children}
    </span>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

function CheckboxInline({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button role="checkbox" aria-checked={checked} onClick={onChange}
      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 focus:outline-none ${checked ? 'bg-[var(--primary)] border-[var(--primary)]' : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)]/50'}`}>
      {checked && <Check size={10} className="text-white" />}
    </button>
  )
}

/* ============================================================
   KPI
   ============================================================ */

function KpiW({ label, value, icon: Icon_, tone, highlight }: {
  label: string; value: string; icon: React.ElementType; tone?: string; highlight?: boolean
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[12px] text-[var(--text-muted)] font-medium">{label}</div>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
          tone === 'primary' ? 'bg-[var(--primary)]/10 text-[var(--primary)]' :
          tone === 'danger'  ? 'bg-red-500/10 text-red-500' :
          highlight          ? 'bg-green-500/10 text-green-500' :
          'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}>
          <Icon_ size={14} />
        </div>
      </div>
      <div className={`text-[24px] font-semibold tracking-tight leading-none ${
        tone === 'danger' ? 'text-red-500' : highlight ? 'text-green-500' : 'text-[var(--text)]'}`}>
        {value}
      </div>
    </div>
  )
}

/* ============================================================
   Delivery Row
   ============================================================ */

function DeliveryRow({ delivery, onResend, resending }: { delivery: Delivery; onResend: (id: string) => void; resending: boolean }) {
  return (
    <tr className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]/40 transition-colors">
      <td className="pl-4 pr-2 py-2 whitespace-nowrap">
        {delivery.success
          ? <CheckCircle2 size={13} className="text-green-500" />
          : <XCircle      size={13} className="text-red-500" />}
      </td>
      <td className="px-2 py-2 whitespace-nowrap">
        <code className="text-[11.5px] font-mono text-[var(--text)]">{delivery.event}</code>
      </td>
      <td className="px-2 py-2 whitespace-nowrap">
        <span className={`inline-flex items-center px-1.5 h-5 rounded font-mono text-[10.5px] font-semibold ${
          delivery.status < 300 ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
          delivery.status < 400 ? 'bg-yellow-500/10 text-yellow-600' :
          'bg-red-500/10 text-red-500'}`}>
          {delivery.status}
        </span>
      </td>
      <td className="px-2 py-2 text-right whitespace-nowrap">
        <span className={`text-[11.5px] ${delivery.ms > 3000 ? 'text-red-500' : delivery.ms > 1000 ? 'text-yellow-500' : 'text-[var(--text-muted)]'}`}>
          {delivery.ms} ms
        </span>
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-[11px] text-[var(--text-muted)]">
        {delivery.attempt > 1 && <span className="text-yellow-500">tent. {delivery.attempt}</span>}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-[11px] text-[var(--text-muted)]">
        {fmtTime(delivery.dt)}
      </td>
      <td className="pl-2 pr-4 py-2 text-right">
        <button
          onClick={() => onResend(delivery.id)}
          disabled={resending}
          className="h-7 px-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] rounded-md disabled:opacity-50 focus:outline-none"
        >
          {resending
            ? <div className="w-2.5 h-2.5 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
            : <RotateCw size={10} />}
          Reenviar
        </button>
      </td>
    </tr>
  )
}

/* ============================================================
   Webhook Detail (expanded)
   ============================================================ */

function WebhookDetail({ webhook, onEdit, onDelete, onToggleActive, onResend, resendingId }: {
  webhook: WebhookItem
  onEdit: (w: WebhookItem) => void; onDelete: (id: string) => void
  onToggleActive: (id: string) => void; onResend: (dlvId: string) => void; resendingId: string | null
}) {
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied]         = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  function copySecret() {
    try { navigator.clipboard?.writeText(webhook.secret) } catch (_) {}
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 max-w-[1200px]">
      {/* Delivery log */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <div className="text-[12.5px] font-semibold text-[var(--text)]">Últimas entregas</div>
            <div className="text-[10.5px] text-[var(--text-muted)]">Mostrando as {webhook.deliveries.length} mais recentes</div>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
          <table className="w-full text-[11.5px] border-collapse min-w-[640px]">
            <thead className="sticky top-0 bg-[var(--surface)] z-10">
              <tr className="text-[9.5px] uppercase tracking-wider text-[var(--text-muted)] font-semibold border-b border-[var(--border)]">
                <th className="text-left pl-4 pr-2 py-2 w-8"></th>
                <th className="text-left px-2 py-2">Evento</th>
                <th className="text-left px-2 py-2">Status</th>
                <th className="text-right px-2 py-2">Latência</th>
                <th className="text-left px-2 py-2">Tentativas</th>
                <th className="text-left px-2 py-2">Hora</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {webhook.deliveries.map((d) => (
                <DeliveryRow key={d.id} delivery={d} onResend={onResend} resending={resendingId === d.id} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-3">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3.5">
          <div className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--text-muted)] mb-2.5">Configuração</div>
          <div className="space-y-2.5 text-[11.5px]">
            <div>
              <div className="text-[var(--text-muted)]">URL</div>
              <code className="text-[var(--text)] font-mono break-all block mt-0.5">{webhook.url}</code>
            </div>
            <div>
              <div className="text-[var(--text-muted)]">Secret de assinatura</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <code className="text-[var(--text)] font-mono flex-1 truncate">
                  {showSecret ? webhook.secret : maskSecret(webhook.secret)}
                </code>
                <button onClick={() => setShowSecret((s) => !s)} className="w-6 h-6 inline-flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus:outline-none">
                  {showSecret ? <EyeOff size={11} /> : <Eye size={11} />}
                </button>
                <button onClick={copySecret} className="w-6 h-6 inline-flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus:outline-none">
                  {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                </button>
              </div>
            </div>
            <div>
              <div className="text-[var(--text-muted)]">Criado em</div>
              <div className="text-[var(--text)] mt-0.5">{fmtDate(webhook.createdAt)}</div>
            </div>
            <div>
              <div className="text-[var(--text-muted)]">Eventos ({webhook.events.length})</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {webhook.events.map((e) => (
                  <code key={e} className="text-[9.5px] font-mono px-1.5 h-4 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] leading-none flex items-center">{e}</code>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[12px] font-medium text-[var(--text)]">{webhook.active ? 'Ativo' : 'Pausado'}</div>
              <div className="text-[10.5px] text-[var(--text-muted)]">{webhook.active ? 'Recebendo eventos' : 'Sem entregas'}</div>
            </div>
            <Toggle checked={webhook.active} onChange={() => onToggleActive(webhook.id)} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => onEdit(webhook)}
            className="h-9 px-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors w-full"
          >
            <Pencil size={13} />Editar webhook
          </button>
          {confirmDel ? (
            <div className="flex gap-1">
              <button onClick={() => setConfirmDel(false)} className="flex-1 h-8 px-2 text-[11.5px] text-[var(--text-muted)] rounded-lg border border-[var(--border)] hover:bg-[var(--surface-2)]">Cancelar</button>
              <button onClick={() => onDelete(webhook.id)} className="flex-1 h-8 px-2 text-[11.5px] text-white rounded-lg bg-red-500 hover:bg-red-600 flex items-center justify-center gap-1 transition-colors">
                <Trash2 size={12} />Sim, remover
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(true)} className="h-9 px-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors w-full">
              <Trash2 size={13} />Remover
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Webhook Row (expandable table row)
   ============================================================ */

function WebhookRow({ webhook, expanded, onToggle, onTest, onToggleActive, onEdit, onDelete, onResend, testingId, resendingId }: {
  webhook: WebhookItem; expanded: boolean
  onToggle: () => void; onTest: (id: string) => void; onToggleActive: (id: string) => void
  onEdit: (w: WebhookItem) => void; onDelete: (id: string) => void; onResend: (dlvId: string) => void
  testingId: string | null; resendingId: string | null
}) {
  const st = whStatusMap[webhook.status]
  const testing = testingId === webhook.id

  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-t border-[var(--border)] cursor-pointer transition-colors ${expanded ? 'bg-[var(--surface-2)]/40' : 'hover:bg-[var(--surface-2)]/60'}`}
      >
        <td className="pl-4 pr-2 py-3 max-w-[320px]">
          <div className="flex items-center gap-2">
            <Globe size={13} className="text-[var(--text-muted)] shrink-0" />
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-[var(--text)] truncate">{webhook.name}</div>
              <code className="text-[10.5px] font-mono text-[var(--text-muted)] truncate block">{webhook.url}</code>
            </div>
          </div>
        </td>
        <td className="px-2 py-3 whitespace-nowrap">
          <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
            {webhook.events.slice(0, 2).map((e) => (
              <code key={e} className="text-[10px] font-mono px-1.5 h-5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)]">{e}</code>
            ))}
            {webhook.events.length > 2 && (
              <span className="text-[10.5px] text-[var(--text-muted)]">+{webhook.events.length - 2}</span>
            )}
          </div>
        </td>
        <td className="px-2 py-3 whitespace-nowrap">
          <Badge tone={st.tone}>
            {st.pulse && (
              <span className={`relative w-1.5 h-1.5 rounded-full ${st.dot}`}>
                <span className={`absolute inset-0 rounded-full ${st.dot} animate-ping opacity-60`} />
              </span>
            )}
            {st.label}
          </Badge>
        </td>
        <td className="px-2 py-3 whitespace-nowrap">
          <div className="text-[11.5px] text-[var(--text)]">{relTimeW(webhook.lastDelivery)}</div>
          <div className="text-[10.5px] text-[var(--text-muted)]">
            {fmtNum(webhook.deliveries24h)}/24h · {fmtPct(webhook.successRate, 1)}
          </div>
        </td>
        <td className="pl-2 pr-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onTest(webhook.id)}
              disabled={testing || !webhook.active}
              className="h-7 px-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] rounded-md disabled:opacity-50 focus:outline-none"
            >
              {testing
                ? <div className="w-2.5 h-2.5 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
                : <Zap size={11} />}
              {testing ? 'Testando…' : 'Testar'}
            </button>
            {expanded ? <ChevronUp size={13} className="text-[var(--text-muted)]" /> : <ChevronDown size={13} className="text-[var(--text-muted)]" />}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-[var(--surface-2)]/30 border-t border-[var(--border)]">
          <td colSpan={5} className="px-4 py-4">
            <WebhookDetail
              webhook={webhook}
              onEdit={onEdit} onDelete={onDelete}
              onToggleActive={onToggleActive} onResend={onResend} resendingId={resendingId}
            />
          </td>
        </tr>
      )}
    </>
  )
}

/* ============================================================
   Webhook Form Modal
   ============================================================ */

function WebhookFormModal({ open, onClose, editing, onSave }: {
  open: boolean; onClose: () => void
  editing: WebhookItem | null; onSave: (w: WebhookItem) => void
}) {
  const [name,       setName]       = useState('')
  const [url,        setUrl]        = useState('')
  const [events,     setEvents]     = useState(new Set<string>())
  const [secret,     setSecret]     = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [error,      setError]      = useState('')
  const [copied,     setCopied]     = useState(false)

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name); setUrl(editing.url)
        setEvents(new Set(editing.events)); setSecret(editing.secret)
      } else {
        setName(''); setUrl('')
        setEvents(new Set(['sale.approved'])); setSecret(genSecret())
      }
      setError(''); setShowSecret(false); setCopied(false)
    }
  }, [open, editing])

  function toggleEvent(id: string) {
    setEvents((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function copy() {
    try { navigator.clipboard?.writeText(secret) } catch (_) {}
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }
  function submit() {
    if (!name.trim()) { setError('Informe um nome.'); return }
    if (!/^https?:\/\/.+/.test(url.trim())) { setError('URL inválida — precisa começar com http:// ou https://.'); return }
    if (events.size === 0) { setError('Selecione pelo menos um evento.'); return }
    onSave({
      id:            editing?.id || ('wh_' + Date.now()),
      name:          name.trim(),
      url:           url.trim(),
      events:        Array.from(events),
      secret,
      status:        'healthy',
      active:        editing?.active ?? true,
      createdAt:     editing?.createdAt || Date.now(),
      lastDelivery:  editing?.lastDelivery ?? null,
      deliveries24h: editing?.deliveries24h || 0,
      successRate:   editing?.successRate ?? 100,
      deliveries:    editing?.deliveries || [],
    })
    onClose()
  }

  const grouped = useMemo(() => {
    const g: Record<string, typeof eventCatalogue> = {}
    eventCatalogue.forEach((e) => { if (!g[e.group]) g[e.group] = []; g[e.group].push(e) })
    return g
  }, [])

  const inputW = 'w-full h-10 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50'

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text)]">{editing ? 'Editar webhook' : 'Adicionar webhook'}</h2>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
              {editing ? 'Atualize URL, eventos ou secret.' : 'Receba notificações HTTP de eventos do Umbra Bot em tempo real.'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] focus:outline-none">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-[12px] text-red-500">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />{error}
            </div>
          )}

          <div>
            <label className="block text-[12.5px] font-medium text-[var(--text)] mb-1.5">Nome (apenas referência)</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: CRM principal, Slack #vendas" autoFocus className={inputW} />
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-[var(--text)] mb-1.5">URL do endpoint</label>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.seuservico.com/webhooks/umbra" className={inputW + ' font-mono'} />
          </div>

          {/* Eventos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12.5px] font-medium text-[var(--text)]">
                Eventos assinados ({events.size}/{eventCatalogue.length})
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <button onClick={() => setEvents(new Set(eventCatalogue.map((e) => e.id)))} className="text-[var(--primary)] hover:underline">Marcar todos</button>
                <span className="text-[var(--text-muted)]">·</span>
                <button onClick={() => setEvents(new Set())} className="text-[var(--text-muted)] hover:text-[var(--text)]">Limpar</button>
              </div>
            </div>
            <div className="space-y-3 border border-[var(--border)] rounded-lg p-3 max-h-[260px] overflow-y-auto">
              {Object.entries(grouped).map(([group, list]) => (
                <div key={group}>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)] px-1 mb-1">{group}</div>
                  <div className="space-y-0.5">
                    {list.map((e) => (
                      <label key={e.id} className="flex items-center gap-3 px-2.5 py-1.5 rounded hover:bg-[var(--surface-2)]/50 cursor-pointer">
                        <CheckboxInline checked={events.has(e.id)} onChange={() => toggleEvent(e.id)} />
                        <code className="text-[11.5px] font-mono text-[var(--text)] font-medium shrink-0 min-w-[160px]">{e.label}</code>
                        <span className="flex-1 text-[11.5px] text-[var(--text-muted)] truncate">{e.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Secret */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12.5px] font-medium text-[var(--text)]">Secret de assinatura</label>
              <button onClick={() => setSecret(genSecret())} className="text-[11px] text-[var(--primary)] hover:underline inline-flex items-center gap-1">
                <RefreshCw size={10} />Gerar novo
              </button>
            </div>
            <div className="relative">
              <input type={showSecret ? 'text' : 'password'} value={secret} readOnly
                className={inputW + ' font-mono pr-20 bg-[var(--surface-2)]/40'} />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <button onClick={() => setShowSecret((s) => !s)} className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-2)] focus:outline-none">
                  {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button onClick={copy} className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-2)] focus:outline-none">
                  {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                </button>
              </div>
            </div>
            <div className="text-[10.5px] text-[var(--text-muted)] mt-1 leading-snug">
              O Umbra Bot assina cada requisição com este secret no header <code className="font-mono">X-Umbra-Signature</code> (HMAC SHA-256). Verifique no seu servidor para garantir a origem.
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]">Cancelar</button>
          <button onClick={submit} className="h-9 px-4 text-[13px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 inline-flex items-center gap-1.5">
            <Check size={14} />{editing ? 'Salvar alterações' : 'Adicionar webhook'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   WebhooksPage
   ============================================================ */

export default function WebhooksPage() {
  const [webhooks, setWebhooks]     = useState<WebhookItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<WebhookItem | null>(null)
  const [testingId, setTestingId]   = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [toast, setToast]           = useState('')

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient()
        const { data, error } = await sb.from('webhooks').select('*')
        if (error || !data || data.length === 0) throw new Error('no data')
        setWebhooks(data as WebhookItem[])
      } catch { setWebhooks(MOCK_WEBHOOKS) } finally { setLoading(false) }
    }
    load()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const totals = useMemo(() => {
    const active = webhooks.filter((w) => w.active).length
    const failing = webhooks.filter((w) => w.status === 'failing').length
    const totalDlv = webhooks.reduce((s, w) => s + w.deliveries24h, 0)
    const weighted = webhooks.reduce((s, w) => s + w.successRate * w.deliveries24h, 0)
    const avgRate = totalDlv > 0 ? weighted / totalDlv : 100
    return { active, total: webhooks.length, failing, totalDlv, avgRate }
  }, [webhooks])

  function openAdd()                   { setEditing(null); setModalOpen(true) }
  function openEdit(w: WebhookItem)    { setEditing(w); setModalOpen(true) }

  async function save(w: WebhookItem) {
    setWebhooks((arr) => {
      const idx = arr.findIndex((x) => x.id === w.id)
      if (idx >= 0) { const next = [...arr]; next[idx] = w; setToast('Webhook atualizado.'); return next }
      setToast('Webhook adicionado.')
      return [w, ...arr]
    })
    try {
      const sb = createClient()
      await sb.from('webhooks').upsert({
        id: w.id, name: w.name, url: w.url, events: w.events,
        secret: w.secret, status: w.status, active: w.active,
        created_at: new Date(w.createdAt).toISOString(),
      })
    } catch { /* silent */ }
  }

  function remove(id: string) {
    setWebhooks((arr) => arr.filter((w) => w.id !== id))
    setExpanded(null); setToast('Webhook removido.')
  }

  function toggleActive(id: string) {
    setWebhooks((arr) => arr.map((w) => {
      if (w.id !== id) return w
      const active = !w.active
      return { ...w, active, status: active ? (w.successRate >= 80 ? 'healthy' : 'failing') : 'paused' }
    }))
  }

  function testHook(id: string) {
    setTestingId(id)
    setTimeout(() => {
      const ok = Math.random() > 0.15
      const dlv: Delivery = {
        id: 'dlv_test_' + Date.now(), event: 'test.ping', dt: Date.now(),
        status: ok ? 200 : 503, ms: ok ? 140 + Math.floor(Math.random() * 300) : 3000 + Math.floor(Math.random() * 5000),
        success: ok, attempt: 1,
      }
      setWebhooks((arr) => arr.map((w) => w.id === id ? { ...w, deliveries: [dlv, ...w.deliveries].slice(0, 25), lastDelivery: dlv.dt } : w))
      setTestingId(null)
      setToast(ok ? 'Teste enviado · resposta 200 OK.' : 'Teste falhou · servidor retornou erro 503.')
    }, 1200)
  }

  function resend(dlvId: string) {
    setResendingId(dlvId)
    setTimeout(() => { setResendingId(null); setToast('Evento reenviado.') }, 900)
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Webhooks"
        subtitle="Notificações HTTP em tempo real para integrações externas."
        actions={
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors">
              <BookOpen size={14} />Documentação
            </button>
            <button onClick={openAdd} className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity">
              <Plus size={15} />Adicionar webhook
            </button>
          </div>
        }
      />

      {/* Toast */}
      {toast && (
        <div className="mb-4 flex items-center gap-2.5 bg-green-500/10 border border-green-500/30 rounded-lg px-3.5 py-2">
          <CheckCircle2 size={15} className="text-green-500" />
          <div className="text-[12.5px] text-green-600 dark:text-green-400 flex-1">{toast}</div>
          <button onClick={() => setToast('')} className="w-6 h-6 inline-flex items-center justify-center rounded-md text-green-500/70 hover:bg-green-500/10 focus:outline-none">
            <X size={11} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
          <div className="w-5 h-5 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin mr-2" />
          Carregando…
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KpiW label="Webhooks ativos"     value={`${totals.active} / ${totals.total}`} icon={Globe}         tone="primary" />
            <KpiW label="Entregas (24h)"       value={fmtNum(totals.totalDlv)}              icon={Send} />
            <KpiW label="Taxa de sucesso"      value={fmtPct(totals.avgRate, 1)}            icon={CheckCircle2}  highlight={totals.avgRate >= 95} />
            <KpiW label="Com falhas recentes"  value={fmtNum(totals.failing)}               icon={AlertTriangle} tone={totals.failing > 0 ? 'danger' : undefined} />
          </div>

          {/* Failure banner */}
          {totals.failing > 0 && (
            <div className="mb-4 flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-md bg-red-500 text-white flex items-center justify-center shrink-0">
                <AlertTriangle size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-red-500">
                  {totals.failing} {totals.failing === 1 ? 'webhook com falhas recentes' : 'webhooks com falhas recentes'}
                </div>
                <div className="text-[11.5px] text-[var(--text-muted)] leading-relaxed mt-0.5">
                  Verifique os endpoints com taxa de erro alta. Eventos com 5xx ou timeout são reenviados automaticamente até 3 vezes em backoff exponencial.
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            {webhooks.length === 0 ? (
              <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] mb-4">
                  <Globe size={20} />
                </div>
                <div className="text-[14px] font-semibold text-[var(--text)]">Nenhum webhook configurado</div>
                <div className="text-[12.5px] text-[var(--text-muted)] mt-1 max-w-xs">Adicione seu primeiro endpoint pra começar a receber eventos.</div>
                <button onClick={openAdd} className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 text-[12.5px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity">
                  <Plus size={14} />Adicionar webhook
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px] border-collapse min-w-[900px]">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                      <th className="text-left font-semibold pl-4 pr-2 py-2.5">Endpoint</th>
                      <th className="text-left font-semibold px-2 py-2.5">Eventos</th>
                      <th className="text-left font-semibold px-2 py-2.5">Status</th>
                      <th className="text-left font-semibold px-2 py-2.5">Última entrega</th>
                      <th className="w-44"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhooks.map((w) => (
                      <WebhookRow
                        key={w.id} webhook={w} expanded={expanded === w.id}
                        onToggle={() => setExpanded((id) => (id === w.id ? null : w.id))}
                        onTest={testHook} onToggleActive={toggleActive}
                        onEdit={openEdit} onDelete={remove} onResend={resend}
                        testingId={testingId} resendingId={resendingId}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <WebhookFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} onSave={save} />
    </DashboardLayout>
  )
}
