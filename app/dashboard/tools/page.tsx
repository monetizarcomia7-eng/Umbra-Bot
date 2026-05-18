'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import {
  Send, Key, QrCode, PlayCircle, Upload, Download, Stethoscope, Eraser,
  ArrowUpRight, Bot, CheckCircle2, XCircle, Check, Info, AlertCircle, X,
  GitBranch, Layers, CreditCard, Link, Tag, Webhook, FileText,
  AlertTriangle, Inbox, Globe, Database, Play, ShoppingBag, HelpCircle,
} from 'lucide-react'

/* ── Types ───────────────────────────────────────────────────── */

interface Tool {
  id: string
  title: string
  description: string
  icon: string
  color: string
  category: string
}

interface DiagCheck {
  id: string
  label: string
  icon: string
  duration: number
  pass: boolean
  detail: string
}

type DiagStatus = 'running' | 'pass' | 'fail'

type FlowStep =
  | { kind: 'message'; text: string }
  | { kind: 'incoming'; text: string }
  | { kind: 'buttons'; text: string; options: string[] }
  | { kind: 'delay'; amount: number; unit: string }
  | { kind: 'offer'; product: string; price: number; cta: string }

/* ── Constants ───────────────────────────────────────────────── */

const TOOL_LIST: Tool[] = [
  { id: 'test_message',   title: 'Testar envio de mensagem',    description: 'Envie uma mensagem de teste pra um chat ID específico antes de disparar pra base inteira.',     icon: 'send',         color: 'var(--primary)',         category: 'Bots & mensagens' },
  { id: 'validate_token', title: 'Validar token de bot',         description: 'Verifique se um token do BotFather é válido e veja as informações públicas do bot.',              icon: 'key',          color: 'var(--success)',         category: 'Bots & mensagens' },
  { id: 'qr_code',        title: 'Gerar QR code do bot',         description: 'Crie um QR code que abre o Telegram direto na conversa do bot — útil pra material impresso.',     icon: 'qr-code',      color: 'var(--warning)',         category: 'Bots & mensagens' },
  { id: 'preview_flow',   title: 'Prévia de fluxo',              description: 'Simule a execução de um fluxo passo a passo sem precisar disparar um teste real.',               icon: 'play-circle',  color: 'oklch(0.62 0.16 200)',   category: 'Fluxos' },
  { id: 'import_config',  title: 'Importar configurações',       description: 'Restaure bots, fluxos, tags e gateways a partir de um arquivo JSON exportado.',                  icon: 'upload',       color: 'oklch(0.58 0.05 280)',   category: 'Configuração' },
  { id: 'export_config',  title: 'Exportar configurações',       description: 'Baixe um JSON com a configuração completa do workspace — backup ou migração entre contas.',       icon: 'download',     color: 'oklch(0.58 0.05 280)',   category: 'Configuração' },
  { id: 'diagnostics',    title: 'Diagnóstico do sistema',       description: 'Roda checagens em todos os componentes — bots, gateways, webhooks, DNS, fila de envios.',        icon: 'stethoscope',  color: 'var(--danger)',          category: 'Configuração' },
  { id: 'clear_cache',    title: 'Limpar cache do workspace',    description: 'Limpa caches internos. Útil quando informações estão desatualizadas após mudanças.',              icon: 'eraser',       color: 'oklch(0.58 0.05 280)',   category: 'Configuração' },
]

const SENDER_BOTS = [
  '@mentoria_vip_bot',
  '@lancamento_black_bot',
  '@upsell_pos_bot',
  '@vendas_curso_bot',
  '@suporte_premium_bot',
]

const FLOWS = [
  'Funil VIP — Lançamento',
  'Upsell pós-compra',
  'Carrinho abandonado 24h',
  'Remarketing 7 dias',
  'Bem-vindo + Oferta',
]

