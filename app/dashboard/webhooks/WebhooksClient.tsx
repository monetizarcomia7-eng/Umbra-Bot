'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { useAnalytics } from '@/hooks/use-analytics'
import {
  BookOpen, Plus, CheckCircle2, X, Webhook, Send, AlertTriangle,
  ChevronUp, ChevronDown, Zap, RotateCw, Eye, EyeOff, Copy, Check,
  RefreshCw, AlertCircle, Trash2, Pencil, XCircle, Globe, Loader2, ExternalLink,
} from 'lucide-react'
import type { RawWebhookRow } from './page'
import {
  createWebhookAction,
  updateWebhookAction,
  deleteWebhookAction,
  toggleWebhookAction,
  testWebhookAction,
  generateSecretAction,
  loadDeliveriesAction,
  resendDeliveryAction,
  type RawDelivery,
  type WebhookPayload,
} from '@/app/actions/webhooks'

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface WebhookItem {
  id:            string
  name:          string
  url:           string
  events:        string[]
  status:        'healthy' | 'failing' | 'paused'
  active:        boolean
  deliveries24h: number
  successRate:   number
  lastDelivery:  number | null
  createdAt:     number
}

/* ── Event catalogue ────────────────────────────────────────────────────────── */

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

const whStatusMap: Record<string, { label: string; tone: string; dot: string; pulse: boolean }> = {
  healthy: { label: 'Saudável',        tone: 'success', dot: 'bg-green-500',           pulse: true  },
  failing: { label: 'Falhas recentes', tone: 'danger',  dot: 'bg-red-500',             pulse: false },
  paused:  { label: 'Pausado',         tone: 'muted',   dot: 'bg-[var(--text-muted)]', pulse: false },
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

const fmtNum  = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
const fmtPct  = (n: number, d = 0) => n.toFixed(d).replace('.', ',') + '%'
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function relTime(dt: number | null, now: number) {
  if (!dt) return '—'
  const s = Math.floor((now - dt) / 1000)
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

function mapRaw(row: RawWebhookRow): WebhookItem {
  return {
    id:            row.id,
    name:          row.name,
    url:           row.url,
    events:        row.events ?? [],
    status:        row.status,
    active:        row.active,
    deliveries24h: row.deliveries_24h,
    successRate:   Number(row.success_rate),
    lastDelivery:  row.last_delivery ?? null,
    createdAt:     new Date(row.created_at).getTime(),
  }
}

/* ── Micro components ───────────────────────────────────────────────────────── */

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

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      role="switch" aria-checked={checked} onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${checked ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

function CheckboxInline({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="checkbox" aria-checked={checked} onClick={onChange}
      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 focus:outline-none ${checked ? 'bg-[var(--primary)] border-[var(--primary)]' : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)]/50'}`}
    >
      {checked && <Check size={10} className="text-white" />}
    </button>
  )
}

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
          'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
        >
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

/* ── Delivery Row ───────────────────────────────────────────────────────────── */

function DeliveryRow({ delivery, now, onResend, resending }: {
  delivery: RawDelivery; now: number; onResend: (id: string) => void; resending: boolean
}) {
  const status = delivery.response_status
  return (
    <tr className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]/40 transition-colors">
      <td className="pl-4 pr-2 py-2 whitespace-nowrap">
        {delivery.success
          ? <CheckCircle2 size={13} className="text-green-500" />
          : <XCircle      size={13} className="text-red-500" />}
      </td>
      <td className="px-2 py-2 whitespace-nowrap">
        <code className="text-[11.5px] font-mono text-[var(--text)]">{delivery.event_type}</code>
      </td>
      <td className="px-2 py-2 whitespace-nowrap">
        <span className={`inline-flex items-center px-1.5 h-5 rounded font-mono text-[10.5px] font-semibold ${
          !status                  ? 'bg-[var(--surface-2)] text-[var(--text-muted)]' :
          status < 300             ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
          status < 400             ? 'bg-yellow-500/10 text-yellow-600' :
          'bg-red-500/10 text-red-500'}`}>
          {status ?? '—'}
        </span>
      </td>
      <td className="px-2 py-2 text-right whitespace-nowrap">
        <span className={`text-[11.5px] ${!delivery.duration_ms ? 'text-[var(--text-muted)]' : delivery.duration_ms > 3000 ? 'text-red-500' : delivery.duration_ms > 1000 ? 'text-yellow-500' : 'text-[var(--text-muted)]'}`}>
          {delivery.duration_ms != null ? `${delivery.duration_ms} ms` : '—'}
        </span>
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-[11px] text-[var(--text-muted)]">
        {delivery.attempt > 1 && <span className="text-yellow-500">tent. {delivery.attempt}</span>}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-[11px] text-[var(--text-muted)]">
        {fmtTime(new Date(delivery.created_at).getTime())}
      </td>
      <td className="pl-2 pr-4 py-2 text-right">
        <button
          onClick={() => onResend(delivery.id)}
          disabled={resending}
          className="h-7 px-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] rounded-md disabled:opacity-50 focus:outline-none"
        >
          {resending ? <Loader2 size={10} className="animate-spin" /> : <RotateCw size={10} />}
          Reenviar
        </button>
      </td>
    </tr>
  )
}

/* ── Webhook Detail ─────────────────────────────────────────────────────────── */

function WebhookDetail({ webhook, now, onEdit, onDelete, onToggleActive, toggling, onResend, resendingId }: {
  webhook: WebhookItem; now: number
  onEdit: (w: WebhookItem) => void; onDelete: (id: string) => void
  onToggleActive: (id: string) => void; toggling: boolean
  onResend: (dlvId: string) => void; resendingId: string | null
}) {
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied]         = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [deliveries, setDeliveries] = useState<RawDelivery[] | null>(null)
  const [loadingDlv, setLoadingDlv] = useState(false)
  const [dlvPage, setDlvPage]       = useState(0)
  const [hasMoreDlv, setHasMoreDlv] = useState(true)

  // Carrega primeiras entregas ao montar
  useEffect(() => {
    let cancelled = false
    setLoadingDlv(true)
    loadDeliveriesAction(webhook.id, 0).then((rows) => {
      if (cancelled) return
      setDeliveries(rows)
      setHasMoreDlv(rows.length === 20)
      setDlvPage(0)
    }).catch(() => {
      if (!cancelled) setDeliveries([])
    }).finally(() => {
      if (!cancelled) setLoadingDlv(false)
    })
    return () => { cancelled = true }
  }, [webhook.id])

  async function loadMoreDlv() {
    const nextPage = dlvPage + 1
    const rows = await loadDeliveriesAction(webhook.id, nextPage).catch(() => [])
    setDeliveries((prev) => [...(prev ?? []), ...rows])
    setHasMoreDlv(rows.length === 20)
    setDlvPage(nextPage)
  }

  function copySecret() {
    // Não expõe o secret descriptografado — apenas o valor mascarado exibido
    try { navigator.clipboard?.writeText(maskSecret('')) } catch (_) {}
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  async function handleDelete() {
    setDeleting(true)
    try { await onDelete(webhook.id) } finally { setDeleting(false); setConfirmDel(false) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 max-w-[1200px]">
      {/* Delivery log */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <div className="text-[12.5px] font-semibold text-[var(--text)]">Últimas entregas</div>
            <div className="text-[10.5px] text-[var(--text-muted)]">
              {loadingDlv ? 'Carregando…' : deliveries !== null ? `${deliveries.length} entrega(s) exibida(s)` : ''}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
          {loadingDlv ? (
            <div className="py-8 flex justify-center text-[var(--text-muted)]">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : deliveries !== null && deliveries.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[var(--text-muted)]">
              Nenhuma entrega registrada ainda.
            </div>
          ) : (
            <>
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
                  {(deliveries ?? []).map((d) => (
                    <DeliveryRow
                      key={d.id}
                      delivery={d}
                      now={now}
                      onResend={onResend}
                      resending={resendingId === d.id}
                    />
                  ))}
                </tbody>
              </table>
              {hasMoreDlv && (
                <div className="px-4 py-2 border-t border-[var(--border)]">
                  <button
                    onClick={loadMoreDlv}
                    className="text-[11.5px] text-[var(--primary)] hover:underline"
                  >
                    Carregar mais entregas
                  </button>
                </div>
              )}
            </>
          )}
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
                <code className="text-[var(--text)] font-mono flex-1 truncate text-[10.5px]">
                  {showSecret ? '(descriptografado só no servidor)' : 'whsec_••••••••'}
                </code>
                <button
                  onClick={() => setShowSecret((s) => !s)}
                  className="w-6 h-6 inline-flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-2)] focus:outline-none"
                >
                  {showSecret ? <EyeOff size={11} /> : <Eye size={11} />}
                </button>
                <button
                  onClick={copySecret}
                  className="w-6 h-6 inline-flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-2)] focus:outline-none"
                >
                  {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                </button>
              </div>
              {showSecret && (
                <p className="text-[10.5px] text-[var(--text-muted)] mt-1 leading-snug">
                  Por segurança, o secret é criptografado no banco (AES-256-GCM) e descriptografado apenas no servidor durante o envio.
                </p>
              )}
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
            <Toggle checked={webhook.active} onChange={() => onToggleActive(webhook.id)} disabled={toggling} />
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
              <button onClick={() => setConfirmDel(false)} className="flex-1 h-8 px-2 text-[11.5px] text-[var(--text-muted)] rounded-lg border border-[var(--border)] hover:bg-[var(--surface-2)]">
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-8 px-2 text-[11.5px] text-white rounded-lg bg-red-500 hover:bg-red-600 flex items-center justify-center gap-1 transition-colors disabled:opacity-60"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Sim, remover
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

/* ── Webhook Row ────────────────────────────────────────────────────────────── */

function WebhookRow({ webhook, expanded, now, onToggle, onTest, onToggleActive, toggling, onEdit, onDelete, onResend, testingId, resendingId }: {
  webhook: WebhookItem; expanded: boolean; now: number
  onToggle: () => void; onTest: (id: string) => void
  onToggleActive: (id: string) => void; toggling: boolean
  onEdit: (w: WebhookItem) => void; onDelete: (id: string) => void; onResend: (dlvId: string) => void
  testingId: string | null; resendingId: string | null
}) {
  const st      = whStatusMap[webhook.status]
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
          <div className="text-[11.5px] text-[var(--text)]">{relTime(webhook.lastDelivery, now)}</div>
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
              {testing ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
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
              now={now}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
              toggling={toggling}
              onResend={onResend}
              resendingId={resendingId}
            />
          </td>
        </tr>
      )}
    </>
  )
}

/* ── Webhook Form Modal ─────────────────────────────────────────────────────── */

function WebhookFormModal({ open, onClose, editing, onSaved }: {
  open: boolean; onClose: () => void
  editing: WebhookItem | null
  onSaved: (id: string, isNew: boolean, data: Partial<WebhookItem>) => void
}) {
  const [name,       setName]       = useState('')
  const [url,        setUrl]        = useState('')
  const [events,     setEvents]     = useState(new Set<string>())
  const [secret,     setSecret]     = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [error,      setError]      = useState('')
  const [copied,     setCopied]     = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [genning,    setGenning]    = useState(false)

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name); setUrl(editing.url)
        setEvents(new Set(editing.events))
        setSecret('(mantido — rotacione para alterar)')
      } else {
        setName(''); setUrl('')
        setEvents(new Set(['sale.approved']))
        generateSecretAction().then(setSecret).catch(() => {})
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
  async function rotateSecret() {
    setGenning(true)
    try {
      const s = await generateSecretAction()
      setSecret(s)
    } finally { setGenning(false) }
  }

  async function submit() {
    setError('')
    if (!name.trim()) { setError('Informe um nome.'); return }
    if (events.size === 0) { setError('Selecione pelo menos um evento.'); return }

    const payload: WebhookPayload = {
      name:   name.trim(),
      url:    url.trim(),
      events: Array.from(events),
      secret,
    }

    setSaving(true)
    try {
      if (editing) {
        const patch: Partial<WebhookPayload> = { name: payload.name, url: payload.url, events: payload.events }
        if (!secret.startsWith('(mantido')) patch.secret = secret
        await updateWebhookAction(editing.id, patch)
        onSaved(editing.id, false, { name: payload.name, url: payload.url, events: payload.events })
      } else {
        const { id } = await createWebhookAction(payload)
        onSaved(id, true, { name: payload.name, url: payload.url, events: payload.events, status: 'healthy', active: true, deliveries24h: 0, successRate: 100, lastDelivery: null, createdAt: Date.now() })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar webhook.')
    } finally {
      setSaving(false)
    }
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

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12.5px] font-medium text-[var(--text)]">Secret de assinatura</label>
              <button onClick={rotateSecret} disabled={genning} className="text-[11px] text-[var(--primary)] hover:underline inline-flex items-center gap-1 disabled:opacity-50">
                {genning ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                {editing ? 'Rotacionar secret' : 'Gerar novo'}
              </button>
            </div>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={editing ? undefined : (e) => setSecret(e.target.value)}
                readOnly={!!editing && secret.startsWith('(mantido')}
                className={inputW + ' font-mono pr-20 bg-[var(--surface-2)]/40'}
              />
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
              O Umbra Bot assina cada requisição com este secret no header <code className="font-mono">X-Umbra-Signature-256</code> (HMAC SHA-256). Gerado com <code className="font-mono">crypto.randomBytes</code> — seguro criptograficamente.
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="h-9 px-4 text-[13px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {editing ? 'Salvar alterações' : 'Adicionar webhook'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Toast ──────────────────────────────────────────────────────────────────── */

interface ToastItem { msg: string; type: 'success' | 'error' }

/* ── IntegrationsSection ─────────────────────────────────────────────────────── */

const INTEGRATION_PLATFORMS = [
  {
    id: 'zapier',
    name: 'Zapier',
    tagline: '7.000+ apps conectados',
    description: 'Use o trigger "Webhooks by Zapier" para capturar eventos de venda, lead e outros em qualquer fluxo automatizado.',
    color: '#FF4A00',
    bg: 'rgba(255,74,0,0.10)',
    url: 'https://zapier.com/apps/webhook/integrations',
    label: 'Z',
    steps: [
      'Acesse zapier.com e crie um novo Zap',
      'Escolha "Webhooks by Zapier" como trigger e selecione "Catch Hook"',
      'Copie a URL do webhook gerada pelo Zapier',
      'No Umbra Bot, crie um webhook e cole essa URL no campo "URL do endpoint"',
      'Clique em "Testar" para enviar um evento de teste e validar a integração',
    ],
  },
  {
    id: 'make',
    name: 'Make',
    tagline: 'Automação visual',
    description: 'Adicione o módulo "Custom Webhook" em qualquer cenário para receber eventos e processar dados em tempo real.',
    color: '#6D4AFF',
    bg: 'rgba(109,74,255,0.10)',
    url: 'https://www.make.com/en/register',
    label: 'M',
    steps: [
      'Acesse make.com e crie um novo cenário',
      'Adicione o módulo "Webhooks" e escolha "Custom Webhook"',
      'Crie o webhook e copie a URL gerada',
      'No Umbra Bot, crie um webhook e cole essa URL no campo "URL do endpoint"',
      'Execute o cenário e clique em "Testar" no Umbra Bot para disparar',
    ],
  },
  {
    id: 'n8n',
    name: 'n8n',
    tagline: 'Open-source & self-hosted',
    description: 'Adicione o nó "Webhook" no seu workflow para receber e processar eventos com lógica completamente customizada.',
    color: '#EA4B71',
    bg: 'rgba(234,75,113,0.10)',
    url: 'https://n8n.io',
    label: 'n8n',
    steps: [
      'Acesse n8n.io ou sua instância self-hosted',
      'Crie um novo workflow e adicione o nó "Webhook"',
      'Copie a "Production URL" exibida no nó',
      'No Umbra Bot, crie um webhook e cole essa URL no campo "URL do endpoint"',
      'Ative o workflow e clique em "Testar" para confirmar o recebimento',
    ],
  },
  {
    id: 'manychat',
    name: 'ManyChat',
    tagline: 'Automação para Telegram e Instagram',
    description: 'Dispare fluxos no ManyChat a partir de eventos do Umbra Bot usando o gatilho "Webhook" (plano Pro+).',
    color: '#0084FF',
    bg: 'rgba(0,132,255,0.10)',
    url: 'https://manychat.com',
    label: 'MC',
    steps: [
      'Acesse manychat.com e vá em "Automation" → "Flows"',
      'Crie um novo Flow e adicione o gatilho "Webhook" (requer plano Pro ou superior)',
      'Copie a URL do webhook gerada pelo ManyChat',
      'No Umbra Bot, crie um webhook e cole essa URL no campo "URL do endpoint"',
      'Clique em "Testar" para enviar um evento e confirmar que o fluxo foi acionado',
    ],
  },
] as const

function IntegrationsSection() {
  const [openGuide, setOpenGuide] = useState<string | null>(null)

  return (
    <div className="mt-8">
      <div className="mb-4">
        <div className="text-[14px] font-semibold text-[var(--text)]">Integrações</div>
        <div className="text-[12.5px] text-[var(--text-muted)] mt-0.5">
          Conecte o Umbra Bot com plataformas de automação para disparar ações em qualquer app.
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {INTEGRATION_PLATFORMS.map((p) => {
          const isOpen = openGuide === p.id
          return (
            <div key={p.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
              {/* Header */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-bold shrink-0"
                    style={{ background: p.bg, color: p.color }}
                  >
                    {p.label}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[var(--text)]">{p.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{p.tagline}</div>
                  </div>
                </div>
                <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
                  {p.description}
                </p>
              </div>

              {/* Actions */}
              <div className="px-4 pb-3 flex items-center gap-2">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
                >
                  <ExternalLink size={11} />
                  Abrir {p.name}
                </a>
                <button
                  onClick={() => setOpenGuide(isOpen ? null : p.id)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors"
                >
                  {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  {isOpen ? 'Ocultar guia' : 'Ver guia'}
                </button>
              </div>

              {/* Expandable step-by-step guide */}
              {isOpen && (
                <div className="border-t border-[var(--border)] px-4 py-3">
                  <div className="text-[10.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2.5">
                    Passo a passo
                  </div>
                  <ol className="space-y-2.5">
                    {p.steps.map((step, i) => (
                      <li key={i} className="flex gap-2.5 text-[12px] text-[var(--text-muted)]">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                          style={{ background: p.bg, color: p.color }}
                        >
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2.5 text-[11.5px] text-[var(--text-muted)] leading-relaxed">
                    <span className="font-semibold text-[var(--text)]">Dica:</span> após colar a URL, clique em{' '}
                    <span className="font-semibold text-[var(--text)]">&quot;Testar&quot;</span> no Umbra Bot
                    para confirmar que a integração está recebendo eventos corretamente.
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── WebhooksClient ─────────────────────────────────────────────────────────── */

export function WebhooksClient({ initialWebhooks, userId }: {
  initialWebhooks: RawWebhookRow[]
  userId: string
}) {
  const [webhooks, setWebhooks]     = useState<WebhookItem[]>(() => initialWebhooks.map(mapRaw))
  const [now, setNow]               = useState(Date.now)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<WebhookItem | null>(null)
  const [testingId, setTestingId]   = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [toast, setToast]           = useState<ToastItem | null>(null)
  const router                      = useRouter()
  const { track }                   = useAnalytics()

  // Atualiza timestamps relativos a cada 30s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Supabase Realtime — atualiza status e stats em tempo real
  useEffect(() => {
    const sb = createClient()
    const channel = sb
      .channel('webhooks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'webhooks', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as RawWebhookRow
          if (!row?.id) return
          setWebhooks((prev) => prev.map((w) =>
            w.id === row.id
              ? { ...w, status: row.status, active: row.active, deliveries24h: row.deliveries_24h, successRate: Number(row.success_rate), lastDelivery: row.last_delivery }
              : w,
          ))
        },
      )
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [userId])

  // Toast auto-close
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
  }, [])

  const totals = useMemo(() => {
    const active   = webhooks.filter((w) => w.active).length
    const failing  = webhooks.filter((w) => w.status === 'failing').length
    const totalDlv = webhooks.reduce((s, w) => s + w.deliveries24h, 0)
    const weighted = webhooks.reduce((s, w) => s + w.successRate * w.deliveries24h, 0)
    const avgRate  = totalDlv > 0 ? weighted / totalDlv : 100
    return { active, total: webhooks.length, failing, totalDlv, avgRate }
  }, [webhooks])

  function openAdd()                { setEditing(null); setModalOpen(true) }
  function openEdit(w: WebhookItem) { setEditing(w); setModalOpen(true) }

  function handleSaved(id: string, isNew: boolean, data: Partial<WebhookItem>) {
    if (isNew) {
      const newItem: WebhookItem = {
        id,
        name:          data.name ?? '',
        url:           data.url ?? '',
        events:        data.events ?? [],
        status:        'healthy',
        active:        true,
        deliveries24h: 0,
        successRate:   100,
        lastDelivery:  null,
        createdAt:     Date.now(),
      }
      setWebhooks((prev) => [newItem, ...prev])
      showToast('Webhook adicionado com sucesso.')
      track('webhook_created', { url_domain: new URL(data.url ?? 'http://x').hostname, events_count: data.events?.length ?? 0 })
    } else {
      setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, ...data } : w))
      showToast('Webhook atualizado.')
    }
    router.refresh()
  }

  async function handleDelete(id: string) {
    try {
      await deleteWebhookAction(id)
      setWebhooks((prev) => prev.filter((w) => w.id !== id))
      setExpanded(null)
      showToast('Webhook removido.')
      track('webhook_deleted', {})
      router.refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao remover webhook.', 'error')
    }
  }

  async function handleToggleActive(id: string) {
    const current = webhooks.find((w) => w.id === id)
    if (!current) return
    const newActive = !current.active
    setTogglingId(id)
    setWebhooks((prev) => prev.map((w) =>
      w.id === id ? { ...w, active: newActive, status: newActive ? (w.successRate >= 80 ? 'healthy' : 'failing') : 'paused' } : w,
    ))
    try {
      await toggleWebhookAction(id, newActive)
      if (newActive) track('webhook_resumed', {})
      else track('webhook_paused', {})
    } catch (err) {
      // Rollback
      setWebhooks((prev) => prev.map((w) => w.id === id ? current : w))
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar webhook.', 'error')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleTest(id: string) {
    setTestingId(id)
    try {
      const result = await testWebhookAction(id)
      showToast(result.message, result.ok ? 'success' : 'error')
      track('webhook_tested', { success: result.ok, status_code: result.status ?? 0, duration_ms: result.durationMs })
      // Atualiza lastDelivery localmente
      if (result.ok) {
        setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, lastDelivery: Date.now() } : w))
      }
      // Expande o webhook para mostrar o log de entregas
      setExpanded(id)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao testar webhook.', 'error')
    } finally {
      setTestingId(null)
    }
  }

  async function handleResend(dlvId: string) {
    setResendingId(dlvId)
    try {
      const result = await resendDeliveryAction(dlvId)
      showToast(result.message, result.ok ? 'success' : 'error')
      track('delivery_resent', { event_type: 'unknown', attempt: 1 })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro no reenvio.', 'error')
    } finally {
      setResendingId(null)
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Webhooks"
        subtitle="Notificações HTTP em tempo real para integrações externas."
        actions={
          <div className="flex items-center gap-2">
            <a
              href="/dashboard/docs"
              className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <BookOpen size={14} />Documentação
            </a>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 h-9 px-4 text-[13px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={15} />Adicionar webhook
            </button>
          </div>
        }
      />

      {/* Toast */}
      {toast && (
        <div className={`mb-4 flex items-center gap-2.5 border rounded-lg px-3.5 py-2 ${
          toast.type === 'error'
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-green-500/10 border-green-500/30'}`}>
          {toast.type === 'error'
            ? <AlertCircle size={15} className="text-red-500 shrink-0" />
            : <CheckCircle2 size={15} className="text-green-500 shrink-0" />}
          <div className={`text-[12.5px] flex-1 ${toast.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {toast.msg}
          </div>
          <button onClick={() => setToast(null)} className="w-6 h-6 inline-flex items-center justify-center rounded-md opacity-70 hover:opacity-100 focus:outline-none">
            <X size={11} />
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiW label="Webhooks ativos"     value={`${totals.active} / ${totals.total}`} icon={Globe}        tone="primary" />
        <KpiW label="Entregas (24h)"      value={fmtNum(totals.totalDlv)}              icon={Send} />
        <KpiW label="Taxa de sucesso"     value={fmtPct(totals.avgRate, 1)}            icon={CheckCircle2} highlight={totals.avgRate >= 95} />
        <KpiW label="Com falhas recentes" value={String(totals.failing)}               icon={AlertTriangle} tone={totals.failing > 0 ? 'danger' : undefined} />
      </div>

      {/* Banner de falhas */}
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
              Verifique os endpoints com taxa de erro alta. Clique em um webhook para ver o histórico de entregas e reenviar eventos falhos.
            </div>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        {webhooks.length === 0 ? (
          <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] mb-4">
              <Webhook size={20} />
            </div>
            <div className="text-[14px] font-semibold text-[var(--text)]">Nenhum webhook configurado</div>
            <div className="text-[12.5px] text-[var(--text-muted)] mt-1 max-w-xs">
              Adicione seu primeiro endpoint para receber eventos do Umbra Bot em tempo real.
            </div>
            <button
              onClick={openAdd}
              className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 text-[12.5px] font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
            >
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
                    key={w.id}
                    webhook={w}
                    expanded={expanded === w.id}
                    now={now}
                    onToggle={() => setExpanded((id) => (id === w.id ? null : w.id))}
                    onTest={handleTest}
                    onToggleActive={handleToggleActive}
                    toggling={togglingId === w.id}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onResend={handleResend}
                    testingId={testingId}
                    resendingId={resendingId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Integrações */}
      <IntegrationsSection />

      <WebhookFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSaved={handleSaved}
      />
    </DashboardLayout>
  )
}
