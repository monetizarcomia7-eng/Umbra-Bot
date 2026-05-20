'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import {
  Send, Key, QrCode, PlayCircle, Upload, Download, Stethoscope, Eraser,
  ArrowUpRight, Bot, CheckCircle2, XCircle, Check, Info, AlertCircle, X,
  GitBranch, Layers, CreditCard, Link, Tag, Webhook, FileText,
  AlertTriangle, Inbox, Globe, Database, Play, HelpCircle,
} from 'lucide-react'
import { validateBotTokenAction } from '@/app/actions/bots'
import {
  testMessageAction,
  checkBotsAction, checkWebhooksAction, checkGatewaysAction,
  checkQueueAction, checkDnsAction, checkStorageAction,
  getExportCountsAction, exportConfigAction, importConfigAction,
  clearCacheAction,
} from '@/app/actions/tools'
import { useAnalytics } from '@/hooks/use-analytics'
import type { RawBot, RawFlow } from './page'

/* ── Types ───────────────────────────────────────────────────────── */

interface FlowNode {
  id:       string
  type:     string
  position: { x: number; y: number }
  data:     Record<string, unknown>
}

interface FlowEdge {
  id:           string
  source:       string
  target:       string
  sourceHandle?: string
}

type FlowStep =
  | { kind: 'message';  text: string }
  | { kind: 'incoming'; text: string }
  | { kind: 'buttons';  text: string; options: string[] }
  | { kind: 'delay';    amount: number; unit: string }
  | { kind: 'offer';    product: string; price: number; cta: string }

type DiagStatus = 'idle' | 'running' | 'pass' | 'fail'

interface DiagResult { status: DiagStatus; detail: string }

interface ExportCounts {
  bots: number; flows: number; sequences: number; gateways: number
  links: number; contacts: number; tags: number; webhooks: number
}

interface ParsedBackup {
  bots: number; flows: number; sequences: number; gateways: number
  links: number; contacts: number; tags: number; webhooks: number; size: string
}

/* ── Tool list ───────────────────────────────────────────────────── */

const TOOL_LIST = [
  { id: 'test_message',   title: 'Testar envio de mensagem',  description: 'Envie uma mensagem de teste pra um chat ID específico antes de disparar pra base inteira.',   icon: 'send',        color: 'var(--primary)',       category: 'Bots & mensagens' },
  { id: 'validate_token', title: 'Validar token de bot',       description: 'Verifique se um token do BotFather é válido e veja as informações públicas do bot.',            icon: 'key',         color: 'var(--success)',       category: 'Bots & mensagens' },
  { id: 'qr_code',        title: 'Gerar QR code do bot',       description: 'Crie um QR code que abre o Telegram direto na conversa do bot — útil pra material impresso.',   icon: 'qr-code',     color: 'var(--warning)',       category: 'Bots & mensagens' },
  { id: 'preview_flow',   title: 'Prévia de fluxo',            description: 'Simule a execução de um fluxo passo a passo sem precisar disparar um teste real.',             icon: 'play-circle', color: 'oklch(0.62 0.16 200)', category: 'Fluxos' },
  { id: 'import_config',  title: 'Importar configurações',     description: 'Restaure bots, fluxos, tags e gateways a partir de um arquivo JSON exportado.',                icon: 'upload',      color: 'oklch(0.58 0.05 280)', category: 'Configuração' },
  { id: 'export_config',  title: 'Exportar configurações',     description: 'Baixe um JSON com a configuração completa do workspace — backup ou migração entre contas.',     icon: 'download',    color: 'oklch(0.58 0.05 280)', category: 'Configuração' },
  { id: 'diagnostics',    title: 'Diagnóstico do sistema',     description: 'Roda checagens em todos os componentes — bots, gateways, webhooks, DNS, fila de envios.',      icon: 'stethoscope', color: 'var(--danger)',        category: 'Configuração' },
  { id: 'clear_cache',    title: 'Limpar cache do workspace',  description: 'Limpa caches internos. Útil quando informações estão desatualizadas após mudanças.',            icon: 'eraser',      color: 'oklch(0.58 0.05 280)', category: 'Configuração' },
] as const

type ToolId = typeof TOOL_LIST[number]['id']

/* ── Icon system ─────────────────────────────────────────────────── */

const ICON_MAP: Record<string, React.ElementType> = {
  'send': Send, 'key': Key, 'qr-code': QrCode, 'play-circle': PlayCircle,
  'upload': Upload, 'download': Download, 'stethoscope': Stethoscope, 'eraser': Eraser,
  'arrow-up-right': ArrowUpRight, 'bot': Bot, 'check-circle-2': CheckCircle2,
  'x-circle': XCircle, 'check': Check, 'info': Info, 'alert-circle': AlertCircle,
  'x': X, 'git-branch': GitBranch, 'layers': Layers, 'credit-card': CreditCard,
  'link': Link, 'tag': Tag, 'webhook': Webhook, 'file-text': FileText,
  'alert-triangle': AlertTriangle, 'inbox': Inbox, 'globe': Globe,
  'database': Database, 'play': Play,
}

function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const I = ICON_MAP[name] ?? HelpCircle
  return <I size={size} className={className} />
}

/* ── Formatters ──────────────────────────────────────────────────── */

