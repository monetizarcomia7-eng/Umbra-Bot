'use client'

import React, {
  useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect,
} from 'react'
import {
  Send, Key, QrCode, PlayCircle, Upload, Download, Stethoscope, Eraser,
  ArrowUpRight, Bot, CheckCircle2, XCircle, Check, Info, AlertCircle, X,
  GitBranch, Layers, CreditCard, Link, Tag, Webhook, FileText,
  AlertTriangle, Inbox, Globe, Database, Play, HelpCircle, Copy, Link2,
  Shield, RotateCcw, Clock, RefreshCw, ChevronRight,
} from 'lucide-react'
import { validateBotTokenAction } from '@/app/actions/bots'
import {
  testMessageAction,
  checkBotsAction, checkWebhooksAction, checkGatewaysAction,
  checkQueueAction, checkDnsAction, checkStorageAction,
  getExportCountsAction, exportConfigAction, importConfigAction,
  clearCacheAction, getLgpdDataAction,
} from '@/app/actions/tools'
import { useAnalytics } from '@/hooks/use-analytics'
import type { RawBot, RawFlow } from './page'

/* ── Types ───────────────────────────────────────────────────────────────── */

interface FlowNode {
  id:       string
  type:     string
  position: { x: number; y: number }
  data:     Record<string, unknown>
}
interface FlowEdge {
  id:            string
  source:        string
  target:        string
  sourceHandle?: string
}

// Interactive flow simulation
type SimEntry =
  | { k: 'bot';     text: string }
  | { k: 'user';    text: string }
  | { k: 'sys';     text: string }
  | { k: 'offer';   product: string; price: number; cta: string }
  | { k: 'buttons'; text: string; opts: string[]; chosen?: number }

type WaitData =
  | { k: 'question'; varName: string; next: string | null }
  | { k: 'buttons';  choices: { label: string; target: string | null }[] }

type SimPhase = 'idle' | 'running' | 'question' | 'buttons' | 'done'

type DiagStatus = 'idle' | 'running' | 'pass' | 'fail'
interface DiagResult { status: DiagStatus; detail: string; timeMs?: number }

interface ExportCounts {
  bots: number; flows: number; sequences: number; gateways: number
  links: number; contacts: number; tags: number; webhooks: number
}
interface ParsedBackup {
  bots: number; flows: number; sequences: number; gateways: number
  links: number; contacts: number; tags: number; webhooks: number
  size: string; exportedAt?: string; version?: string
}
interface LgpdData {
  total: number; with_name: number; with_email: number; with_phone: number
  with_username: number; with_city: number; unique_tags: number; total_tag_assignments: number
}
interface TestHistory {
  chatId: string; text: string; format: 'none' | 'HTML' | 'Markdown'; ts: number
}
interface DeepLinkHistory { username: string; param: string; ts: number }

/* ── Tool list ───────────────────────────────────────────────────────────── */

const TOOL_LIST = [
  { id: 'test_message',   title: 'Testar envio de mensagem',  description: 'Envie uma mensagem de teste para um chat ID específico antes de disparar para a base inteira.',  icon: 'send',        color: 'var(--primary)',       category: 'Bots & mensagens' },
  { id: 'validate_token', title: 'Validar token de bot',       description: 'Verifique se um token do BotFather é válido e veja as informações públicas do bot.',             icon: 'key',         color: 'var(--success)',       category: 'Bots & mensagens' },
  { id: 'qr_code',        title: 'Gerar QR code do bot',       description: 'Crie um QR code que abre o Telegram direto na conversa do bot — útil para material impresso.',    icon: 'qr-code',     color: 'var(--warning)',       category: 'Bots & mensagens' },
  { id: 'deep_link',      title: 'Gerador de deep link',       description: 'Crie links t.me/bot?start=PARAM com parâmetro rastreável por campanha ou fonte de tráfego.',      icon: 'link2',       color: 'oklch(0.62 0.16 200)', category: 'Bots & mensagens' },
  { id: 'preview_flow',   title: 'Prévia interativa de fluxo', description: 'Simule a execução de um fluxo passo a passo, clicando em botões e respondendo perguntas.',        icon: 'play-circle', color: 'oklch(0.60 0.18 300)', category: 'Fluxos' },
  { id: 'import_config',  title: 'Importar configurações',     description: 'Restaure bots, fluxos, tags e gateways a partir de um arquivo JSON exportado.',                   icon: 'upload',      color: 'oklch(0.58 0.05 280)', category: 'Configuração' },
  { id: 'export_config',  title: 'Exportar configurações',     description: 'Baixe um JSON com a configuração completa do workspace — backup ou migração entre contas.',       icon: 'download',    color: 'oklch(0.58 0.05 280)', category: 'Configuração' },
  { id: 'diagnostics',    title: 'Diagnóstico do sistema',     description: 'Roda checagens automáticas em todos os componentes — bots, gateways, webhooks, DNS, fila.',       icon: 'stethoscope', color: 'var(--danger)',        category: 'Configuração' },
  { id: 'clear_cache',    title: 'Limpar cache do workspace',  description: 'Limpa caches internos. Útil quando informações estão desatualizadas após mudanças.',              icon: 'eraser',      color: 'oklch(0.58 0.05 280)', category: 'Configuração' },
  { id: 'lgpd_check',     title: 'Verificador de LGPD',        description: 'Veja quais dados pessoais estão armazenados nos seus contatos e o status de conformidade.',        icon: 'shield',      color: 'oklch(0.55 0.12 150)', category: 'Avançado' },
] as const

type ToolId = typeof TOOL_LIST[number]['id']

/* ── Icon map ────────────────────────────────────────────────────────────── */

const ICON_MAP: Record<string, React.ElementType> = {
  'send': Send, 'key': Key, 'qr-code': QrCode, 'play-circle': PlayCircle,
  'upload': Upload, 'download': Download, 'stethoscope': Stethoscope, 'eraser': Eraser,
  'arrow-up-right': ArrowUpRight, 'bot': Bot, 'check-circle-2': CheckCircle2,
  'x-circle': XCircle, 'check': Check, 'info': Info, 'alert-circle': AlertCircle,
  'x': X, 'git-branch': GitBranch, 'layers': Layers, 'credit-card': CreditCard,
  'link': Link, 'link2': Link2, 'tag': Tag, 'webhook': Webhook, 'file-text': FileText,
  'alert-triangle': AlertTriangle, 'inbox': Inbox, 'globe': Globe, 'database': Database,
  'play': Play, 'copy': Copy, 'shield': Shield, 'rotate-ccw': RotateCcw,
  'clock': Clock, 'refresh-cw': RefreshCw, 'chevron-right': ChevronRight,
}

function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const I = ICON_MAP[name] ?? HelpCircle
  return <I size={size} className={className} />
}

/* ── Formatters ──────────────────────────────────────────────────────────── */

function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function fmtBRL(n: number) {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) }
  catch { return iso }
}

/* ── Flow preview helpers ────────────────────────────────────────────────── */

const PREVIEW_DEFAULTS: Record<string, string> = {
  nome: 'João', produto: 'Mentoria Premium', valor: 'R$ 197,00',
  bot: 'MeuBot', data: new Date().toLocaleDateString('pt-BR'), email: 'joao@email.com',
}