const SAMPLE_PREVIEW: Record<string, FlowStep[]> = {
  'Funil VIP — Lançamento': [
    { kind: 'message',  text: 'Olá! Bem-vindo à Mentoria VIP.' },
    { kind: 'message',  text: 'Qual seu nome?' },
    { kind: 'incoming', text: 'João' },
    { kind: 'message',  text: 'Prazer em te conhecer, João!' },
    { kind: 'buttons',  text: 'O que você busca hoje?', options: ['Aumentar receita', 'Aprender mais'] },
    { kind: 'incoming', text: 'Aumentar receita' },
    { kind: 'offer',    product: 'Mentoria Premium Anual', price: 1297, cta: 'Comprar agora' },
  ],
  'Upsell pós-compra': [
    { kind: 'message', text: 'Obrigado pela compra de Mentoria Premium Anual!' },
    { kind: 'delay',   amount: 2, unit: 'horas' },
    { kind: 'offer',   product: 'Pack Templates Pro', price: 70, cta: 'Adicionar à compra' },
  ],
  'Carrinho abandonado 24h': [
    { kind: 'delay',   amount: 24, unit: 'horas' },
    { kind: 'message', text: 'João, vi que você quase fechou! Olha só…' },
    { kind: 'offer',   product: 'Curso Intensivo 90d', price: 147, cta: 'Garantir minha vaga' },
  ],
  'Remarketing 7 dias': [
    { kind: 'delay',   amount: 7, unit: 'dias' },
    { kind: 'message', text: 'Oi João, faz uma semana que conversamos. Tudo bem?' },
  ],
  'Bem-vindo + Oferta': [
    { kind: 'message', text: 'Olá! Que bom te ver aqui.' },
    { kind: 'offer',   product: 'E-book Estratégias', price: 20, cta: 'Quero o material' },
  ],
}

const DIAG_CHECKS: DiagCheck[] = [
  { id: 'bots',     label: 'Bots conectados',       icon: 'bot',         duration: 700,  pass: true,  detail: '5/5 bots respondendo. 1 com latência alta (@suporte_premium_bot · 8.2s).' },
  { id: 'webhooks', label: 'Webhooks',               icon: 'webhook',     duration: 1100, pass: false, detail: '1 webhook falhando: POST /receive em integrations.com/umbra retornou 502.' },
  { id: 'gateways', label: 'Gateways de pagamento',  icon: 'credit-card', duration: 900,  pass: true,  detail: 'Pushinpay, Mercado Pago e Stripe operacionais. Latência média: 312 ms.' },
  { id: 'queue',    label: 'Fila de envios',         icon: 'inbox',       duration: 500,  pass: true,  detail: '23 mensagens em fila · processamento ~30 msg/s.' },
  { id: 'dns',      label: 'DNS e certificados',     icon: 'globe',       duration: 800,  pass: false, detail: 'SSL de checkout.minhaempresa.com.br expira em 14 dias. Renovação recomendada.' },
  { id: 'storage',  label: 'Armazenamento e cache',  icon: 'database',    duration: 600,  pass: true,  detail: '14% utilizado · 2,1 GB de 15 GB. Cache atualizado.' },
]

/* ── Formatters ──────────────────────────────────────────────── */

function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function fmtBRL(n: number) { return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

/* ── Icon system ─────────────────────────────────────────────── */

const ICON_MAP: Record<string, React.ElementType> = {
  'send':          Send,
  'key':           Key,
  'qr-code':       QrCode,
  'play-circle':   PlayCircle,
  'upload':        Upload,
  'download':      Download,
  'stethoscope':   Stethoscope,
  'eraser':        Eraser,
  'arrow-up-right': ArrowUpRight,
  'bot':           Bot,
  'check-circle-2': CheckCircle2,
  'x-circle':      XCircle,
  'check':         Check,
  'info':          Info,
  'alert-circle':  AlertCircle,
  'x':             X,
  'git-branch':    GitBranch,
  'layers':        Layers,
  'credit-card':   CreditCard,
  'link':          Link,
  'tag':           Tag,
  'webhook':       Webhook,
  'file-text':     FileText,
  'alert-triangle': AlertTriangle,
  'inbox':         Inbox,
  'globe':         Globe,
  'database':      Database,
  'play':          Play,
  'shopping-bag':  ShoppingBag,
}

function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const I = ICON_MAP[name] ?? HelpCircle
  return <I size={size} className={className} />
}