function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function fmtBRL(n: number) {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/* ── Base UI ─────────────────────────────────────────────────────── */

function Spinner() {
  return <div className="w-4 h-4 rounded-full border-2 border-border border-t-primary animate-spin shrink-0" />
}

function Modal({ open, onClose, title, subtitle, size = 'md', footer, children }: {
  open: boolean; onClose: () => void; title?: string; subtitle?: string
  size?: 'sm' | 'md' | 'lg'; footer?: React.ReactNode; children: React.ReactNode
}) {
  if (!open) return null
  const w = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg'
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full ${w} bg-surface border border-border rounded-2xl shadow-xl flex flex-col max-h-[90vh]`}>
        {(title || subtitle) && (
          <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
            {title    && <div className="text-[15px] font-semibold text-text">{title}</div>}
            {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

function Btn({ children, variant = 'secondary', disabled, icon, onClick }: {
  children?: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean; icon?: string; onClick?: () => void
}) {
  const base = 'inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 transition-colors'
  const vr   = variant === 'primary' ? 'bg-primary text-primary-fg hover:opacity-90'
              : variant === 'danger' ? 'bg-danger text-white hover:opacity-90'
              :                        'bg-surface-2 border border-border text-text hover:bg-surface-3'
  return (
    <button className={`${base} ${vr}`} disabled={disabled} onClick={onClick}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  )
}

function ToolField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium text-text mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-text-muted mt-1">{hint}</div>}
    </div>
  )
}

const INPUT_CLS    = 'w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50'
const TEXTAREA_CLS = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none leading-relaxed'

function SelDrop({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 pl-3 pr-8 bg-surface border border-border rounded-lg text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none">
      {children}
    </select>
  )
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <input type="checkbox" checked={checked} onChange={onChange}
      className="w-4 h-4 rounded border-border cursor-pointer accent-[var(--primary)] shrink-0" />
  )
}

/* ── ToolCard ────────────────────────────────────────────────────── */

function ToolCard({ tool, onOpen }: { tool: typeof TOOL_LIST[number]; onOpen: () => void }) {
  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="group bg-surface border border-border rounded-xl p-5 hover:border-border-strong transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30">
      <div className="flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: tool.color }}>
          <Icon name={tool.icon} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-semibold text-text leading-snug">{tool.title}</h3>
          <p className="text-[12px] text-text-muted mt-1 leading-relaxed">{tool.description}</p>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px]">
        <span className="text-text-subtle">{tool.category}</span>
        <span className="inline-flex items-center gap-1 text-text-subtle group-hover:text-primary transition-colors">
          Abrir <Icon name="arrow-up-right" size={11} />
        </span>
      </div>
    </div>
  )
}

/* ── PreviewStep ─────────────────────────────────────────────────── */

function PreviewStep({ step }: { step: FlowStep }) {
  if (step.kind === 'message') return (
    <div className="flex justify-start">
      <div className="max-w-[280px] text-[12px] leading-snug px-3 py-2 rounded-2xl rounded-bl-sm bg-surface text-text border border-border whitespace-pre-wrap">
        {step.text}
      </div>
    </div>
  )
  if (step.kind === 'incoming') return (
    <div className="flex justify-end">
      <div className="max-w-[280px] text-[12px] leading-snug px-3 py-2 rounded-2xl rounded-br-sm bg-primary text-primary-fg">
        {step.text}
      </div>
    </div>
  )
  if (step.kind === 'buttons') return (
    <>
      <PreviewStep step={{ kind: 'message', text: step.text }} />
      <div className="ml-2 flex flex-wrap gap-1.5">
        {step.options.map((o, i) => (
          <span key={i} className="px-2 py-1 bg-surface border border-border rounded text-[11.5px] text-text">{o}</span>
        ))}
      </div>
    </>
  )
  if (step.kind === 'delay') return (
    <div className="text-center py-1">
      <span className="text-[10px] uppercase tracking-wider text-text-subtle font-semibold">
        · aguarda {step.amount} {step.unit} ·
      </span>
    </div>
  )
  if (step.kind === 'offer') return (
    <div className="flex justify-start">
      <div className="ml-2 max-w-[260px] bg-surface border border-border rounded-2xl rounded-bl-sm p-3">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle">Oferta</div>
        <div className="text-[12.5px] font-semibold text-text mt-1">{step.product}</div>
        <div className="text-[16px] font-semibold text-success mt-0.5">{fmtBRL(step.price)}</div>
        <button className="w-full mt-2 h-7 bg-primary text-primary-fg text-[11.5px] font-medium rounded-md">{step.cta}</button>
      </div>
    </div>
  )
  return null
}

/* ── buildFlowPreview — converte nodes/edges reais em FlowStep[] ─── */

function buildFlowPreview(nodes: FlowNode[], edges: FlowEdge[]): FlowStep[] {
  if (!nodes.length) return []

  const hasIncoming = new Set(edges.map(e => e.target))
  const startNode   = nodes.find(n => !hasIncoming.has(n.id)) ?? nodes[0]
  const nodeById    = new Map(nodes.map(n => [n.id, n]))
  const edgesBySource = new Map<string, FlowEdge[]>()
  edges.forEach(e => {
    if (!edgesBySource.has(e.source)) edgesBySource.set(e.source, [])
    edgesBySource.get(e.source)!.push(e)
  })

  const steps: FlowStep[] = []
  const visited = new Set<string>()

  function traverse(nodeId: string, depth: number) {
    if (depth > 25 || visited.has(nodeId)) return
    visited.add(nodeId)
    const node = nodeById.get(nodeId)
    if (!node) return
    const d = node.data

    switch (node.type) {
      case 'message':
        steps.push({ kind: 'message', text: (d.text as string) || '(mensagem vazia)' }); break
      case 'question':
        steps.push({ kind: 'message', text: (d.text as string) || (d.question as string) || '(pergunta)' })
        steps.push({ kind: 'incoming', text: `{${(d.variable as string) || 'resposta'}}` }); break
      case 'buttons':
        steps.push({ kind: 'buttons', text: (d.text as string) || '', options: (d.options as string[]) || [] }); break
      case 'delay':
        steps.push({ kind: 'delay', amount: (d.amount as number) || 1, unit: (d.unit as string) || 'minutos' }); break
      case 'offer':
        steps.push({ kind: 'offer', product: (d.product as string) || '', price: (d.price as number) || 0, cta: (d.cta as string) || 'Comprar' }); break
      case 'tag':
        steps.push({ kind: 'message', text: `🏷️ Tag "${d.tag as string}" ${d.action === 'remove' ? 'removida' : 'adicionada'}` }); break
      case 'image':
        steps.push({ kind: 'message', text: `📷 Imagem enviada${d.caption ? ': ' + (d.caption as string) : ''}` }); break
      case 'link':
        steps.push({ kind: 'message', text: `🔗 ${(d.label as string) || 'Link'}: ${(d.url as string) || ''}` }); break
      case 'handoff':
        steps.push({ kind: 'message', text: '👤 Transferindo para atendimento humano…' }); return
    }

    const outEdges = edgesBySource.get(nodeId) ?? []
    if (outEdges.length > 0) traverse(outEdges[0].target, depth + 1)
  }

  traverse(startNode.id, 0)
  return steps
}

/* ── Tool 1 — Test Message ───────────────────────────────────────── */

function TestMessageModal({ open, onClose, bots }: {
  open: boolean; onClose: () => void; bots: RawBot[]
}) {
  const { track } = useAnalytics()
  const [botId,   setBotId]   = useState(bots[0]?.id ?? '')
  const [chatId,  setChatId]  = useState('')
  const [text,    setText]    = useState('Olá! Esta é uma mensagem de teste do Umbra Bot.')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<Awaited<ReturnType<typeof testMessageAction>> | null>(null)
  const [err,     setErr]     = useState('')

  useEffect(() => {
    if (open) { setBotId(bots[0]?.id ?? ''); setChatId(''); setText('Olá! Esta é uma mensagem de teste do Umbra Bot.'); setResult(null); setErr('') }
  }, [open, bots])

  async function handleSend() {
    if (!chatId.trim() || !botId) return
    setLoading(true); setResult(null); setErr('')
    try {
      const r = await testMessageAction(botId, chatId, text)
      setResult(r)
      track('test_message_sent', { bot_id: botId, success: r.success, time_ms: parseInt(r.time) || 0 })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar.')
    } finally {
      setLoading(false)
    }
  }

  const canSend = !!chatId.trim() && !!botId && !loading

  return (
    <Modal open={open} onClose={onClose}
      title="Testar envio de mensagem" subtitle="Envie uma mensagem isolada antes de disparar em massa." size="md"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        <Btn variant="primary" disabled={!canSend} onClick={handleSend}>
          {loading ? <><Spinner /> Enviando…</> : 'Enviar teste'}
        </Btn>
      </>}>
      <div className="space-y-3.5">
        {bots.length === 0 ? (
          <div className="flex items-start gap-2.5 bg-warning-soft border border-warning/30 rounded-lg p-3 text-[12px] text-warning">
            <Icon name="alert-triangle" size={14} className="mt-0.5" />
            Nenhum bot cadastrado. Adicione um bot em <strong>Gerenciar Bots</strong> primeiro.
          </div>
        ) : (
          <ToolField label="Bot remetente">
            <SelDrop value={botId} onChange={setBotId}>
              {bots.map(b => <option key={b.id} value={b.id}>@{b.username} — {b.name}</option>)}
            </SelDrop>
          </ToolField>
        )}
        <ToolField label="Chat ID de destino" hint="Obtenha seu chat_id enviando /start para @userinfobot no Telegram.">
          <input type="text" value={chatId} onChange={(e) => setChatId(e.target.value)}
            placeholder="123456789" className={INPUT_CLS + ' font-mono'}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSend) handleSend() }} />
        </ToolField>
        <ToolField label="Mensagem">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={TEXTAREA_CLS} />
        </ToolField>

        {err && (
          <div className="flex items-start gap-2.5 bg-danger-soft border border-danger/30 rounded-lg p-3 text-[12px] text-danger">
            <Icon name="alert-circle" size={14} className="mt-0.5" /> {err}
          </div>
        )}

        {result && (
          <div className={`flex items-start gap-2.5 rounded-lg p-3 border ${result.success ? 'bg-success-soft border-success/30' : 'bg-danger-soft border-danger/30'}`}>
            <Icon name={result.success ? 'check-circle-2' : 'x-circle'} size={16} className={result.success ? 'text-success' : 'text-danger'} />
            <div className="text-[12px] flex-1">
              <div className={`font-semibold ${result.success ? 'text-success' : 'text-danger'}`}>
                {result.success ? `Mensagem entregue · ID ${result.messageId}` : 'Falha no envio'}
              </div>
              <div className="text-text-muted mt-0.5">
                {result.success ? `Tempo de resposta: ${result.time}` : result.error}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Tool 2 — Validate Token ─────────────────────────────────────── */

function ValidateTokenModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { track } = useAnalytics()
  const [token,   setToken]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<{ ok: boolean; name?: string; username?: string; id?: string; error?: string } | null>(null)

  useEffect(() => { if (open) { setToken(''); setResult(null); setLoading(false) } }, [open])

  async function handleValidate() {
    if (!token.trim()) return
    setLoading(true); setResult(null)
    try {
      const data = await validateBotTokenAction(token.trim())
      setResult({ ok: true, name: data.firstName, username: data.username, id: data.telegramId })
      track('token_validated', { valid: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao validar.'
      setResult({ ok: false, error: msg })
      track('token_validated', { valid: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}
      title="Validar token de bot" subtitle="Cheque um token sem precisar conectá-lo ao workspace." size="md"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        <Btn variant="primary" disabled={!token.trim() || loading} onClick={handleValidate}>
          {loading ? <><Spinner /> Validando…</> : 'Validar token'}
        </Btn>
      </>}>
      <div className="space-y-3.5">
        <ToolField label="Token do bot">
          <input type="text" value={token} onChange={(e) => setToken(e.target.value)}
            placeholder="7234567890:ABCdefGHIjklMNOpqrSTU…" autoFocus className={INPUT_CLS + ' font-mono'}
            onKeyDown={(e) => { if (e.key === 'Enter' && token.trim() && !loading) handleValidate() }} />
        </ToolField>

        {result && !result.ok && (
          <div className="flex items-start gap-2.5 bg-danger-soft border border-danger/30 rounded-lg p-3 text-[12px] text-danger">
            <Icon name="alert-circle" size={14} className="mt-0.5" /> {result.error}
          </div>
        )}

        {result?.ok && (
          <div className="bg-success-soft border border-success/30 rounded-lg p-3.5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
                <Icon name="bot" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] uppercase tracking-wider font-semibold text-success flex items-center gap-1">
                  <Icon name="check" size={11} /> Token válido
                </div>
                <div className="text-[13.5px] font-semibold text-text mt-0.5">{result.name}</div>
                <div className="text-[11.5px] text-text-muted">@{result.username} · ID {result.id}</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-success/20 text-[11.5px] text-success-muted">
              Token autêntico confirmado pela API do Telegram. Pronto para conectar ao workspace.
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Tool 3 — QR Code ────────────────────────────────────────────── */

function QRCodeModal({ open, onClose, bots }: {
  open: boolean; onClose: () => void; bots: RawBot[]
}) {
  const { track }         = useAnalytics()
  const [botId, setBotId] = useState(bots[0]?.id ?? '')
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const selectedBot = bots.find(b => b.id === botId)
  const telegramUrl = selectedBot ? `https://t.me/${selectedBot.username}` : ''

  useEffect(() => {
    if (open) setBotId(bots[0]?.id ?? '')
  }, [open, bots])

  useEffect(() => {
    if (!selectedBot?.username) { setQrUrl(null); return }
    setLoading(true)
    import('qrcode').then(({ default: QRCode }) =>
      QRCode.toDataURL(`https://t.me/${selectedBot.username}`, {
        width: 220, margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
    ).then(url => {
      setQrUrl(url)
      track('qr_generated', { bot_username: selectedBot.username })
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, selectedBot?.username])

  function handleDownload() {
    if (!qrUrl || !selectedBot) return
    const a = document.createElement('a')
    a.href     = qrUrl
    a.download = `qr_${selectedBot.username}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    track('qr_downloaded', { bot_username: selectedBot.username })
  }

  return (
    <Modal open={open} onClose={onClose}
      title="Gerar QR code do bot" subtitle="QR aponta direto para a conversa do bot no Telegram." size="md"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        <Btn variant="primary" icon="download" disabled={!qrUrl} onClick={handleDownload}>Baixar PNG</Btn>
      </>}>
      <div className="space-y-3.5">
        {bots.length === 0 ? (
          <div className="flex items-start gap-2.5 bg-warning-soft border border-warning/30 rounded-lg p-3 text-[12px] text-warning">
            <Icon name="alert-triangle" size={14} className="mt-0.5" />
            Nenhum bot cadastrado ainda.
          </div>
        ) : (
          <ToolField label="Bot">
            <SelDrop value={botId} onChange={setBotId}>
              {bots.map(b => <option key={b.id} value={b.id}>@{b.username} — {b.name}</option>)}
            </SelDrop>
          </ToolField>
        )}

        <div className="bg-surface-2/40 border border-border rounded-xl p-6 flex flex-col items-center min-h-[220px] justify-center">
          {loading && <Spinner />}
          {!loading && qrUrl && (
            <>
              <img ref={imgRef} src={qrUrl} alt="QR Code" width={220} height={220} className="block rounded" />
              <div className="mt-3 text-center">
                <div className="text-[11.5px] text-text-muted">Aponte a câmera para abrir:</div>
                <div className="text-[13px] font-mono font-semibold text-text mt-0.5">{telegramUrl}</div>
              </div>
            </>
          )}
          {!loading && !qrUrl && bots.length === 0 && (
            <span className="text-[12px] text-text-muted">Selecione um bot para gerar o QR.</span>
          )}
        </div>

        <div className="flex items-start gap-2 text-[11.5px] text-text-muted bg-surface-2/40 border border-border rounded-lg p-3">
          <Icon name="info" size={13} className="mt-0.5 shrink-0" />
          <span>Use em materiais impressos (panfletos, banners, embalagens). O Telegram identifica o link automaticamente em câmeras nativas.</span>
        </div>
      </div>
    </Modal>
  )
}

/* ── Tool 4 — Preview Flow ───────────────────────────────────────── */

function PreviewFlowModal({ open, onClose, flows }: {
  open: boolean; onClose: () => void; flows: RawFlow[]
}) {
  const { track }             = useAnalytics()
  const [flowId, setFlowId]   = useState(flows[0]?.id ?? '')
  const [tracked, setTracked] = useState(false)

  useEffect(() => {
    if (open) { setFlowId(flows[0]?.id ?? ''); setTracked(false) }
  }, [open, flows])

  const selectedFlow = flows.find(f => f.id === flowId)
  const nodes = (selectedFlow?.nodes ?? []) as FlowNode[]
  const edges = (selectedFlow?.edges ?? []) as FlowEdge[]
  const steps = useMemo(() => buildFlowPreview(nodes, edges), [nodes, edges])

  useEffect(() => {
    if (selectedFlow && !tracked && steps.length > 0) {
      track('flow_previewed', { flow_id: selectedFlow.id, node_count: nodes.length })
      setTracked(true)
    }
  }, [selectedFlow, steps.length, tracked, nodes.length, track])

  return (
    <Modal open={open} onClose={onClose}
      title="Prévia de fluxo" subtitle="Simulação real dos nós cadastrados no editor de fluxo." size="lg"
      footer={<Btn variant="primary" onClick={onClose}>Fechar</Btn>}>
      <div className="space-y-3.5">
        {flows.length === 0 ? (
          <div className="flex items-start gap-2.5 bg-warning-soft border border-warning/30 rounded-lg p-3 text-[12px] text-warning">
            <Icon name="alert-triangle" size={14} className="mt-0.5" />
            Nenhum fluxo criado ainda. Crie um em <strong>Fluxos de venda</strong>.
          </div>
        ) : (
          <ToolField label="Fluxo">
            <SelDrop value={flowId} onChange={(v) => { setFlowId(v); setTracked(false) }}>
              {flows.map(f => <option key={f.id} value={f.id}>{f.name} {f.status === 'published' ? '✓' : '(rascunho)'}</option>)}
            </SelDrop>
          </ToolField>
        )}

        {flows.length > 0 && (
          <div className="bg-surface-2/30 border border-border rounded-xl p-4 space-y-2 max-h-[420px] overflow-y-auto">
            {steps.length === 0 ? (
              <div className="text-center py-8 text-[12px] text-text-muted">
                Fluxo vazio — adicione nós no editor para visualizar a prévia.
              </div>
            ) : (
              <>
                {steps.map((step, i) => <PreviewStep key={i} step={step} />)}
                <div className="text-center pt-1">
                  <span className="text-[10px] uppercase tracking-wider text-text-subtle font-semibold">· fim da prévia ·</span>
                </div>
              </>
            )}
          </div>
        )}

        {nodes.length > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <Icon name="info" size={12} className="shrink-0" />
            <span>{nodes.length} nó{nodes.length !== 1 ? 's' : ''} · prévia mostra o caminho principal (primeiro branch).</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Tool 5 — Import Config ──────────────────────────────────────── */

function ImportConfigModal({ open, onClose, onToast }: {
  open: boolean; onClose: () => void; onToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const { track }               = useAnalytics()
  const fileRef                 = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing]   = useState(false)
  const [parseErr, setParseErr] = useState('')
  const [parsed,  setParsed]    = useState<ParsedBackup | null>(null)
  const [rawJson, setRawJson]   = useState('')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (open) { setFileName(''); setParsed(null); setRawJson(''); setParsing(false); setParseErr('') }
  }, [open])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name); setParsing(true); setParseErr(''); setParsed(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = ev.target?.result as string
        const data = JSON.parse(json) as Record<string, unknown>
        setParsed({
          bots:      Array.isArray(data.bots)      ? data.bots.length      : 0,
          flows:     Array.isArray(data.flows)     ? data.flows.length     : 0,
          sequences: Array.isArray(data.sequences) ? data.sequences.length : 0,
          gateways:  Array.isArray(data.gateways)  ? data.gateways.length  : 0,
          links:     Array.isArray(data.links)     ? data.links.length     : 0,
          contacts:  Array.isArray(data.contacts)  ? data.contacts.length  : 0,
          tags:      Array.isArray(data.tags)      ? data.tags.length      : 0,
          webhooks:  Array.isArray(data.webhooks)  ? data.webhooks.length  : 0,
          size:      `${(json.length / 1024).toFixed(0)} KB`,
        })
        setRawJson(json)
      } catch {
        setParseErr('Arquivo inválido. Certifique-se que é um backup exportado pelo Umbra Bot.')
      } finally {
        setParsing(false)
      }
    }
    reader.readAsText(file)
  }

  async function doImport() {
    if (!rawJson) return
    setImporting(true)
    try {
      const { imported, errors } = await importConfigAction(rawJson)
      const total = Object.values(imported).reduce((a, b) => a + b, 0)
      track('config_imported', imported)
      if (errors.length > 0) {
        onToast(`${total} itens importados com ${errors.length} erro(s). Verifique o console.`, 'error')
      } else {
        onToast(`${total} itens importados com sucesso de ${fileName}.`)
      }
      onClose()
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erro ao importar.', 'error')
    } finally {
      setImporting(false)
    }
  }

  function ImportRow({ icon, label, count }: { icon: string; label: string; count: number }) {
    return (
      <div className="flex items-center gap-2">
        <Icon name={icon} size={12} className="text-text-muted shrink-0" />
        <span className="text-[12px] text-text-muted">{label}:</span>
        <span className="text-[12px] text-text font-semibold ml-auto">{fmtNum(count)}</span>
      </div>
    )
  }

  return (
    <Modal open={open} onClose={onClose}
      title="Importar configurações" subtitle="Restaure o workspace a partir de um backup JSON." size="md"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" disabled={!parsed || !!parseErr || importing} onClick={doImport}>
          {importing ? <><Spinner /> Importando…</> : 'Importar configurações'}
        </Btn>
      </>}>
      <div className="space-y-3.5">
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />

        {!fileName ? (
          <button onClick={() => fileRef.current?.click()}
            className="w-full bg-surface-2/30 border-2 border-dashed border-border rounded-xl py-10 px-6 flex flex-col items-center justify-center text-center hover:bg-surface-2/50 hover:border-primary/50 focus:outline-none transition-colors">
            <div className="w-12 h-12 rounded-xl bg-surface border border-border text-text-muted flex items-center justify-center mb-3">
              <Icon name="upload" size={20} />
            </div>
            <div className="text-[13px] font-semibold text-text">Selecionar arquivo JSON</div>
            <div className="text-[11.5px] text-text-muted mt-1 max-w-xs">Arraste e solte ou clique para escolher um backup exportado.</div>
          </button>
        ) : (
          <div className="bg-surface-2/40 border border-border rounded-lg p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-primary-soft text-primary flex items-center justify-center shrink-0">
              <Icon name="file-text" size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-text truncate">{fileName}</div>
              <div className="text-[11px] text-text-muted">
                {parsing ? 'Lendo arquivo…' : parseErr ? 'Arquivo inválido' : parsed ? `${parsed.size} · workspace válido` : ''}
              </div>
            </div>
            {parsing && <Spinner />}
            {!parsing && (
              <button onClick={() => { setFileName(''); setParsed(null); setRawJson(''); setParseErr('') }}
                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text">
                <Icon name="x" size={13} />
              </button>
            )}
          </div>
        )}

        {parseErr && (
          <div className="flex items-start gap-2 bg-danger-soft border border-danger/30 rounded-lg p-3 text-[12px] text-danger">
            <Icon name="alert-circle" size={14} className="mt-0.5 shrink-0" /> {parseErr}
          </div>
        )}

        {parsed && !parseErr && (
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-2.5">Conteúdo a importar</div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              <ImportRow icon="bot"         label="Bots"       count={parsed.bots} />
              <ImportRow icon="git-branch"  label="Fluxos"     count={parsed.flows} />
              <ImportRow icon="layers"      label="Sequências" count={parsed.sequences} />
              <ImportRow icon="credit-card" label="Gateways"   count={parsed.gateways} />
              <ImportRow icon="link"        label="Links"      count={parsed.links} />
              <ImportRow icon="tag"         label="Tags"       count={parsed.tags} />
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-start gap-2 text-[11px] text-warning bg-warning-soft/40 -mx-1 px-3 py-2 rounded">
              <Icon name="alert-triangle" size={12} className="mt-0.5 shrink-0" />
              <span>A importação <strong>substitui</strong> itens com o mesmo ID e <strong>cria os novos</strong>. Exporte um backup antes de continuar.</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Tool 6 — Export Config ──────────────────────────────────────── */

function ExportConfigModal({ open, onClose, onToast }: {
  open: boolean; onClose: () => void; onToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const { track }   = useAnalytics()
  const [parts, setParts] = useState<Record<string, boolean>>({
    bots: true, flows: true, sequences: true, gateways: true,
    links: true, contacts: false, tags: true, webhooks: false,
  })
  const [counts,    setCounts]    = useState<ExportCounts | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getExportCountsAction()
      .then(setCounts)
      .catch(() => setCounts(null))
      .finally(() => setLoading(false))
  }, [open])

  function toggle(key: string) { setParts(p => ({ ...p, [key]: !p[key] })) }

  async function doExport() {
    setExporting(true)
    try {
      const jsonStr = await exportConfigAction(parts as Parameters<typeof exportConfigAction>[0])
      const blob    = new Blob([jsonStr], { type: 'application/json' })
      const url     = URL.createObjectURL(blob)
      const date    = new Date().toISOString().slice(0, 10)
      const a       = document.createElement('a')
      a.href = url; a.download = `umbra-backup-${date}.json`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      const selected = Object.entries(parts).filter(([, v]) => v).map(([k]) => k)
      track('config_exported', { parts: selected, total_sections: selected.length })
      onToast('Backup JSON gerado e baixado com sucesso.')
      onClose()
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erro ao exportar.', 'error')
    } finally {
      setExporting(false)
    }
  }

  const totalSelected = Object.values(parts).filter(Boolean).length

  const EXPORT_ROWS = [
    { key: 'bots',      label: 'Bots conectados',           icon: 'bot',         warn: false },
    { key: 'flows',     label: 'Fluxos de venda',           icon: 'git-branch',  warn: false },
    { key: 'sequences', label: 'Sequências de remarketing', icon: 'layers',      warn: false },
    { key: 'gateways',  label: 'Gateways de pagamento',     icon: 'credit-card', warn: false },
    { key: 'links',     label: 'Redirecionadores',          icon: 'link',        warn: false },
    { key: 'tags',      label: 'Tags & segmentos',          icon: 'tag',         warn: false },
    { key: 'webhooks',  label: 'Webhooks personalizados',   icon: 'webhook',     warn: false },
    { key: 'contacts',  label: 'Contatos (LGPD: dados pessoais)', icon: 'database', warn: true },
  ] as const

  return (
    <Modal open={open} onClose={onClose}
      title="Exportar configurações" subtitle="Selecione o que incluir no backup JSON." size="md"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" icon="download" disabled={totalSelected === 0 || exporting || loading} onClick={doExport}>
          {exporting ? <><Spinner /> Gerando…</> : `Baixar JSON (${totalSelected})`}
        </Btn>
      </>}>
      <div className="space-y-1">
        {loading && (
          <div className="flex items-center gap-2 py-4 justify-center text-[12px] text-text-muted">
            <Spinner /> Carregando contagens do banco…
          </div>
        )}
        {!loading && EXPORT_ROWS.map((p) => (
          <label key={p.key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-2 cursor-pointer">
            <Checkbox checked={parts[p.key] ?? false} onChange={() => toggle(p.key)} />
            <Icon name={p.icon} size={13} className="text-text-muted shrink-0" />
            <span className="flex-1 text-[12.5px] text-text">{p.label}</span>
            {p.warn && <span className="inline-flex items-center px-1.5 h-5 rounded bg-warning-soft text-warning text-[10.5px] font-semibold">LGPD</span>}
            <span className="text-[11.5px] text-text-muted shrink-0">
              {counts ? fmtNum(counts[p.key as keyof ExportCounts] ?? 0) : '—'}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-border flex items-start gap-2 text-[11.5px] text-text-muted">
        <Icon name="info" size={13} className="mt-0.5 shrink-0" />
        <span>Tokens de bots e chaves de gateway <strong>não</strong> são incluídos no backup. Reconexão manual necessária ao importar em outra conta.</span>
      </div>
    </Modal>
  )
}

/* ── Tool 7 — Diagnostics ────────────────────────────────────────── */

const DIAG_CHECKS = [
  { id: 'bots',     label: 'Bots conectados',      icon: 'bot',         fn: checkBotsAction },
  { id: 'webhooks', label: 'Webhooks',              icon: 'webhook',     fn: checkWebhooksAction },
  { id: 'gateways', label: 'Gateways de pagamento', icon: 'credit-card', fn: checkGatewaysAction },
  { id: 'queue',    label: 'Fila de envios',        icon: 'inbox',       fn: checkQueueAction },
  { id: 'dns',      label: 'DNS e certificados',    icon: 'globe',       fn: checkDnsAction },
  { id: 'storage',  label: 'Armazenamento e cache', icon: 'database',    fn: checkStorageAction },
] as const

function DiagnosticsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { track }   = useAnalytics()
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Record<string, DiagResult>>({})

  useEffect(() => { if (open) { setRunning(false); setResults({}) } }, [open])

  async function runAll() {
    setRunning(true); setResults({})
    const startTs = Date.now()

    for (const check of DIAG_CHECKS) {
      setResults(p => ({ ...p, [check.id]: { status: 'running', detail: '' } }))
      try {
        const r = await (check.fn as () => Promise<{ pass: boolean; detail: string }>)()
        setResults(p => ({ ...p, [check.id]: { status: r.pass ? 'pass' : 'fail', detail: r.detail } }))
      } catch (e) {
        setResults(p => ({ ...p, [check.id]: { status: 'fail', detail: e instanceof Error ? e.message : 'Falha na verificação.' } }))
      }
    }

    setRunning(false)
    const finalResults = await new Promise<Record<string, DiagResult>>(resolve =>
      setResults(p => { resolve(p); return p })
    )
    const failed = Object.values(finalResults).filter(r => r.status === 'fail').length
    track('diagnostics_run', { checks: DIAG_CHECKS.length, failed })
    void startTs
  }

  const completed = Object.values(results).filter(r => r.status === 'pass' || r.status === 'fail').length
  const failed    = Object.values(results).filter(r => r.status === 'fail').length
  const allDone   = completed === DIAG_CHECKS.length

  return (
    <Modal open={open} onClose={onClose}
      title="Diagnóstico do sistema" subtitle="Verifique a saúde dos componentes do workspace." size="lg"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        <Btn variant="primary" icon="play" disabled={running} onClick={runAll}>
          {running ? <><Spinner /> Verificando ({completed}/{DIAG_CHECKS.length})…</> : 'Iniciar diagnóstico'}
        </Btn>
      </>}>
      <div className="space-y-2">
        {DIAG_CHECKS.map((c) => {
          const r = results[c.id]
          return (
            <div key={c.id} className="bg-surface-2/40 border border-border rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-surface border border-border text-text-muted flex items-center justify-center shrink-0">
                  <Icon name={c.icon} size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-text">{c.label}</div>
                  {!r               && <div className="text-[11px] text-text-muted mt-0.5">Aguardando início…</div>}
                  {r?.status === 'running' && <div className="text-[11px] text-text-muted mt-0.5">Verificando…</div>}
                  {r?.status === 'pass'    && <div className="text-[11px] text-success mt-0.5 leading-snug">{r.detail}</div>}
                  {r?.status === 'fail'    && <div className="text-[11px] text-danger mt-0.5 leading-snug">{r.detail}</div>}
                </div>
                <div className="shrink-0">
                  {!r                      && <span className="w-4 h-4 rounded-full border border-border-strong inline-block" />}
                  {r?.status === 'running' && <Spinner />}
                  {r?.status === 'pass'    && <Icon name="check-circle-2" size={16} className="text-success" />}
                  {r?.status === 'fail'    && <Icon name="x-circle"       size={16} className="text-danger" />}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {allDone && (
        <div className={`mt-4 flex items-start gap-2.5 rounded-lg p-3 border ${failed === 0 ? 'bg-success-soft border-success/30' : 'bg-warning-soft border-warning/30'}`}>
          <Icon name={failed === 0 ? 'check-circle-2' : 'alert-triangle'} size={15} className={failed === 0 ? 'text-success' : 'text-warning'} />
          <div className="text-[12px] flex-1">
            <div className={`font-semibold ${failed === 0 ? 'text-success' : 'text-warning'}`}>
              {failed === 0 ? 'Tudo certo · sistema operacional' : `${failed} verificaç${failed === 1 ? 'ão falhou' : 'ões falharam'}`}
            </div>
            {failed > 0 && <div className="text-text-muted mt-0.5">Revise os itens em vermelho e acesse a tela de Alertas para mais detalhes.</div>}
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ── Tool 8 — Clear Cache ────────────────────────────────────────── */

function ClearCacheModal({ open, onClose, onToast }: {
  open: boolean; onClose: () => void; onToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const { track }               = useAnalytics()
  const [confirming, setConfirming] = useState(false)
  const [clearing,   setClearing]   = useState(false)

  useEffect(() => { if (open) { setConfirming(false); setClearing(false) } }, [open])

  async function doClear() {
    setClearing(true)
    try {
      await clearCacheAction()
      track('cache_cleared', {})
      onToast('Cache do workspace limpo. Páginas serão recarregadas com dados frescos.')
      onClose()
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erro ao limpar cache.', 'error')
    } finally {
      setClearing(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Limpar cache do workspace" size="sm"
      footer={confirming ? (
        <>
          <Btn variant="secondary" onClick={() => setConfirming(false)}>Cancelar</Btn>
          <Btn variant="danger" disabled={clearing} onClick={doClear}>
            {clearing ? <><Spinner /> Limpando…</> : 'Sim, limpar tudo'}
          </Btn>
        </>
      ) : (
        <>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" icon="eraser" onClick={() => setConfirming(true)}>Limpar cache</Btn>
        </>
      )}>
      <div className="text-[12.5px] text-text-muted leading-relaxed">
        Isto vai invalidar os caches de todas as páginas do workspace. Próximas requisições buscarão dados frescos do banco.
      </div>
      <div className="mt-3 flex items-start gap-2 bg-warning-soft/40 border border-warning/20 rounded-lg p-3 text-[11.5px] text-text leading-relaxed">
        <Icon name="info" size={13} className="text-warning mt-0.5 shrink-0" />
        <span>Configurações, conversas e relatórios <strong>não</strong> serão afetados. Apenas caches de página.</span>
      </div>
    </Modal>
  )
}

/* ── Modal registry ──────────────────────────────────────────────── */

type ModalProps = {
  open: boolean
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error') => void
  bots:    RawBot[]
  flows:   RawFlow[]
}

function ActiveModal({ toolId, ...props }: { toolId: ToolId | null } & ModalProps) {
  if (!toolId) return null
  switch (toolId) {
    case 'test_message':   return <TestMessageModal   open={props.open} onClose={props.onClose} bots={props.bots} />
    case 'validate_token': return <ValidateTokenModal open={props.open} onClose={props.onClose} />
    case 'qr_code':        return <QRCodeModal        open={props.open} onClose={props.onClose} bots={props.bots} />
    case 'preview_flow':   return <PreviewFlowModal   open={props.open} onClose={props.onClose} flows={props.flows} />
    case 'import_config':  return <ImportConfigModal  open={props.open} onClose={props.onClose} onToast={props.onToast} />
    case 'export_config':  return <ExportConfigModal  open={props.open} onClose={props.onClose} onToast={props.onToast} />
    case 'diagnostics':    return <DiagnosticsModal   open={props.open} onClose={props.onClose} />
    case 'clear_cache':    return <ClearCacheModal    open={props.open} onClose={props.onClose} onToast={props.onToast} />
  }
}

/* ── ToolsClient (main) ──────────────────────────────────────────── */

export function ToolsClient({ bots, flows }: { bots: RawBot[]; flows: RawFlow[] }) {
  const { track } = useAnalytics()
  const [openTool, setOpenTool] = useState<ToolId | null>(null)
  const [toast, setToast]       = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const handleToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
  }, [])

  function handleOpen(toolId: ToolId) {
    setOpenTool(toolId)
    track('tool_opened', { tool_id: toolId })
  }

  const grouped = useMemo(() => {
    const out: Record<string, typeof TOOL_LIST[number][]> = {}
    TOOL_LIST.forEach(t => {
      if (!out[t.category]) out[t.category] = []
      out[t.category].push(t)
    })
    return out
  }, [])

  return (
    <DashboardLayout>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Ferramentas</h1>
          <p className="text-[13px] text-text-muted mt-0.5">Utilitários auxiliares para sua operação — testes, diagnósticos, backup e mais.</p>
        </div>
      </div>

      {toast && (
        <div className={`mb-4 flex items-center gap-2.5 rounded-lg px-3.5 py-2 border ${
          toast.type === 'error'
            ? 'bg-danger-soft border-danger/30'
            : 'bg-success-soft border-success/30'
        }`}>
          <Icon
            name={toast.type === 'error' ? 'alert-circle' : 'check-circle-2'}
            size={15}
            className={toast.type === 'error' ? 'text-danger' : 'text-success'}
          />
          <div className={`text-[12.5px] flex-1 ${toast.type === 'error' ? 'text-danger' : 'text-success'}`}>
            {toast.msg}
          </div>
          <button onClick={() => setToast(null)}
            className="w-6 h-6 inline-flex items-center justify-center rounded-md opacity-70 hover:opacity-100 focus:outline-none">
            <Icon name="x" size={11} />
          </button>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, items]) => (
          <section key={cat}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">{cat}</h2>
              <span className="text-[10.5px] text-text-subtle">{items.length} ferramenta{items.length !== 1 ? 's' : ''}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map(t => (
                <ToolCard key={t.id} tool={t} onOpen={() => handleOpen(t.id)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <ActiveModal
        toolId={openTool}
        open={!!openTool}
        onClose={() => setOpenTool(null)}
        onToast={handleToast}
        bots={bots}
        flows={flows}
      />
    </DashboardLayout>
  )
}