function subVars(text: string, vars: Record<string, string>): string {
  let r = text || ''
  Object.entries(vars).forEach(([k, v]) => { r = r.replace(new RegExp(`\\{${k}\\}`, 'g'), v) })
  Object.entries(PREVIEW_DEFAULTS).forEach(([k, v]) => { r = r.replace(new RegExp(`\\{${k}\\}`, 'g'), v) })
  return r
}

function buildNodeMaps(nodes: FlowNode[], edges: FlowEdge[]) {
  const nodeById = new Map(nodes.map(n => [n.id, n]))
  const edgesBySource = new Map<string, FlowEdge[]>()
  edges.forEach(e => {
    if (!edgesBySource.has(e.source)) edgesBySource.set(e.source, [])
    edgesBySource.get(e.source)!.push(e)
  })
  const hasIncoming = new Set(edges.map(e => e.target))
  const startNode = nodes.find(n => !hasIncoming.has(n.id)) ?? nodes[0] ?? null
  return { nodeById, edgesBySource, startNode }
}

/* ── LS helpers ──────────────────────────────────────────────────────────── */

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { return JSON.parse(localStorage.getItem(key) ?? '') ?? fallback } catch { return fallback }
}
function lsSet(key: string, val: unknown) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* noop */ }
}

/* ── Base UI ─────────────────────────────────────────────────────────────── */

function Spinner({ size = 4 }: { size?: number }) {
  return <div className={`w-${size} h-${size} rounded-full border-2 border-border border-t-primary animate-spin shrink-0`} />
}

// Toast with progress bar
function ToastBar({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  const barRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = barRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.style.transition = 'width 3.5s linear'
      el.style.width = '0%'
    })
  }, [])
  const isErr = type === 'error'
  return (
    <div className={`relative overflow-hidden flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 border mb-4 ${isErr ? 'bg-danger-soft border-danger/30' : 'bg-success-soft border-success/30'}`}>
      <div ref={barRef} className="absolute bottom-0 left-0 h-0.5" style={{ width: '100%', background: isErr ? 'var(--danger)' : 'var(--success)' }} />
      <Icon name={isErr ? 'alert-circle' : 'check-circle-2'} size={15} className={isErr ? 'text-danger' : 'text-success'} />
      <span className={`text-[12.5px] flex-1 ${isErr ? 'text-danger' : 'text-success'}`}>{msg}</span>
      <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md opacity-60 hover:opacity-100">
        <Icon name="x" size={11} />
      </button>
    </div>
  )
}

function Modal({ open, onClose, title, subtitle, size = 'md', footer, children }: {
  open: boolean; onClose: () => void; title?: string; subtitle?: string
  size?: 'sm' | 'md' | 'lg'; footer?: React.ReactNode; children: React.ReactNode
}) {
  // Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

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
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">{footer}</div>
        )}
      </div>
    </div>
  )
}