/* ── Base UI ─────────────────────────────────────────────────── */

function Spinner() {
  return <div className="w-4 h-4 rounded-full border-2 border-border border-t-primary animate-spin shrink-0" />
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <input type="checkbox" checked={checked} onChange={onChange}
      className="w-4 h-4 rounded border-border cursor-pointer accent-[var(--primary)] shrink-0" />
  )
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
  const vr   = variant === 'primary' ? 'bg-primary text-primary-fg hover:opacity-90' :
               variant === 'danger'  ? 'bg-danger text-white hover:opacity-90' :
                                       'bg-surface-2 border border-border text-text hover:bg-surface-3'
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

const INPUT_CLS     = 'w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50'
const TEXTAREA_CLS  = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none leading-relaxed'

function SelDrop({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="relative inline-flex items-center w-full">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 pl-3 pr-8 bg-surface border border-border rounded-lg text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <Icon name="x" size={0} className="hidden" />
    </div>
  )
}

/* ── Tool Card ───────────────────────────────────────────────── */

function ToolCard({ tool, onOpen }: { tool: Tool; onOpen: () => void }) {
  return (
    <div
      role="button" tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="group bg-surface border border-border rounded-xl p-5 hover:border-border-strong transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
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

/* ── FakeQR ──────────────────────────────────────────────────── */

function FakeQR({ data, size = 200 }: { data: string; size?: number }) {
  const grid = 25
  const cell = size / grid

  const cells = useMemo(() => {
    let seed = data.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + data.length * 31
    const out: { x: number; y: number }[] = []
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        seed = (seed * 9301 + 49297) % 233280
        const inMarker = (x < 7 && y < 7) || (x >= grid - 7 && y < 7) || (x < 7 && y >= grid - 7)
        if (inMarker) continue
        if (seed / 233280 > 0.52) out.push({ x, y })
      }
    }
    return out
  }, [data])

  function Marker({ x, y }: { x: number; y: number }) {
    return (
      <g>
        <rect x={x * cell} y={y * cell} width={7 * cell} height={7 * cell} fill="currentColor" />
        <rect x={(x + 1) * cell} y={(y + 1) * cell} width={5 * cell} height={5 * cell} fill="var(--surface)" />
        <rect x={(x + 2) * cell} y={(y + 2) * cell} width={3 * cell} height={3 * cell} fill="currentColor" />
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="block text-text" style={{ background: 'var(--surface)' }}>
      {cells.map((c, i) => (
        <rect key={i} x={c.x * cell} y={c.y * cell} width={cell} height={cell} fill="currentColor" />
      ))}
      <Marker x={0} y={0} />
      <Marker x={grid - 7} y={0} />
      <Marker x={0} y={grid - 7} />
    </svg>
  )
}

/* ── Preview Flow step ───────────────────────────────────────── */

function PreviewStep({ step }: { step: FlowStep }) {
  if (step.kind === 'message') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[280px] text-[12px] leading-snug px-3 py-2 rounded-2xl rounded-bl-sm bg-surface text-text border border-border whitespace-pre-wrap">
          {step.text}
        </div>
      </div>
    )
  }
  if (step.kind === 'incoming') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[280px] text-[12px] leading-snug px-3 py-2 rounded-2xl rounded-br-sm bg-primary text-primary-fg">
          {step.text}
        </div>
      </div>
    )
  }
  if (step.kind === 'buttons') {
    return (
      <>
        <PreviewStep step={{ kind: 'message', text: step.text }} />
        <div className="ml-2 flex flex-wrap gap-1.5">
          {step.options.map((o, i) => (
            <span key={i} className="px-2 py-1 bg-surface border border-border rounded text-[11.5px] text-text">{o}</span>
          ))}
        </div>
      </>
    )
  }
  if (step.kind === 'delay') {
    return (
      <div className="text-center py-1">
        <span className="text-[10px] uppercase tracking-wider text-text-subtle font-semibold">
          · aguarda {step.amount} {step.unit} ·
        </span>
      </div>
    )
  }
  if (step.kind === 'offer') {
    return (
      <div className="flex justify-start">
        <div className="ml-2 max-w-[260px] bg-surface border border-border rounded-2xl rounded-bl-sm p-3">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-text-subtle">Oferta</div>
          <div className="text-[12.5px] font-semibold text-text mt-1">{step.product}</div>
          <div className="text-[16px] font-semibold text-success mt-0.5">{fmtBRL(step.price)}</div>
          <button className="w-full mt-2 h-7 bg-primary text-primary-fg text-[11.5px] font-medium rounded-md">{step.cta}</button>
        </div>
      </div>
    )
  }
  return null
}