function Btn({ children, variant = 'secondary', disabled, icon, onClick, className }: {
  children?: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  disabled?: boolean; icon?: string; onClick?: () => void; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 transition-colors'
  const vr = variant === 'primary' ? 'bg-primary text-primary-fg hover:opacity-90'
           : variant === 'danger'  ? 'bg-danger text-white hover:opacity-90'
           : variant === 'ghost'   ? 'text-text-muted hover:text-text hover:bg-surface-2'
           :                         'bg-surface-2 border border-border text-text hover:bg-surface-3'
  return (
    <button className={`${base} ${vr} ${className ?? ''}`} disabled={disabled} onClick={onClick}>
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

function SelDrop({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 pl-3 pr-8 bg-surface border border-border rounded-lg text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none">
      {children}
    </select>
  )
}

/* ── ToolCard ────────────────────────────────────────────────────────────── */

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

/* ── Tool 1 — Test Message ───────────────────────────────────────────────── */

const FORMAT_OPTIONS = [
  { v: 'none',     label: 'Sem formatação', hint: 'Texto puro' },
  { v: 'HTML',     label: 'HTML',           hint: '<b>negrito</b>, <i>itálico</i>, <code>código</code>' },
  { v: 'Markdown', label: 'Markdown',       hint: '*negrito*, _itálico_, `código`' },
] as const

const VARS = ['{nome}', '{produto}', '{valor}', '{bot}', '{data}']

function TestMessageModal({ open, onClose, bots }: { open: boolean; onClose: () => void; bots: RawBot[] }) {
  const { track }  = useAnalytics()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [botId,   setBotId]   = useState(bots[0]?.id ?? '')
  const [chatId,  setChatId]  = useState('')
  const [text,    setText]    = useState('Olá {nome}! Esta é uma mensagem de teste do Umbra Bot. 🚀')
  const [format,  setFormat]  = useState<'none' | 'HTML' | 'Markdown'>('HTML')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<{ success: boolean; messageId: number | null; time: string; error: string | null } | null>(null)
  const [err,     setErr]     = useState('')
  const [history, setHistory] = useState<TestHistory[]>([])
  const [attemptsLeft, setAttemptsLeft] = useState(10)

  useEffect(() => {
    if (open) {
      setBotId(bots[0]?.id ?? ''); setChatId(''); setResult(null); setErr('')
      setAttemptsLeft(10)
      setHistory(lsGet<TestHistory[]>('umbra_test_history', []))
    }
  }, [open, bots])

  function insertVar(v: string) {
    const el = textareaRef.current
    if (!el) { setText(t => t + v); return }
    const s = el.selectionStart, e = el.selectionEnd
    const next = text.slice(0, s) + v + text.slice(e)
    setText(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(s + v.length, s + v.length)
    })
  }

  async function handleSend() {
    if (!chatId.trim() || !botId || loading || attemptsLeft <= 0) return
    setLoading(true); setResult(null); setErr('')
    try {
      const r = await testMessageAction(botId, chatId, text, format)
      setResult(r)
      setAttemptsLeft(p => Math.max(0, p - 1))
      track('test_message_sent', { bot_id: botId, success: r.success, time_ms: parseInt(r.time) || 0, format })
      if (r.success) {
        const entry: TestHistory = { chatId, text, format, ts: Date.now() }
        const next = [entry, ...lsGet<TestHistory[]>('umbra_test_history', [])].slice(0, 5)
        lsSet('umbra_test_history', next)
        setHistory(next)
      }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao enviar.') }
    finally { setLoading(false) }
  }

  const canSend = !!chatId.trim() && !!botId && !loading && attemptsLeft > 0

  return (
    <Modal open={open} onClose={onClose}
      title="Testar envio de mensagem" subtitle="Envie uma mensagem isolada antes de disparar em massa." size="md"
      footer={<>
        <span className={`text-[11px] mr-auto ${attemptsLeft <= 2 ? 'text-danger' : 'text-text-muted'}`}>
          {attemptsLeft}/10 tentativas restantes
        </span>
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        <Btn variant="primary" disabled={!canSend} onClick={handleSend}>
          {loading ? <><Spinner size={3} /> Enviando…</> : 'Enviar teste'}
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

        {/* Format selector */}
        <ToolField label="Formatação">
          <div className="flex gap-2 flex-wrap">
            {FORMAT_OPTIONS.map(f => (
              <button key={f.v} onClick={() => setFormat(f.v as 'none' | 'HTML' | 'Markdown')}
                className={`px-3 h-8 rounded-lg text-[12px] font-medium border transition-colors ${
                  format === f.v ? 'bg-primary text-primary-fg border-primary' : 'bg-surface border-border text-text hover:bg-surface-2'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {FORMAT_OPTIONS.find(f => f.v === format)?.hint}
          </div>
        </ToolField>

        {/* Variable buttons */}
        <ToolField label="Mensagem">
          <div className="flex gap-1.5 flex-wrap mb-1.5">
            {VARS.map(v => (
              <button key={v} onClick={() => insertVar(v)}
                className="px-2 h-6 rounded text-[11px] font-mono bg-surface-2 border border-border text-text-muted hover:text-primary hover:border-primary/50 transition-colors">
                {v}
              </button>
            ))}
          </div>
          <textarea ref={textareaRef} value={text} onChange={(e) => setText(e.target.value)} rows={3} className={TEXTAREA_CLS} />
        </ToolField>

        {/* History */}
        {history.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">Últimas mensagens</div>
            <div className="space-y-1">
              {history.slice(0, 3).map((h, i) => (
                <button key={i} onClick={() => { setChatId(h.chatId); setText(h.text); setFormat(h.format) }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg bg-surface-2/50 border border-border hover:border-border-strong text-[11.5px] text-text-muted truncate">
                  <span className="font-mono text-text-subtle">{h.chatId}</span> · {h.text.slice(0, 40)}{h.text.length > 40 ? '…' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

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
                {result.success ? `Entregue · ID ${result.messageId}` : 'Falha no envio'}
              </div>
              <div className="text-text-muted mt-0.5">
                {result.success ? `Tempo: ${result.time}` : result.error}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Tool 2 — Validate Token ─────────────────────────────────────────────── */

function ValidateTokenModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { track } = useAnalytics()
  const [token,   setToken]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<{ ok: boolean; name?: string; username?: string; id?: string; error?: string } | null>(null)
  const [attemptsLeft, setAttemptsLeft] = useState(10)

  useEffect(() => { if (open) { setToken(''); setResult(null); setLoading(false); setAttemptsLeft(10) } }, [open])

  async function handleValidate() {
    if (!token.trim() || loading || attemptsLeft <= 0) return
    setLoading(true); setResult(null)
    try {
      const data = await validateBotTokenAction(token.trim())
      setResult({ ok: true, name: data.firstName, username: data.username, id: data.telegramId })
      setAttemptsLeft(p => Math.max(0, p - 1))
      track('token_validated', { valid: true })
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'Erro ao validar.' })
      setAttemptsLeft(p => Math.max(0, p - 1))
      track('token_validated', { valid: false })
    } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose}
      title="Validar token de bot" subtitle="Cheque um token sem precisar conectá-lo ao workspace." size="md"
      footer={<>
        <span className={`text-[11px] mr-auto ${attemptsLeft <= 2 ? 'text-danger' : 'text-text-muted'}`}>
          {attemptsLeft}/10 validações restantes
        </span>
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        <Btn variant="primary" disabled={!token.trim() || loading || attemptsLeft <= 0} onClick={handleValidate}>
          {loading ? <><Spinner size={3} /> Validando…</> : 'Validar token'}
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

/* ── Tool 3 — QR Code ────────────────────────────────────────────────────── */

const QR_SIZES = [
  { v: 160, label: 'Pequeno' }, { v: 220, label: 'Médio' }, { v: 300, label: 'Grande' },
] as const

function QRCodeModal({ open, onClose, bots }: { open: boolean; onClose: () => void; bots: RawBot[] }) {
  const { track }                       = useAnalytics()
  const [botId,    setBotId]            = useState(bots[0]?.id ?? '')
  const [darkColor, setDarkColor]       = useState('#000000')
  const [lightColor, setLightColor]     = useState('#ffffff')
  const [size,     setSize]             = useState<160 | 220 | 300>(220)
  const [qrUrl,    setQrUrl]            = useState<string | null>(null)
  const [loading,  setLoading]          = useState(false)

  const selectedBot = bots.find(b => b.id === botId)
  const telegramUrl = selectedBot ? `https://t.me/${selectedBot.username}` : ''

  useEffect(() => { if (open) setBotId(bots[0]?.id ?? '') }, [open, bots])

  useEffect(() => {
    if (!selectedBot?.username) { setQrUrl(null); return }
    setLoading(true)
    import('qrcode').then(({ default: QRCode }) =>
      QRCode.toDataURL(`https://t.me/${selectedBot.username}`, {
        width: size, margin: 2,
        color: { dark: darkColor, light: lightColor },
      })
    ).then(url => {
      setQrUrl(url)
      track('qr_generated', { bot_username: selectedBot.username })
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, selectedBot?.username, size, darkColor, lightColor])

  function handleDownload() {
    if (!qrUrl || !selectedBot) return
    const a = document.createElement('a')
    a.href = qrUrl; a.download = `qr_${selectedBot.username}_${size}px.png`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
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
            <Icon name="alert-triangle" size={14} className="mt-0.5" /> Nenhum bot cadastrado ainda.
          </div>
        ) : (
          <ToolField label="Bot">
            <SelDrop value={botId} onChange={setBotId}>
              {bots.map(b => <option key={b.id} value={b.id}>@{b.username} — {b.name}</option>)}
            </SelDrop>
          </ToolField>
        )}

        {/* Size + Colors */}
        <div className="grid grid-cols-3 gap-2">
          {QR_SIZES.map(s => (
            <button key={s.v} onClick={() => setSize(s.v as 160 | 220 | 300)}
              className={`h-8 rounded-lg text-[12px] font-medium border transition-colors ${size === s.v ? 'bg-primary text-primary-fg border-primary' : 'bg-surface border-border text-text hover:bg-surface-2'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <ToolField label="Cor do código">
            <div className="flex items-center gap-2">
              <input type="color" value={darkColor} onChange={e => setDarkColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-border bg-surface p-0.5" />
              <span className="text-[12px] font-mono text-text-muted">{darkColor}</span>
            </div>
          </ToolField>
          <ToolField label="Cor do fundo">
            <div className="flex items-center gap-2">
              <input type="color" value={lightColor} onChange={e => setLightColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-border bg-surface p-0.5" />
              <span className="text-[12px] font-mono text-text-muted">{lightColor}</span>
            </div>
          </ToolField>
        </div>

        <div className="bg-surface-2/40 border border-border rounded-xl p-6 flex flex-col items-center min-h-[220px] justify-center">
          {loading && <Spinner />}
          {!loading && qrUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="QR Code" width={size} height={size} className="block rounded" />
              <div className="mt-3 text-center">
                <div className="text-[11.5px] text-text-muted">Aponte a câmera para abrir:</div>
                <div className="text-[13px] font-mono font-semibold text-text mt-0.5">{telegramUrl}</div>
              </div>
            </>
          )}
          {!loading && !qrUrl && bots.length > 0 && (
            <span className="text-[12px] text-text-muted">Selecione um bot para gerar o QR.</span>
          )}
        </div>
        <div className="flex items-start gap-2 text-[11.5px] text-text-muted bg-surface-2/40 border border-border rounded-lg p-3">
          <Icon name="info" size={13} className="mt-0.5 shrink-0" />
          <span>Use em panfletos, banners e embalagens. O Telegram identifica o link automaticamente em câmeras nativas.</span>
        </div>
      </div>
    </Modal>
  )
}

/* ── Tool 4 — Deep Link Generator ───────────────────────────────────────── */

function DeepLinkModal({ open, onClose, bots }: { open: boolean; onClose: () => void; bots: RawBot[] }) {
  const { track }               = useAnalytics()
  const [botId,  setBotId]      = useState(bots[0]?.id ?? '')
  const [param,  setParam]      = useState('')
  const [copied, setCopied]     = useState(false)
  const [history, setHistory]   = useState<DeepLinkHistory[]>([])

  const selectedBot = bots.find(b => b.id === botId)
  const safeParam   = param.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
  const deepLink    = selectedBot?.username ? `https://t.me/${selectedBot.username}?start=${safeParam || 'campanha'}` : ''

  useEffect(() => {
    if (open) { setBotId(bots[0]?.id ?? ''); setParam(''); setCopied(false); setHistory(lsGet<DeepLinkHistory[]>('umbra_deeplink_history', [])) }
  }, [open, bots])

  function handleCopy() {
    if (!deepLink || !selectedBot) return
    navigator.clipboard.writeText(deepLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    track('deep_link_generated', { bot_username: selectedBot.username, param: safeParam })
    if (safeParam) {
      const entry: DeepLinkHistory = { username: selectedBot.username, param: safeParam, ts: Date.now() }
      const next = [entry, ...lsGet<DeepLinkHistory[]>('umbra_deeplink_history', [])].filter(
        (h, i, arr) => i === arr.findIndex(x => x.username === h.username && x.param === h.param)
      ).slice(0, 5)
      lsSet('umbra_deeplink_history', next)
      setHistory(next)
    }
  }

  return (
    <Modal open={open} onClose={onClose}
      title="Gerador de deep link" subtitle="Crie links rastreáveis por campanha, fonte ou anúncio." size="md"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        <Btn variant="primary" icon={copied ? 'check' : 'copy'} disabled={!selectedBot} onClick={handleCopy}>
          {copied ? 'Copiado!' : 'Copiar link'}
        </Btn>
      </>}>
      <div className="space-y-3.5">
        {bots.length === 0 ? (
          <div className="flex items-start gap-2.5 bg-warning-soft border border-warning/30 rounded-lg p-3 text-[12px] text-warning">
            <Icon name="alert-triangle" size={14} className="mt-0.5" /> Nenhum bot cadastrado ainda.
          </div>
        ) : (
          <ToolField label="Bot">
            <SelDrop value={botId} onChange={setBotId}>
              {bots.map(b => <option key={b.id} value={b.id}>@{b.username} — {b.name}</option>)}
            </SelDrop>
          </ToolField>
        )}

        <ToolField label="Parâmetro start" hint="Apenas letras, números, _ e -. Máx. 64 chars. Ex: instagram_jun26, google_ads, story_bio">
          <input type="text" value={param} onChange={e => setParam(e.target.value)}
            placeholder="instagram_campanha_junho" className={INPUT_CLS + ' font-mono'} />
        </ToolField>

        {selectedBot && (
          <div className="bg-surface-2/40 border border-border rounded-xl p-4">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-2">Link gerado</div>
            <div className="font-mono text-[12px] text-text break-all select-all">{deepLink}</div>
            <div className="mt-3 pt-3 border-t border-border flex items-start gap-2 text-[11px] text-text-muted">
              <Icon name="info" size={12} className="mt-0.5 shrink-0" />
              <span>O Telegram repassa o parâmetro <code className="font-mono bg-surface px-1 rounded">start</code> ao bot quando o usuário clica "Iniciar". Use-o para identificar a fonte no webhook.</span>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-text-subtle mb-1.5">Últimos links gerados</div>
            <div className="space-y-1">
              {history.map((h, i) => (
                <button key={i} onClick={() => { const b = bots.find(x => x.username === h.username); if (b) setBotId(b.id); setParam(h.param) }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg bg-surface-2/50 border border-border hover:border-border-strong text-[11.5px] text-text-muted">
                  <span className="font-mono text-text">@{h.username}</span> · {h.param}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Tool 5 — Interactive Flow Preview ──────────────────────────────────── */

function PreviewFlowModal({ open, onClose, flows }: { open: boolean; onClose: () => void; flows: RawFlow[] }) {
  const { track }                = useAnalytics()
  const bottomRef                = useRef<HTMLDivElement>(null)
  const qInputRef                = useRef<HTMLInputElement>(null)

  const [flowId,    setFlowId]   = useState(flows[0]?.id ?? '')
  const [simHistory, setHistory] = useState<SimEntry[]>([])
  const [simPhase,  setPhase]    = useState<SimPhase>('idle')
  const [simVars,   setSimVars]  = useState<Record<string, string>>({})
  const [waitData,  setWaitData] = useState<WaitData | null>(null)
  const [qInput,    setQInput]   = useState('')
  const [branchCount, setBranchCount] = useState(0)
  const [tracked,   setTracked]  = useState(false)

  const selectedFlow = flows.find(f => f.id === flowId)
  const nodes = useMemo(() => (selectedFlow?.nodes ?? []) as FlowNode[], [selectedFlow])
  const edges = useMemo(() => (selectedFlow?.edges ?? []) as FlowEdge[], [selectedFlow])
  const { nodeById, edgesBySource, startNode } = useMemo(() => buildNodeMaps(nodes, edges), [nodes, edges])

  useEffect(() => { if (open) { setFlowId(flows[0]?.id ?? ''); resetSim(); setTracked(false) } }, [open, flows])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [simHistory])
  useEffect(() => { if (simPhase === 'question') qInputRef.current?.focus() }, [simPhase])

  function resetSim() {
    setHistory([]); setPhase('idle'); setSimVars({}); setWaitData(null); setQInput(''); setBranchCount(0)
  }

  function runFrom(nodeId: string, vars: Record<string, string>, depth = 0) {
    if (depth > 30) { setPhase('done'); return }
    const newEntries: SimEntry[] = []
    let curr: string | null = nodeId
    let nextPhase: SimPhase = 'done'
    let nextWait: WaitData | null = null

    while (curr) {
      const node = nodeById.get(curr)
      if (!node) break
      const out: FlowEdge[] = edgesBySource.get(curr!) ?? []
      const d = node.data

      if (node.type === 'buttons') {
        newEntries.push({ k: 'buttons', text: subVars(d.text as string || '', vars), opts: (d.options as string[]) || [] })
        nextPhase = 'buttons'
        nextWait = { k: 'buttons', choices: ((d.options as string[]) || []).map((lbl, i) => ({
          label: lbl, target: out.find(e => e.sourceHandle === `option-${i}`)?.target ?? null,
        }))}
        break
      }
      if (node.type === 'question') {
        newEntries.push({ k: 'bot', text: subVars((d.text || d.question) as string || '', vars) })
        nextPhase = 'question'
        nextWait = { k: 'question', varName: (d.variable as string) || 'resposta', next: out[0]?.target ?? null }
        break
      }

      switch (node.type) {
        case 'message': newEntries.push({ k: 'bot', text: subVars(d.text as string || '', vars) }); break
        case 'tag':     newEntries.push({ k: 'sys', text: `🏷️ Tag "${d.tag}" ${d.action === 'remove' ? 'removida' : 'adicionada'}` }); break
        case 'delay':   newEntries.push({ k: 'sys', text: `⏱ Aguarda ${d.amount} ${d.unit}` }); break
        case 'image':   newEntries.push({ k: 'bot', text: `📷 Imagem${d.caption ? ' — ' + d.caption : ''}` }); break
        case 'link':    newEntries.push({ k: 'bot', text: `🔗 ${d.label || 'Link'}: ${d.url}` }); break
        case 'offer':   newEntries.push({ k: 'offer', product: d.product as string || '', price: (d.price as number) || 0, cta: d.cta as string || 'Comprar' }); break
        case 'condition': newEntries.push({ k: 'sys', text: `🔀 Condição avaliada — seguindo primeiro caminho` }); break
        case 'handoff': newEntries.push({ k: 'sys', text: '👤 Transferindo para atendimento humano' }); curr = null; continue
      }

      curr = out[0]?.target ?? null
      if (!curr) nextPhase = 'done'
    }

    setHistory(prev => [...prev, ...newEntries])
    setPhase(nextPhase)
    setWaitData(nextWait)
  }

  function handleStart() {
    if (!startNode) return
    resetSim()
    if (!tracked && selectedFlow) {
      track('flow_previewed', { flow_id: selectedFlow.id, node_count: nodes.length })
      setTracked(true)
    }
    setTimeout(() => runFrom(startNode.id, {}), 10)
  }

  function handleButton(idx: number) {
    if (waitData?.k !== 'buttons') return
    const choice = waitData.choices[idx]
    setBranchCount(p => p + 1)
    setHistory(prev => {
      const updated = [...prev]
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].k === 'buttons') { (updated[i] as {k:'buttons';opts:string[];chosen?:number;text:string}).chosen = idx; break }
      }
      return [...updated, { k: 'user', text: choice.label }]
    })
    setWaitData(null)
    if (choice.target) runFrom(choice.target, simVars)
    else setPhase('done')
  }

  function handleQuestion() {
    if (waitData?.k !== 'question' || !qInput.trim()) return
    const ans = qInput.trim()
    const newVars = { ...simVars, [waitData.varName]: ans }
    setSimVars(newVars)
    setHistory(prev => [...prev, { k: 'user', text: ans }])
    setQInput('')
    setWaitData(null)
    if (waitData.next) runFrom(waitData.next, newVars)
    else setPhase('done')
  }

  function SimEntryView({ entry, isActive }: { entry: SimEntry; isActive: boolean }) {
    if (entry.k === 'bot') return (
      <div className="flex justify-start">
        <div className="max-w-[280px] text-[12px] leading-snug px-3 py-2 rounded-2xl rounded-bl-sm bg-surface text-text border border-border whitespace-pre-wrap">{entry.text}</div>
      </div>
    )
    if (entry.k === 'user') return (
      <div className="flex justify-end">
        <div className="max-w-[200px] text-[12px] leading-snug px-3 py-2 rounded-2xl rounded-br-sm bg-primary text-primary-fg">{entry.text}</div>
      </div>
    )
    if (entry.k === 'sys') return (
      <div className="text-center py-0.5">
        <span className="text-[10.5px] text-text-subtle">{entry.text}</span>
      </div>
    )
    if (entry.k === 'offer') return (
      <div className="flex justify-start">
        <div className="ml-0 max-w-[240px] bg-surface border border-border rounded-2xl rounded-bl-sm p-3">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle">Oferta</div>
          <div className="text-[12.5px] font-semibold text-text mt-1">{entry.product}</div>
          <div className="text-[15px] font-semibold text-success mt-0.5">{fmtBRL(entry.price)}</div>
          <div className="w-full mt-2 h-7 bg-primary text-primary-fg text-[11.5px] font-medium rounded-md flex items-center justify-center">{entry.cta}</div>
        </div>
      </div>
    )
    if (entry.k === 'buttons') return (
      <div className="space-y-1.5">
        <div className="flex justify-start">
          <div className="max-w-[280px] text-[12px] px-3 py-2 rounded-2xl rounded-bl-sm bg-surface text-text border border-border">{entry.text}</div>
        </div>
        <div className="ml-1 flex flex-wrap gap-1.5">
          {entry.opts.map((opt, bi) => (
            <button key={bi}
              onClick={() => isActive && entry.chosen === undefined && handleButton(bi)}
              disabled={!isActive || entry.chosen !== undefined}
              className={`px-2.5 py-1 rounded text-[11.5px] border transition-colors ${
                entry.chosen === bi
                  ? 'bg-primary text-primary-fg border-primary'
                  : entry.chosen !== undefined
                  ? 'bg-surface border-border text-text-subtle opacity-40 cursor-default'
                  : isActive
                  ? 'bg-surface border-border text-text hover:bg-surface-2 hover:border-border-strong cursor-pointer'
                  : 'bg-surface border-border text-text-subtle opacity-40 cursor-default'
              }`}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    )
    return null
  }

  return (
    <Modal open={open} onClose={onClose}
      title="Prévia interativa de fluxo" subtitle="Clique nos botões e responda perguntas para simular o fluxo real." size="lg"
      footer={<>
        {simPhase !== 'idle' && (
          <Btn variant="ghost" icon="rotate-ccw" onClick={() => { resetSim(); setTimeout(() => handleStart(), 10) }}>
            Reiniciar
          </Btn>
        )}
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        {simPhase === 'idle' && (
          <Btn variant="primary" icon="play" disabled={!startNode || flows.length === 0} onClick={handleStart}>
            Iniciar simulação
          </Btn>
        )}
      </>}>
      <div className="space-y-3.5">
        {flows.length === 0 ? (
          <div className="flex items-start gap-2.5 bg-warning-soft border border-warning/30 rounded-lg p-3 text-[12px] text-warning">
            <Icon name="alert-triangle" size={14} className="mt-0.5" /> Nenhum fluxo criado ainda.
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="flex-1">
              <SelDrop value={flowId} onChange={v => { setFlowId(v); resetSim(); setTracked(false) }}>
                {flows.map(f => <option key={f.id} value={f.id}>{f.name} {f.status === 'published' ? '✓' : '(rascunho)'}</option>)}
              </SelDrop>
            </div>
            {nodes.length > 0 && (
              <div className="h-10 px-3 flex items-center text-[11.5px] text-text-muted bg-surface-2/40 border border-border rounded-lg shrink-0">
                {nodes.length} nós
              </div>
            )}
          </div>
        )}

        {/* Chat area */}
        {flows.length > 0 && (
          <div className="bg-surface-2/20 border border-border rounded-xl p-4 space-y-2 min-h-[280px] max-h-[400px] overflow-y-auto">
            {simPhase === 'idle' && (
              <div className="flex flex-col items-center justify-center h-[220px] text-center">
                <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center mb-3">
                  <Icon name="play-circle" size={20} className="text-text-muted" />
                </div>
                <div className="text-[13px] font-medium text-text">Simulação pronta</div>
                <div className="text-[12px] text-text-muted mt-1">Clique em "Iniciar simulação" para começar</div>
              </div>
            )}

            {simHistory.map((entry, i) => {
              const isLastButtons = entry.k === 'buttons' && i === simHistory.length - 1 && simPhase === 'buttons'
              return <SimEntryView key={i} entry={entry} isActive={isLastButtons} />
            })}

            {/* Question input */}
            {simPhase === 'question' && (
              <div className="flex gap-2 pt-1">
                <input ref={qInputRef} value={qInput} onChange={e => setQInput(e.target.value)}
                  placeholder="Digite sua resposta…"
                  className={INPUT_CLS + ' text-[12px]'}
                  onKeyDown={e => { if (e.key === 'Enter') handleQuestion() }} />
                <button onClick={handleQuestion} disabled={!qInput.trim()}
                  className="h-10 px-3 bg-primary text-primary-fg rounded-lg disabled:opacity-50 flex items-center justify-center">
                  <Icon name="chevron-right" size={16} />
                </button>
              </div>
            )}

            {simPhase === 'done' && (
              <div className="text-center pt-2">
                <span className="inline-flex items-center gap-1 text-[11px] text-text-subtle font-semibold px-3 py-1 bg-surface border border-border rounded-full">
                  <Icon name="check" size={11} /> Fim do fluxo {branchCount > 0 ? `· ${branchCount} branch${branchCount !== 1 ? 'es' : ''} seguido${branchCount !== 1 ? 's' : ''}` : ''}
                </span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {/* Vars captured */}
        {Object.keys(simVars).length > 0 && (
          <div className="bg-surface-2/30 border border-border rounded-lg p-3">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-2">Variáveis capturadas</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(simVars).map(([k, v]) => (
                <span key={k} className="px-2 py-0.5 bg-surface border border-border rounded text-[11.5px] font-mono">
                  <span className="text-primary">{'{' + k + '}'}</span> = {v}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Tool 6 — Import Config ──────────────────────────────────────────────── */

function ImportRow({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} size={12} className="text-text-muted shrink-0" />
      <span className="text-[12px] text-text-muted">{label}:</span>
      <span className="text-[12px] text-text font-semibold ml-auto">{fmtNum(count)}</span>
    </div>
  )
}

function ImportConfigModal({ open, onClose, onToast }: {
  open: boolean; onClose: () => void; onToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const { track }                 = useAnalytics()
  const fileRef                   = useRef<HTMLInputElement>(null)
  const [fileName, setFileName]   = useState('')
  const [parsing,  setParsing]    = useState(false)
  const [parseErr, setParseErr]   = useState('')
  const [parsed,   setParsed]     = useState<ParsedBackup | null>(null)
  const [rawJson,  setRawJson]    = useState('')
  const [importing, setImporting] = useState(false)
  const [isDragging, setDragging] = useState(false)

  useEffect(() => {
    if (open) { setFileName(''); setParsed(null); setRawJson(''); setParsing(false); setParseErr(''); setDragging(false) }
  }, [open])

  function processFile(file: File) {
    if (!file.name.endsWith('.json')) { setParseErr('Apenas arquivos .json são suportados.'); return }
    setFileName(file.name); setParsing(true); setParseErr(''); setParsed(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json  = ev.target?.result as string
        const data  = JSON.parse(json) as Record<string, unknown>
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
          exportedAt: data.exported_at as string | undefined,
          version:   data.version as string | undefined,
        })
        setRawJson(json)
      } catch { setParseErr('Arquivo inválido. Certifique-se que é um backup exportado pelo Umbra Bot.') }
      finally { setParsing(false) }
    }
    reader.readAsText(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setDragging(true) }
  function handleDragLeave() { setDragging(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  async function doImport() {
    if (!rawJson) return
    setImporting(true)
    try {
      const { imported, errors } = await importConfigAction(rawJson)
      const total = Object.values(imported).reduce((a, b) => a + b, 0)
      track('config_imported', imported)
      if (errors.length > 0) onToast(`${total} itens importados com ${errors.length} erro(s).`, 'error')
      else onToast(`${total} itens importados com sucesso de ${fileName}.`)
      onClose()
    } catch (e) { onToast(e instanceof Error ? e.message : 'Erro ao importar.', 'error') }
    finally { setImporting(false) }
  }

  return (
    <Modal open={open} onClose={onClose}
      title="Importar configurações" subtitle="Restaure o workspace a partir de um backup JSON." size="md"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" disabled={!parsed || !!parseErr || importing} onClick={doImport}>
          {importing ? <><Spinner size={3} /> Importando…</> : 'Importar configurações'}
        </Btn>
      </>}>
      <div className="space-y-3.5">
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />

        {!fileName ? (
          <button
            onClick={() => fileRef.current?.click()}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            className={`w-full border-2 border-dashed rounded-xl py-10 px-6 flex flex-col items-center justify-center text-center focus:outline-none transition-colors ${
              isDragging ? 'border-primary/60 bg-primary/5' : 'bg-surface-2/30 border-border hover:bg-surface-2/50 hover:border-primary/50'
            }`}>
            <div className="w-12 h-12 rounded-xl bg-surface border border-border text-text-muted flex items-center justify-center mb-3">
              <Icon name="upload" size={20} />
            </div>
            <div className="text-[13px] font-semibold text-text">{isDragging ? 'Solte o arquivo aqui' : 'Arraste o arquivo ou clique para selecionar'}</div>
            <div className="text-[11.5px] text-text-muted mt-1">Backup JSON exportado pelo Umbra Bot</div>
          </button>
        ) : (
          <div className="bg-surface-2/40 border border-border rounded-lg p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-primary-soft text-primary flex items-center justify-center shrink-0">
              <Icon name="file-text" size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-text truncate">{fileName}</div>
              <div className="text-[11px] text-text-muted">
                {parsing ? 'Lendo arquivo…' : parseErr ? 'Arquivo inválido' : parsed ? `${parsed.size}${parsed.version ? ` · v${parsed.version}` : ''} · workspace válido` : ''}
              </div>
            </div>
            {parsing && <Spinner size={4} />}
            {!parsing && (
              <button onClick={() => { setFileName(''); setParsed(null); setRawJson(''); setParseErr('') }}
                className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text">
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
            {parsed.exportedAt && (
              <div className="text-[11px] text-text-muted mb-2.5 flex items-center gap-1.5">
                <Icon name="clock" size={11} className="shrink-0" />
                Exportado em {fmtDate(parsed.exportedAt)}
              </div>
            )}
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-2.5">Conteúdo a importar</div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              <ImportRow icon="bot"         label="Bots"       count={parsed.bots} />
              <ImportRow icon="git-branch"  label="Fluxos"     count={parsed.flows} />
              <ImportRow icon="layers"      label="Sequências" count={parsed.sequences} />
              <ImportRow icon="credit-card" label="Gateways"   count={parsed.gateways} />
              <ImportRow icon="link"        label="Links"      count={parsed.links} />
              <ImportRow icon="tag"         label="Tags"       count={parsed.tags} />
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-start gap-2 text-[11px] text-warning">
              <Icon name="alert-triangle" size={12} className="mt-0.5 shrink-0" />
              <span>A importação <strong>substitui</strong> itens com o mesmo ID e <strong>cria os novos</strong>. Exporte um backup antes de continuar.</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Tool 7 — Export Config ──────────────────────────────────────────────── */

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
    getExportCountsAction().then(setCounts).catch(() => setCounts(null)).finally(() => setLoading(false))
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
    } catch (e) { onToast(e instanceof Error ? e.message : 'Erro ao exportar.', 'error') }
    finally { setExporting(false) }
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
          {exporting ? <><Spinner size={3} /> Gerando…</> : `Baixar JSON (${totalSelected})`}
        </Btn>
      </>}>
      <div>
        {loading ? (
          <div className="flex items-center gap-2 py-4 justify-center text-[12px] text-text-muted">
            <Spinner size={4} /> Carregando contagens do banco…
          </div>
        ) : (
          <div className="space-y-0.5">
            {EXPORT_ROWS.map((p) => (
              <label key={p.key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-2 cursor-pointer">
                <input type="checkbox" checked={parts[p.key] ?? false} onChange={() => toggle(p.key)}
                  className="w-4 h-4 rounded border-border cursor-pointer accent-[var(--primary)] shrink-0" />
                <Icon name={p.icon} size={13} className="text-text-muted shrink-0" />
                <span className="flex-1 text-[12.5px] text-text">{p.label}</span>
                {p.warn && <span className="inline-flex items-center px-1.5 h-5 rounded bg-warning-soft text-warning text-[10.5px] font-semibold">LGPD</span>}
                <span className="text-[11.5px] text-text-muted shrink-0">
                  {counts ? fmtNum(counts[p.key as keyof ExportCounts] ?? 0) : '—'}
                </span>
              </label>
            ))}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="flex items-start gap-2 text-[11.5px] text-text-muted">
            <Icon name="info" size={13} className="mt-0.5 shrink-0" />
            <span>Tokens de bots e chaves de gateway <strong>não</strong> são incluídos. Reconexão manual necessária ao importar em outra conta.</span>
          </div>
          <div className="flex items-start gap-2 text-[11.5px] text-text-muted">
            <Icon name="refresh-cw" size={13} className="mt-0.5 shrink-0 text-primary" />
            <span className="text-primary">Dica: automatize backups semanais com o Vercel Cron apontando para <code className="font-mono bg-surface px-1 rounded">/api/cron/export-backup</code>.</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ── Tool 8 — Diagnostics ────────────────────────────────────────────────── */

const DIAG_CHECKS = [
  { id: 'bots',     label: 'Bots conectados',      icon: 'bot',         fn: checkBotsAction },
  { id: 'webhooks', label: 'Webhooks',              icon: 'webhook',     fn: checkWebhooksAction },
  { id: 'gateways', label: 'Gateways de pagamento', icon: 'credit-card', fn: checkGatewaysAction },
  { id: 'queue',    label: 'Fila de envios',        icon: 'inbox',       fn: checkQueueAction },
  { id: 'dns',      label: 'DNS e certificados',    icon: 'globe',       fn: checkDnsAction },
  { id: 'storage',  label: 'Armazenamento e dados', icon: 'database',    fn: checkStorageAction },
] as const

function DiagnosticsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { track }             = useAnalytics()
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Record<string, DiagResult>>({})
  const [copied,  setCopied]  = useState(false)
  const hasRun = Object.keys(results).length > 0

  const completed = Object.values(results).filter(r => r.status === 'pass' || r.status === 'fail').length
  const failed    = Object.values(results).filter(r => r.status === 'fail').length
  const allDone   = hasRun && completed === DIAG_CHECKS.length && !running

  const runAll = useCallback(async () => {
    setRunning(true); setResults({})
    for (const check of DIAG_CHECKS) {
      setResults(p => ({ ...p, [check.id]: { status: 'running', detail: '' } }))
      const t0 = Date.now()
      try {
        const r = await (check.fn as () => Promise<{ pass: boolean; detail: string }>)()
        setResults(p => ({ ...p, [check.id]: { status: r.pass ? 'pass' : 'fail', detail: r.detail, timeMs: Date.now() - t0 } }))
      } catch (e) {
        setResults(p => ({ ...p, [check.id]: { status: 'fail', detail: e instanceof Error ? e.message : 'Falha.', timeMs: Date.now() - t0 } }))
      }
    }
    setRunning(false)
  }, [])

  // Auto-run when modal opens
  useEffect(() => {
    if (open) {
      setResults({}); setCopied(false)
      const t = setTimeout(() => runAll(), 300)
      return () => clearTimeout(t)
    }
  }, [open, runAll])

  useEffect(() => {
    if (allDone) track('diagnostics_run', { checks: DIAG_CHECKS.length, failed })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone])

  function copyResults() {
    const lines = DIAG_CHECKS.map(c => {
      const r = results[c.id]
      if (!r || r.status === 'idle') return `[ ] ${c.label}: Não verificado`
      const icon = r.status === 'pass' ? '[✓]' : r.status === 'fail' ? '[✗]' : '[-]'
      const time = r.timeMs != null ? ` (${r.timeMs}ms)` : ''
      return `${icon} ${c.label}: ${r.detail}${time}`
    }).join('\n')
    const header = `Diagnóstico Umbra Bot — ${new Date().toLocaleString('pt-BR')}\n${'─'.repeat(48)}\n`
    navigator.clipboard.writeText(header + lines)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal open={open} onClose={onClose}
      title="Diagnóstico do sistema" subtitle="Checagem automática de todos os componentes do workspace." size="lg"
      footer={<>
        {allDone && (
          <Btn variant="ghost" icon={copied ? 'check' : 'copy'} onClick={copyResults}>
            {copied ? 'Copiado!' : 'Copiar resultado'}
          </Btn>
        )}
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        <Btn variant="primary" icon="play" disabled={running} onClick={runAll}>
          {running ? <><Spinner size={3} /> Verificando ({completed}/{DIAG_CHECKS.length})…</> : 'Repetir diagnóstico'}
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
                  {!r                      && <div className="text-[11px] text-text-muted mt-0.5">Iniciando…</div>}
                  {r?.status === 'running' && <div className="text-[11px] text-text-muted mt-0.5">Verificando…</div>}
                  {r?.status === 'pass'    && <div className="text-[11px] text-success mt-0.5 leading-snug">{r.detail}</div>}
                  {r?.status === 'fail'    && <div className="text-[11px] text-danger mt-0.5 leading-snug">{r.detail}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r?.timeMs != null && (r.status === 'pass' || r.status === 'fail') && (
                    <span className="text-[10px] text-text-subtle font-mono">{r.timeMs}ms</span>
                  )}
                  {!r                      && <span className="w-4 h-4 rounded-full border border-border-strong inline-block" />}
                  {r?.status === 'running' && <Spinner size={4} />}
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
            {failed > 0 && <div className="text-text-muted mt-0.5">Revise os itens em vermelho e acesse Alertas para mais detalhes.</div>}
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ── Tool 9 — Clear Cache ────────────────────────────────────────────────── */

function ClearCacheModal({ open, onClose, onToast }: {
  open: boolean; onClose: () => void; onToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const { track }                   = useAnalytics()
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
    } catch (e) { onToast(e instanceof Error ? e.message : 'Erro ao limpar cache.', 'error') }
    finally { setClearing(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Limpar cache do workspace" size="sm"
      footer={confirming ? (
        <>
          <Btn variant="secondary" onClick={() => setConfirming(false)}>Cancelar</Btn>
          <Btn variant="danger" disabled={clearing} onClick={doClear}>
            {clearing ? <><Spinner size={3} /> Limpando…</> : 'Sim, limpar tudo'}
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

/* ── Tool 10 — LGPD Check ────────────────────────────────────────────────── */

function LgpdCheckModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { track }             = useAnalytics()
  const [data,    setData]    = useState<LgpdData | null>(null)
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true); setErr(''); setData(null)
    getLgpdDataAction()
      .then(d => { setData(d); track('lgpd_check_run', { contacts: d.total, with_email: d.with_email, with_phone: d.with_phone }) })
      .catch(e => setErr(e instanceof Error ? e.message : 'Erro ao verificar dados.'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function pct(n: number) { return data && data.total > 0 ? `${((n / data.total) * 100).toFixed(0)}%` : '0%' }

  const rows = data ? [
    { label: 'Nome',          count: data.with_name,     icon: 'bot',      level: 'info',    lgpd: 'Dado pessoal' },
    { label: 'E-mail',        count: data.with_email,    icon: 'send',     level: 'warning', lgpd: 'Dado sensível' },
    { label: 'Telefone',      count: data.with_phone,    icon: 'key',      level: 'warning', lgpd: 'Dado sensível' },
    { label: 'Username TG',   count: data.with_username, icon: 'link',     level: 'info',    lgpd: 'Dado público' },
    { label: 'Cidade/Estado', count: data.with_city,     icon: 'globe',    level: 'info',    lgpd: 'Dado pessoal' },
    { label: 'Tags',          count: data.total_tag_assignments, icon: 'tag', level: 'ok', lgpd: 'Metadado' },
  ] : []

  const levelColor = (l: string) =>
    l === 'warning' ? 'text-warning' : l === 'ok' ? 'text-success' : 'text-text-muted'
  const levelBg = (l: string) =>
    l === 'warning' ? 'bg-warning-soft text-warning' : l === 'ok' ? 'bg-success-soft text-success' : 'bg-surface-2 text-text-muted'

  return (
    <Modal open={open} onClose={onClose}
      title="Verificador de LGPD" subtitle="Dados pessoais armazenados nos seus contatos." size="md"
      footer={<Btn variant="primary" onClick={onClose}>Fechar</Btn>}>
      <div className="space-y-3.5">
        {loading && (
          <div className="flex items-center gap-2 py-8 justify-center text-[12px] text-text-muted">
            <Spinner size={4} /> Verificando dados no banco…
          </div>
        )}
        {err && (
          <div className="flex items-start gap-2.5 bg-danger-soft border border-danger/30 rounded-lg p-3 text-[12px] text-danger">
            <Icon name="alert-circle" size={14} className="mt-0.5" /> {err}
          </div>
        )}
        {data && (
          <>
            {/* Summary */}
            <div className="bg-surface-2/40 border border-border rounded-xl p-4">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle mb-3">Resumo do banco</div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[22px] font-semibold text-text">{fmtNum(data.total)}</div>
                  <div className="text-[11px] text-text-muted">Contatos totais</div>
                </div>
                <div>
                  <div className="text-[22px] font-semibold text-warning">{fmtNum(data.with_email + data.with_phone)}</div>
                  <div className="text-[11px] text-text-muted">Dados sensíveis</div>
                </div>
                <div>
                  <div className="text-[22px] font-semibold text-primary">{data.unique_tags}</div>
                  <div className="text-[11px] text-text-muted">Tags únicas</div>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-surface-2/50 border-b border-border">
                    <th className="text-left px-3 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">Tipo de dado</th>
                    <th className="text-right px-3 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">Contatos</th>
                    <th className="text-right px-3 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">%</th>
                    <th className="text-right px-3 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">LGPD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map(row => (
                    <tr key={row.label} className="hover:bg-surface-2/30">
                      <td className="px-3 py-2.5 text-text">{row.label}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${levelColor(row.level)}`}>{fmtNum(row.count)}</td>
                      <td className={`px-3 py-2.5 text-right text-text-muted`}>{pct(row.count)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`inline-flex items-center px-1.5 h-5 rounded text-[10px] font-semibold ${levelBg(row.level)}`}>
                          {row.lgpd}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Note */}
            <div className="flex items-start gap-2 bg-success-soft/50 border border-success/20 rounded-lg p-3 text-[11.5px] text-text leading-relaxed">
              <Icon name="shield" size={13} className="text-success mt-0.5 shrink-0" />
              <span>Todos os dados são armazenados no Supabase com RLS ativo. <strong>Apenas você</strong> tem acesso aos seus contatos. Tokens e chaves de API são criptografados com AES-256-GCM.</span>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/* ── Modal registry ──────────────────────────────────────────────────────── */

type ModalProps = { open: boolean; onClose: () => void; onToast: (msg: string, type?: 'success' | 'error') => void; bots: RawBot[]; flows: RawFlow[] }

function ActiveModal({ toolId, ...props }: { toolId: ToolId | null } & ModalProps) {
  if (!toolId) return null
  switch (toolId) {
    case 'test_message':   return <TestMessageModal   open={props.open} onClose={props.onClose} bots={props.bots} />
    case 'validate_token': return <ValidateTokenModal open={props.open} onClose={props.onClose} />
    case 'qr_code':        return <QRCodeModal        open={props.open} onClose={props.onClose} bots={props.bots} />
    case 'deep_link':      return <DeepLinkModal      open={props.open} onClose={props.onClose} bots={props.bots} />
    case 'preview_flow':   return <PreviewFlowModal   open={props.open} onClose={props.onClose} flows={props.flows} />
    case 'import_config':  return <ImportConfigModal  open={props.open} onClose={props.onClose} onToast={props.onToast} />
    case 'export_config':  return <ExportConfigModal  open={props.open} onClose={props.onClose} onToast={props.onToast} />
    case 'diagnostics':    return <DiagnosticsModal   open={props.open} onClose={props.onClose} />
    case 'clear_cache':    return <ClearCacheModal    open={props.open} onClose={props.onClose} onToast={props.onToast} />
    case 'lgpd_check':     return <LgpdCheckModal     open={props.open} onClose={props.onClose} />
  }
}

/* ── ToolsClient (main) ──────────────────────────────────────────────────── */

export function ToolsClient({ bots, flows }: { bots: RawBot[]; flows: RawFlow[] }) {
  const { track } = useAnalytics()
  const [openTool, setOpenTool] = useState<ToolId | null>(null)
  const [toast, setToast]       = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const toastKey                = useRef(0)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast, toastKey.current]) // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/refs

  const handleToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    toastKey.current++
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
    <>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Ferramentas</h1>
          <p className="text-[13px] text-text-muted mt-0.5">Utilitários para testes, diagnósticos, backup e conformidade.</p>
        </div>
      </div>

      {toast && <ToastBar msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, items]) => (
          <section key={cat}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">{cat}</h2>
              <span className="text-[10.5px] text-text-subtle">{items.length} ferramenta{items.length !== 1 ? 's' : ''}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map(t => <ToolCard key={t.id} tool={t} onOpen={() => handleOpen(t.id)} />)}
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
    </>
  )
}