/* ── Tool 1 — Test Message ───────────────────────────────────── */

function TestMessageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [bot, setBot]       = useState(SENDER_BOTS[0])
  const [chatId, setChatId] = useState('')
  const [text, setText]     = useState('Olá! Esta é uma mensagem de teste do Umbra Bot.')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<{ success: boolean; time: string; messageId: number | null; error: string | null } | null>(null)

  useEffect(() => {
    if (open) { setBot(SENDER_BOTS[0]); setChatId(''); setText('Olá! Esta é uma mensagem de teste do Umbra Bot.'); setResult(null) }
  }, [open])

  function test() {
    if (!chatId.trim()) return
    setLoading(true); setResult(null)
    setTimeout(() => {
      setLoading(false)
      const success = !chatId.trim().endsWith('0')
      setResult({
        success, time: '237 ms',
        messageId: success ? (Math.floor(Math.random() * 99999) + 1000) : null,
        error: success ? null : 'Bot was blocked by the user (chat_id rejeitou a mensagem).',
      })
    }, 900)
  }

  return (
    <Modal open={open} onClose={onClose}
      title="Testar envio de mensagem" subtitle="Envie uma mensagem isolada antes de disparar em massa." size="md"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        <Btn variant="primary" disabled={!chatId.trim() || loading} onClick={test}>
          {loading ? <><Spinner /> Enviando…</> : 'Enviar teste'}
        </Btn>
      </>}
    >
      <div className="space-y-3.5">
        <ToolField label="Bot remetente">
          <SelDrop value={bot} options={SENDER_BOTS} onChange={setBot} />
        </ToolField>
        <ToolField label="Chat ID de destino" hint="Você pode obter o chat_id pelo @userinfobot do Telegram.">
          <input type="text" value={chatId} onChange={(e) => setChatId(e.target.value)}
            placeholder="123456789" className={INPUT_CLS + ' font-mono'} />
        </ToolField>
        <ToolField label="Mensagem">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={TEXTAREA_CLS} />
        </ToolField>

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

/* ── Tool 2 — Validate Token ─────────────────────────────────── */

interface TokenResult {
  ok: boolean
  error?: string
  name?: string
  username?: string
  id?: string
  canJoinGroups?: boolean
  canReadAll?: boolean
  supportsInline?: boolean
}

function ValidateTokenModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [token, setToken]     = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<TokenResult | null>(null)

  useEffect(() => { if (open) { setToken(''); setResult(null); setLoading(false) } }, [open])

  function validate() {
    const valid = /^\d{8,12}:[A-Za-z0-9_-]{30,}$/.test(token.trim())
    if (!valid) { setResult({ ok: false, error: 'Formato inválido. Verifique se copiou o token completo do BotFather.' }); return }
    setLoading(true); setResult(null)
    setTimeout(() => {
      setLoading(false)
      const fakeNames     = ['Meu Bot Oficial', 'Vendas Promo', 'Conteúdo Pro', 'Black 2026']
      const fakeUsernames = ['@meu_bot_oficial', '@vendas_promo_bot', '@conteudo_pro_bot', '@black_2026_bot']
      const idx = Math.abs(token.charCodeAt(token.length - 1)) % fakeNames.length
      setResult({
        ok: true, name: fakeNames[idx], username: fakeUsernames[idx],
        id: token.split(':')[0], canJoinGroups: true, canReadAll: false, supportsInline: idx % 2 === 0,
      })
    }, 1100)
  }

  function Capability({ label, on }: { label: string; on: boolean }) {
    return (
      <div className="flex items-center gap-1.5">
        <Icon name={on ? 'check' : 'x'} size={11} className={on ? 'text-success' : 'text-text-subtle'} />
        <span className={`text-[11.5px] ${on ? 'text-text' : 'text-text-muted line-through'}`}>{label}</span>
      </div>
    )
  }

  return (
    <Modal open={open} onClose={onClose}
      title="Validar token de bot" subtitle="Cheque um token sem precisar conectá-lo ao workspace." size="md"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        <Btn variant="primary" disabled={!token.trim() || loading} onClick={validate}>
          {loading ? <><Spinner /> Validando…</> : 'Validar token'}
        </Btn>
      </>}
    >
      <div className="space-y-3.5">
        <ToolField label="Token do bot">
          <input type="text" value={token} onChange={(e) => setToken(e.target.value)}
            placeholder="7234567890:ABCdefGHIjklMNOpqrSTU..." autoFocus className={INPUT_CLS + ' font-mono'} />
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
                <div className="text-[11.5px] text-text-muted">{result.username} · ID {result.id}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-success/20">
              <Capability label="Entrar em grupos"  on={result.canJoinGroups ?? false} />
              <Capability label="Ler todas as msgs" on={result.canReadAll ?? false} />
              <Capability label="Modo inline"       on={result.supportsInline ?? false} />
              <Capability label="Pagamentos"        on={true} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Tool 3 — QR Code ────────────────────────────────────────── */

function QRCodeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [bot, setBot] = useState(SENDER_BOTS[0])

  return (
    <Modal open={open} onClose={onClose}
      title="Gerar QR code do bot" subtitle="QR aponta direto para a conversa do bot no Telegram." size="md"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        <Btn variant="primary" icon="download">Baixar PNG</Btn>
      </>}
    >
      <div className="space-y-3.5">
        <ToolField label="Bot">
          <SelDrop value={bot} options={SENDER_BOTS} onChange={setBot} />
        </ToolField>

        <div className="bg-surface-2/40 border border-border rounded-xl p-6 flex flex-col items-center">
          <FakeQR data={bot} size={220} />
          <div className="mt-3 text-center">
            <div className="text-[11.5px] text-text-muted">Aponte a câmera para abrir:</div>
            <div className="text-[13px] font-mono font-semibold text-text mt-0.5">https://t.me/{bot.replace('@', '')}</div>
          </div>
        </div>

        <div className="flex items-start gap-2 text-[11.5px] text-text-muted bg-surface-2/40 border border-border rounded-lg p-3">
          <Icon name="info" size={13} className="mt-0.5 shrink-0" />
          <span>Use em materiais impressos (panfletos, banners, embalagens). O Telegram identifica o link automaticamente em câmeras nativas.</span>
        </div>
      </div>
    </Modal>
  )
}

/* ── Tool 4 — Preview Flow ───────────────────────────────────── */

function PreviewFlowModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [flow, setFlow] = useState(FLOWS[0])

  return (
    <Modal open={open} onClose={onClose}
      title="Prévia de fluxo" subtitle="Simulação passo a passo sem executar de verdade." size="lg"
      footer={<Btn variant="primary" onClick={onClose}>Fechar</Btn>}
    >
      <div className="space-y-3.5">
        <ToolField label="Fluxo">
          <SelDrop value={flow} options={FLOWS} onChange={setFlow} />
        </ToolField>

        <div className="bg-surface-2/30 border border-border rounded-xl p-4 space-y-2 max-h-[420px] overflow-y-auto">
          {(SAMPLE_PREVIEW[flow] ?? []).map((step, i) => (
            <PreviewStep key={i} step={step} />
          ))}
          <div className="text-center pt-1">
            <span className="text-[10px] uppercase tracking-wider text-text-subtle font-semibold">· fim da prévia ·</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ── Tool 5 — Import Config ──────────────────────────────────── */

interface ParsedBackup { bots: number; flows: number; sequences: number; gateways: number; links: number; contacts: number; tags: number; size: string }

function ImportConfigModal({ open, onClose, onToast }: { open: boolean; onClose: () => void; onToast: (msg: string) => void }) {
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing]   = useState(false)
  const [parsed, setParsed]     = useState<ParsedBackup | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => { if (open) { setFileName(''); setParsed(null); setParsing(false); setImporting(false) } }, [open])

  function simulatePick() {
    setFileName('umbra-backup-2026-05-18.json')
    setParsing(true)
    setTimeout(() => {
      setParsing(false)
      setParsed({ bots: 5, flows: 6, sequences: 6, gateways: 3, links: 12, contacts: 12845, tags: 9, size: '482 KB' })
    }, 900)
  }

  function doImport() {
    setImporting(true)
    setTimeout(() => { setImporting(false); onToast(`Configurações importadas com sucesso de ${fileName}.`); onClose() }, 1100)
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
        <Btn variant="primary" disabled={!parsed || importing} onClick={doImport}>
          {importing ? <><Spinner /> Importando…</> : 'Importar configurações'}
        </Btn>
      </>}
    >
      <div className="space-y-3.5">
        {!fileName ? (
          <button onClick={simulatePick}
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
                {parsing ? 'Lendo arquivo…' : parsed ? `${parsed.size} · workspace válido` : ''}
              </div>
            </div>
            {parsing && <Spinner />}
            {parsed && (
              <button onClick={() => { setFileName(''); setParsed(null) }}
                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text focus:outline-none">
                <Icon name="x" size={13} />
              </button>
            )}
          </div>
        )}

        {parsed && (
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
              <span>A importação <strong>substitui</strong> configurações com o mesmo ID e <strong>cria as novas</strong>. Recomendamos exportar um backup antes.</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Tool 6 — Export Config ──────────────────────────────────── */

function ExportConfigModal({ open, onClose, onToast }: { open: boolean; onClose: () => void; onToast: (msg: string) => void }) {
  const [parts, setParts] = useState<Record<string, boolean>>({
    bots: true, flows: true, sequences: true, gateways: true,
    links: true, contacts: false, tags: true, webhooks: false,
  })
  const [exporting, setExporting] = useState(false)

  function toggle(key: string) { setParts((p) => ({ ...p, [key]: !p[key] })) }

  function doExport() {
    setExporting(true)
    setTimeout(() => { setExporting(false); onToast('Backup JSON gerado e baixado.'); onClose() }, 1200)
  }

  const totalSelected = Object.values(parts).filter(Boolean).length

  const EXPORT_ROWS = [
    { key: 'bots',      label: 'Bots conectados',           count: 5,     icon: 'bot' },
    { key: 'flows',     label: 'Fluxos de venda',           count: 6,     icon: 'git-branch' },
    { key: 'sequences', label: 'Sequências de remarketing', count: 6,     icon: 'layers' },
    { key: 'gateways',  label: 'Gateways de pagamento',     count: 3,     icon: 'credit-card' },
    { key: 'links',     label: 'Redirecionadores',          count: 12,    icon: 'link' },
    { key: 'tags',      label: 'Tags & segmentos',          count: 9,     icon: 'tag' },
    { key: 'webhooks',  label: 'Webhooks personalizados',   count: 4,     icon: 'webhook', warn: true },
    { key: 'contacts',  label: 'Contatos (LGPD: dados pessoais)', count: 12845, icon: 'database', warn: true },
  ]

  return (
    <Modal open={open} onClose={onClose}
      title="Exportar configurações" subtitle="Selecione o que incluir no backup JSON." size="md"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" icon="download" disabled={totalSelected === 0 || exporting} onClick={doExport}>
          {exporting ? <><Spinner /> Gerando…</> : `Baixar JSON (${totalSelected})`}
        </Btn>
      </>}
    >
      <div className="space-y-1">
        {EXPORT_ROWS.map((p) => (
          <label key={p.key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-2 cursor-pointer">
            <Checkbox checked={parts[p.key] ?? false} onChange={() => toggle(p.key)} />
            <Icon name={p.icon} size={13} className="text-text-muted shrink-0" />
            <span className="flex-1 text-[12.5px] text-text">{p.label}</span>
            {p.warn && <span className="inline-flex items-center px-1.5 h-5 rounded bg-warning-soft text-warning text-[10.5px] font-semibold">LGPD</span>}
            <span className="text-[11.5px] text-text-muted shrink-0">{fmtNum(p.count)}</span>
          </label>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-border flex items-start gap-2 text-[11.5px] text-text-muted">
        <Icon name="info" size={13} className="mt-0.5 shrink-0" />
        <span>Tokens de bots e chaves de gateway são anonimizados no backup. Recriação requer reconexão manual.</span>
      </div>
    </Modal>
  )
}

/* ── Tool 7 — Diagnostics ────────────────────────────────────── */

function DiagnosticsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Record<string, DiagStatus>>({})

  useEffect(() => { if (open) { setRunning(false); setProgress({}) } }, [open])

  function runAll() {
    setRunning(true); setProgress({})
    let cumulative = 0
    DIAG_CHECKS.forEach((c) => {
      setTimeout(() => setProgress((p) => ({ ...p, [c.id]: 'running' })), cumulative)
      cumulative += c.duration
      setTimeout(() => setProgress((p) => ({ ...p, [c.id]: c.pass ? 'pass' : 'fail' })), cumulative)
    })
    setTimeout(() => setRunning(false), cumulative + 100)
  }

  const completed = Object.values(progress).filter((v) => v === 'pass' || v === 'fail').length
  const failed    = Object.values(progress).filter((v) => v === 'fail').length

  return (
    <Modal open={open} onClose={onClose}
      title="Diagnóstico do sistema" subtitle="Verifique a saúde dos componentes do workspace." size="lg"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Fechar</Btn>
        <Btn variant="primary" icon="play" disabled={running} onClick={runAll}>
          {running ? <><Spinner /> Rodando ({completed}/{DIAG_CHECKS.length})…</> : 'Iniciar diagnóstico'}
        </Btn>
      </>}
    >
      <div className="space-y-2">
        {DIAG_CHECKS.map((c) => {
          const st = progress[c.id]
          return (
            <div key={c.id} className="bg-surface-2/40 border border-border rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-surface border border-border text-text-muted flex items-center justify-center shrink-0">
                  <Icon name={c.icon} size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium text-text">{c.label}</div>
                  {st === 'pass'    && <div className="text-[11px] text-success mt-0.5 leading-snug">{c.detail}</div>}
                  {st === 'fail'    && <div className="text-[11px] text-danger mt-0.5 leading-snug">{c.detail}</div>}
                  {!st             && <div className="text-[11px] text-text-muted mt-0.5">Aguardando início…</div>}
                  {st === 'running' && <div className="text-[11px] text-text-muted mt-0.5">Verificando…</div>}
                </div>
                <div className="shrink-0">
                  {st === 'running' && <Spinner />}
                  {st === 'pass'    && <Icon name="check-circle-2" size={16} className="text-success" />}
                  {st === 'fail'    && <Icon name="x-circle"       size={16} className="text-danger" />}
                  {!st             && <span className="w-4 h-4 rounded-full border border-border-strong inline-block" />}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {completed === DIAG_CHECKS.length && (
        <div className={`mt-4 flex items-start gap-2.5 rounded-lg p-3 border ${failed === 0 ? 'bg-success-soft border-success/30' : 'bg-warning-soft border-warning/30'}`}>
          <Icon name={failed === 0 ? 'check-circle-2' : 'alert-triangle'} size={15} className={failed === 0 ? 'text-success' : 'text-warning'} />
          <div className="text-[12px] flex-1">
            <div className={`font-semibold ${failed === 0 ? 'text-success' : 'text-warning'}`}>
              {failed === 0 ? 'Tudo certo · sistema operacional' : `${failed} ${failed === 1 ? 'verificação falhou' : 'verificações falharam'}`}
            </div>
            {failed > 0 && <div className="text-text-muted mt-0.5">Revise os itens marcados em vermelho e abra a tela de Alertas para detalhes.</div>}
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ── Tool 8 — Clear Cache ────────────────────────────────────── */

function ClearCacheModal({ open, onClose, onToast }: { open: boolean; onClose: () => void; onToast: (msg: string) => void }) {
  const [confirming, setConfirming] = useState(false)
  const [clearing, setClearing]     = useState(false)

  useEffect(() => { if (open) { setConfirming(false); setClearing(false) } }, [open])

  function doClear() {
    setClearing(true)
    setTimeout(() => { setClearing(false); onToast('Cache do workspace limpo com sucesso.'); onClose() }, 1100)
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
      )}
    >
      <div className="text-[12.5px] text-text-muted leading-relaxed">
        Isto vai apagar caches de bots, contagens de leads e tabelas auxiliares. Próximas requisições serão um pouco mais lentas até reaquecer.
      </div>
      <div className="mt-3 flex items-start gap-2 bg-warning-soft/40 border border-warning/20 rounded-lg p-3 text-[11.5px] text-text leading-relaxed">
        <Icon name="info" size={13} className="text-warning mt-0.5 shrink-0" />
        <span>Configurações, conversas e relatórios <strong>não</strong> serão afetados. Apenas dados temporários.</span>
      </div>
    </Modal>
  )
}

/* ── Modal router ────────────────────────────────────────────── */

type ModalKey = keyof typeof MODAL_MAP

const MODAL_MAP = {
  test_message:   TestMessageModal,
  validate_token: ValidateTokenModal,
  qr_code:        QRCodeModal,
  preview_flow:   PreviewFlowModal,
  import_config:  ImportConfigModal,
  export_config:  ExportConfigModal,
  diagnostics:    DiagnosticsModal,
  clear_cache:    ClearCacheModal,
}

/* ── Page ────────────────────────────────────────────────────── */

export default function ToolsPage() {
  const [openTool, setOpenTool] = useState<ModalKey | null>(null)
  const [toast, setToast]       = useState('')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const grouped = useMemo(() => {
    const out: Record<string, Tool[]> = {}
    TOOL_LIST.forEach((t) => {
      if (!out[t.category]) out[t.category] = []
      out[t.category].push(t)
    })
    return out
  }, [])

  const CurrentModal = openTool ? MODAL_MAP[openTool] : null

  return (
    <DashboardLayout>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Ferramentas</h1>
          <p className="text-[13px] text-text-muted mt-0.5">Utilitários auxiliares para sua operação — testes, diagnósticos, backup e mais.</p>
        </div>
      </div>

      {toast && (
        <div className="mb-4 flex items-center gap-2.5 bg-success-soft border border-success/30 rounded-lg px-3.5 py-2">
          <Icon name="check-circle-2" size={15} className="text-success" />
          <div className="text-[12.5px] text-success flex-1">{toast}</div>
          <button onClick={() => setToast('')} className="w-6 h-6 inline-flex items-center justify-center rounded-md text-success/70 hover:bg-success/10 hover:text-success focus:outline-none">
            <Icon name="x" size={11} />
          </button>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, items]) => (
          <section key={cat}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">{cat}</h2>
              <span className="text-[10.5px] text-text-subtle">{items.length} ferramentas</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map((t) => (
                <ToolCard key={t.id} tool={t} onOpen={() => setOpenTool(t.id as ModalKey)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {CurrentModal && (
        <CurrentModal
          open={!!openTool}
          onClose={() => setOpenTool(null)}
          onToast={setToast}
        />
      )}
    </DashboardLayout>
  )
}
