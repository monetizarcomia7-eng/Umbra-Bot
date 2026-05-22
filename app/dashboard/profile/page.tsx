'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { useAnalytics } from '@/hooks/use-analytics'
import {
  Save, Upload, Lock, Eye, EyeOff, Shield, ShieldCheck,
  AlertTriangle, AlertCircle, Check, CheckCircle2, X, Key,
  ArrowRight, ArrowLeft, Search, UserPlus, Trash2, Send, Download,
  Loader2,
} from 'lucide-react'

/* ============================================================
   Types
   ============================================================ */

interface Account {
  name: string; email: string; phone: string; avatar: string
  avatarColor: string; timezone: string; language: string
  workspace: string; createdAt: number
}

interface Member {
  id: string; name: string; email: string; avatar: string; color: string
  role: 'owner' | 'admin' | 'editor' | 'analyst'
  status: 'active' | 'invited'; lastSeen: number | null; joinedAt: number; self: boolean
}

interface TwoFAState { enabled: boolean; enabledAt: number | null }

/* ============================================================
   Mock data
   ============================================================ */

const NOW = new Date('2026-05-18T15:30:00').getTime()

const MOCK_ACCOUNT: Account = {
  name: 'Ana Souza', email: 'ana@umbra.bot', phone: '+55 11 9 8765-4321',
  avatar: 'AS', avatarColor: '#7c3aed', timezone: 'America/Sao_Paulo (GMT-03)',
  language: 'Português (Brasil)', workspace: 'Tribo Black',
  createdAt: new Date('2025-08-20').getTime(),
}

const MOCK_MEMBERS: Member[] = [
  { id: 'u1', name: 'Ana Souza',       email: 'ana@umbra.bot',       avatar: 'AS', color: '#7c3aed', role: 'owner',   status: 'active',  lastSeen: NOW - 2*60*1000,        joinedAt: new Date('2025-08-20').getTime(), self: true  },
  { id: 'u2', name: 'Bruno Tavares',   email: 'bruno@tribo.com.br',  avatar: 'BT', color: '#10b981', role: 'admin',   status: 'active',  lastSeen: NOW - 32*60*1000,       joinedAt: new Date('2025-09-12').getTime(), self: false },
  { id: 'u3', name: 'Camila Oliveira', email: 'camila@tribo.com.br', avatar: 'CO', color: '#f97316', role: 'editor',  status: 'active',  lastSeen: NOW - 8*3600*1000,      joinedAt: new Date('2025-11-04').getTime(), self: false },
  { id: 'u4', name: 'Diego Antunes',   email: 'diego@tribo.com.br',  avatar: 'DA', color: '#0ea5e9', role: 'editor',  status: 'active',  lastSeen: NOW - 3*24*3600*1000,   joinedAt: new Date('2026-01-18').getTime(), self: false },
  { id: 'u5', name: 'Letícia Costa',   email: 'leticia@tribo.com.br',avatar: 'LC', color: '#ec4899', role: 'analyst', status: 'invited', lastSeen: null,                   joinedAt: NOW - 2*24*3600*1000,            self: false },
]

const TIMEZONES = [
  'America/Sao_Paulo (GMT-03)', 'America/Manaus (GMT-04)', 'America/Belem (GMT-03)',
  'America/Rio_Branco (GMT-05)', 'America/New_York (GMT-05)', 'Europe/Lisbon (GMT+00)', 'UTC (GMT+00)',
]
const LANGUAGES = ['Português (Brasil)', 'Português (Portugal)', 'English (US)', 'Español (Latam)']

const ROLE_MAP: Record<string, { label: string; tone: string; desc: string }> = {
  owner:   { label: 'Proprietária',  tone: 'primary', desc: 'Acesso total · só ela pode remover o workspace.' },
  admin:   { label: 'Administrador', tone: 'success', desc: 'Pode gerenciar bots, fluxos, finanças e equipe.' },
  editor:  { label: 'Editor',        tone: 'warning', desc: 'Pode editar fluxos e disparos. Sem acesso a finanças.' },
  analyst: { label: 'Analista',      tone: 'muted',   desc: 'Acesso somente leitura — análises e relatórios.' },
}

/* ============================================================
   Helpers
   ============================================================ */

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function relTime(dt: number | null): string {
  if (!dt) return '—'
  const m = Math.floor((NOW - dt) / 60000)
  if (m < 1) return 'online agora'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.floor(h / 24)} d`
}

function scorePassword(pwd: string): { score: number; label: string } {
  if (!pwd) return { score: 0, label: 'vazia' }
  let s = 0
  if (pwd.length >= 8) s++
  if (pwd.length >= 12) s++
  if (/[A-Z]/.test(pwd)) s++
  if (/[0-9]/.test(pwd)) s++
  if (/[^A-Za-z0-9]/.test(pwd)) s++
  return { score: s, label: ['fraquíssima','fraca','média','boa','forte','muito forte'][s] }
}

/* ============================================================
   Shared UI components
   ============================================================ */

const INPUT = 'w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium text-text mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function CardSection({ title, subtitle, action, children, noPadding = false }: {
  title: string; subtitle?: string; action?: React.ReactNode
  children: React.ReactNode; noPadding?: boolean
}) {
  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-border">
        <div>
          <div className="text-[13.5px] font-semibold text-text">{title}</div>
          {subtitle && <div className="text-[11.5px] text-text-muted mt-0.5">{subtitle}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={noPadding ? '' : 'px-5 py-5'}>{children}</div>
    </div>
  )
}

const TONE: Record<string, string> = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger:  'bg-danger-soft text-danger border-danger/20',
  muted:   'bg-surface-2 text-text-muted border-border',
}
function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${TONE[tone] ?? TONE.muted}`}>{children}</span>
}

function Btn({ variant = 'secondary', size = 'sm', icon, disabled = false, onClick, children }: {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'
  icon?: React.ReactNode; disabled?: boolean; onClick?: () => void; children?: React.ReactNode
}) {
  const sz = size === 'md' ? 'h-9 px-4 text-[12.5px]' : 'h-8 px-3 text-[12px]'
  const v = variant === 'primary' ? 'bg-primary text-white hover:opacity-90'
    : variant === 'danger'  ? 'bg-danger-soft text-danger border border-danger/20 hover:bg-danger/10'
    : variant === 'ghost'   ? 'text-text-muted hover:bg-surface-2 hover:text-text'
    :                         'bg-surface-2 text-text border border-border hover:bg-surface-3'
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${sz} ${v}`}>
      {icon}{children}
    </button>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-surface-2 border border-border'}`}>
      <span className="pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }} />
    </button>
  )
}

function Modal({ open, onClose, title, subtitle, footer, children, size = 'md' }: {
  open: boolean; onClose: () => void; title?: string | null; subtitle?: string | null
  footer?: React.ReactNode; children: React.ReactNode; size?: 'sm' | 'md' | 'lg'
}) {
  if (!open) return null
  const maxW = size === 'lg' ? 'max-w-2xl' : size === 'sm' ? 'max-w-sm' : 'max-w-lg'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className={`relative w-full ${maxW} bg-surface rounded-2xl shadow-2xl border border-border`}>
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-2">
          <X size={14} />
        </button>
        {(title || subtitle) && (
          <div className="px-6 pt-5 pb-4 border-b border-border">
            {title && <div className="text-[15px] font-semibold text-text">{title}</div>}
            {subtitle && <div className="text-[12px] text-text-muted mt-0.5">{subtitle}</div>}
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="px-6 pb-5 border-t border-border pt-4 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

/* ============================================================
   FakeQR (deterministic, no Math.random)
   ============================================================ */

function FakeQR({ size = 180 }: { size?: number }) {
  const GRID = 23
  const cell = size / GRID
  const dots = useMemo(() => {
    const data = 'otpauth://totp/Umbra Bot:ana@umbra.bot?secret=JBSWY3DPEHPK3PXP'
    let s = data.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + data.length * 31
    const out: { x: number; y: number }[] = []
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        s = (s * 9301 + 49297) % 233280
        const inMarker = (x < 7 && y < 7) || (x >= GRID - 7 && y < 7) || (x < 7 && y >= GRID - 7)
        if (!inMarker && s / 233280 > 0.52) out.push({ x, y })
      }
    }
    return out
  }, [])
  const markers: [number, number][] = [[0, 0], [GRID - 7, 0], [0, GRID - 7]]
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="block text-text" style={{ background: 'var(--surface)' }}>
      {dots.map((d, i) => <rect key={i} x={d.x * cell} y={d.y * cell} width={cell} height={cell} fill="currentColor" />)}
      {markers.map(([mx, my], i) => (
        <g key={i}>
          <rect x={mx * cell} y={my * cell} width={7 * cell} height={7 * cell} fill="currentColor" />
          <rect x={(mx + 1) * cell} y={(my + 1) * cell} width={5 * cell} height={5 * cell} fill="var(--surface)" />
          <rect x={(mx + 2) * cell} y={(my + 2) * cell} width={3 * cell} height={3 * cell} fill="currentColor" />
        </g>
      ))}
    </svg>
  )
}

/* ============================================================
   AccountCard
   ============================================================ */

function AccountCard({ data, onSave }: { data: Account; onSave: (d: Account) => void }) {
  const [draft, setDraft] = useState(data)
  const [saved, setSaved] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { track } = useAnalytics()

  useEffect(() => setDraft(data), [data])
  const dirty = JSON.stringify(draft) !== JSON.stringify(data)
  function set(patch: Partial<Account>) { setDraft(d => ({ ...d, ...patch })); setSaved(false) }
  function save() { onSave(draft); setSaved(true); setTimeout(() => setSaved(false), 2200) }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setUploadError('Arquivo muito grande. Máximo: 2 MB.'); return }
    setUploading(true)
    setUploadError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('não autenticado')
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = urlData.publicUrl + `?t=${Date.now()}`
      setAvatarUrl(url)
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
      track('avatar_updated')
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Erro ao enviar foto')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <CardSection
      title="Conta"
      subtitle="Dados pessoais usados em toda a plataforma e nas notificações."
      action={
        <div className="flex items-center gap-2">
          {saved && <span className="text-[11.5px] text-success flex items-center gap-1"><Check size={12} /> Salvo</span>}
          {dirty && !saved && <Btn variant="ghost" size="sm" onClick={() => setDraft(data)}>Descartar</Btn>}
          <Btn variant="primary" size="sm" icon={<Save size={13} />} disabled={!dirty} onClick={save}>Salvar alterações</Btn>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Avatar — shows uploaded photo or colored initials */}
          <div className="relative w-16 h-16 shrink-0">
            {/* eslint-disable @next/next/no-img-element */}
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-[22px]"
                style={{ background: draft.avatarColor }}>{draft.avatar}</div>
            )}
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <Loader2 size={20} className="text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="flex-1 grid grid-cols-2 gap-2 max-w-md">
            <Field label="Iniciais">
              <input type="text" value={draft.avatar} maxLength={3}
                onChange={e => set({ avatar: e.target.value.toUpperCase().slice(0, 3) })}
                className={INPUT} />
            </Field>
            <Field label="Cor do avatar">
              <div className="flex items-center gap-2 h-10 bg-surface border border-border rounded-lg px-2">
                <span className="w-6 h-6 rounded border border-border shrink-0" style={{ background: draft.avatarColor }} />
                <input type="text" value={draft.avatarColor}
                  onChange={e => set({ avatarColor: e.target.value })}
                  className="flex-1 bg-transparent text-[12px] font-mono text-text focus:outline-none" />
              </div>
            </Field>
          </div>
          <div className="flex flex-col gap-1">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <Btn variant="secondary" size="sm" icon={<Upload size={13} />} onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Enviando…' : 'Enviar foto'}
            </Btn>
            {uploadError && <p className="text-[11px] text-danger">{uploadError}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t border-border">
          <Field label="Nome completo">
            <input type="text" value={draft.name} onChange={e => set({ name: e.target.value })} className={INPUT} />
          </Field>
          <Field label="E-mail">
            <input type="email" value={draft.email} onChange={e => set({ email: e.target.value })} className={INPUT} />
          </Field>
          <Field label="Telefone">
            <input type="tel" value={draft.phone} onChange={e => set({ phone: e.target.value })} className={INPUT + ' font-mono'} />
          </Field>
          <Field label="Workspace">
            <div className="h-10 px-3 bg-surface-2/50 border border-border rounded-lg text-[13px] text-text-muted flex items-center justify-between">
              <span>{draft.workspace}</span>
              <Badge tone="primary">{ROLE_MAP.owner.label}</Badge>
            </div>
          </Field>
          <Field label="Fuso horário">
            <select value={draft.timezone} onChange={e => set({ timezone: e.target.value })} className={INPUT + ' cursor-pointer'}>
              {TIMEZONES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Idioma">
            <select value={draft.language} onChange={e => set({ language: e.target.value })} className={INPUT + ' cursor-pointer'}>
              {LANGUAGES.map(l => <option key={l}>{l}</option>)}
            </select>
          </Field>
        </div>

        <div className="pt-1 text-[11px] text-text-muted">
          Conta criada em <span className="font-mono">{fmtDate(draft.createdAt)}</span>.
        </div>
      </div>
    </CardSection>
  )
}

/* ============================================================
   TwoFAModal
   ============================================================ */

function TwoFAModal({ open, onClose, onActivate }: { open: boolean; onClose: () => void; onActivate: () => void }) {
  const [step, setStep] = useState(1)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setStep(1); setCode(''); setError(''); setVerifying(false) } }, [open])

  function verify() {
    setError('')
    if (!/^\d{6}$/.test(code)) { setError('O código tem 6 dígitos.'); return }
    setVerifying(true)
    setTimeout(() => {
      setVerifying(false)
      if (code === '000000') setError('Código inválido. Tente novamente com o código atual do app.')
      else setStep(3)
    }, 800)
  }

  // eslint-disable-next-line react-hooks/purity
  const backupCodes = useMemo(() =>
    Array.from({ length: 8 }, () => {
      const a = Math.random().toString(36).slice(2, 6).toUpperCase()
      const b = Math.random().toString(36).slice(2, 6).toUpperCase()
      return `${a}-${b}`
    })
  , [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal open={open} onClose={onClose}
      title={step === 3 ? null : 'Ativar 2FA'}
      subtitle={step === 1 ? 'Passo 1 de 2 · escaneie o QR no app de autenticação.'
              : step === 2 ? 'Passo 2 de 2 · informe o código atual.' : null}
      footer={step === 1 ? (
        <><Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" icon={<ArrowRight size={13} />} onClick={() => setStep(2)}>Já escaneei</Btn></>
      ) : step === 2 ? (
        <><Btn variant="secondary" icon={<ArrowLeft size={13} />} onClick={() => setStep(1)}>Voltar</Btn>
          <Btn variant="primary" disabled={verifying || code.length !== 6} onClick={verify}>
            {verifying ? 'Verificando…' : 'Confirmar código'}
          </Btn></>
      ) : (
        <Btn variant="primary" onClick={onActivate}>Concluir</Btn>
      )}
    >
      {step === 1 && (
        <div className="space-y-3">
          <div className="bg-surface-2/40 border border-border rounded-xl p-5 flex flex-col items-center">
            <FakeQR size={180} />
            <div className="mt-3 text-center">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-muted">Ou copie manualmente:</div>
              <code className="text-[11.5px] font-mono text-text mt-1 block bg-surface border border-border rounded px-2 py-1">
                JBSW Y3DP EHPK 3PXP
              </code>
            </div>
          </div>
          <div className="space-y-2 text-[12px] text-text-muted">
            {[
              <>Abra <strong className="text-text">Google Authenticator</strong>, <strong className="text-text">Authy</strong> ou outro app de TOTP.</>,
              'Escaneie o QR code ou cole o código acima manualmente.',
              'Avance e informe o código de 6 dígitos que o app gerar.',
            ].map((txt, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[10.5px] font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                <span>{txt}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <Field label="Código de 6 dígitos">
            <input type="text" inputMode="numeric" maxLength={6} value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000" autoFocus
              className={INPUT + ' text-center text-[20px] font-mono tracking-[0.3em]'} />
          </Field>
          <div className="text-[11.5px] text-text-muted">O código muda a cada 30 s. Use o código <strong>atual</strong> mostrado no app.</div>
          {error && (
            <div className="flex items-start gap-2 bg-danger-soft border border-danger/30 rounded-lg px-3 py-2 text-[12px] text-danger">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />{error}
            </div>
          )}
        </div>
      )}
      {step === 3 && (
        <div className="space-y-3">
          <div className="text-center py-2">
            <div className="w-14 h-14 mx-auto rounded-full bg-success-soft text-success flex items-center justify-center mb-3">
              <ShieldCheck size={26} />
            </div>
            <h3 className="text-[16px] font-semibold text-text">2FA ativada</h3>
            <p className="text-[12px] text-text-muted mt-1 max-w-xs mx-auto">
              Guarde os códigos abaixo num lugar seguro. Cada código funciona uma única vez.
            </p>
          </div>
          <div className="bg-surface-2/40 border border-border rounded-lg p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-muted">Códigos de backup (8)</div>
              <Btn variant="ghost" size="sm" icon={<Download size={12} />}>Baixar TXT</Btn>
            </div>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[11.5px]">
              {backupCodes.map(c => <code key={c} className="bg-surface border border-border rounded px-2 py-1 text-text">{c}</code>)}
            </div>
          </div>
          <div className="flex items-start gap-2 bg-warning-soft/40 border border-warning/20 rounded-lg p-3 text-[11.5px] text-text">
            <AlertTriangle size={13} className="text-warning mt-0.5 shrink-0" />
            <span>Guarde esses códigos agora. Por segurança, eles <strong>não serão exibidos novamente</strong>.</span>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ============================================================
   SecurityCard
   ============================================================ */

function SecurityCard({ twoFA, on2FAChange }: { twoFA: TwoFAState; on2FAChange: (v: TwoFAState) => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [twoFAOpen, setTwoFAOpen] = useState(false)

  const strength = scorePassword(next)
  const match = next.length > 0 && confirm.length > 0 && next === confirm
  const canSave = current.length > 0 && next.length >= 8 && match

  function save() {
    setError('')
    if (next.length < 8) { setError('A nova senha precisa ter ao menos 8 caracteres.'); return }
    if (!match) { setError('A confirmação não confere com a nova senha.'); return }
    if (!current) { setError('Informe a senha atual.'); return }
    setSaved(true); setCurrent(''); setNext(''); setConfirm('')
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <CardSection title="Segurança" subtitle="Senha de acesso e autenticação em dois fatores (2FA).">
      <div className="space-y-5">
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[12.5px] font-semibold text-text">Senha</div>
              <div className="text-[11px] text-text-muted">Última alteração: 28/02/2026</div>
            </div>
            <button type="button" onClick={() => setShow(s => !s)}
              className="text-[11.5px] text-text-muted hover:text-text inline-flex items-center gap-1 rounded px-1">
              {show ? <EyeOff size={11} /> : <Eye size={11} />}
              {show ? 'Ocultar' : 'Mostrar'} senhas
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Senha atual">
              <input type={show ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" className={INPUT} />
            </Field>
            <Field label="Nova senha">
              <input type={show ? 'text' : 'password'} value={next} onChange={e => setNext(e.target.value)}
                placeholder="Mínimo 8 caracteres" autoComplete="new-password" className={INPUT} />
            </Field>
            <Field label="Confirmar nova senha">
              <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Repita a senha" autoComplete="new-password"
                className={INPUT + (confirm && !match ? ' !border-danger focus:!ring-danger/20' : '')} />
            </Field>
          </div>
          {next && (
            <div className="mt-2.5">
              <div className="flex gap-1 mb-1">
                {[1,2,3,4,5].map(i => (
                  <span key={i} className="flex-1 h-1.5 rounded-full transition-colors" style={{
                    background: i <= strength.score
                      ? strength.score <= 2 ? 'var(--danger)' : strength.score <= 3 ? 'var(--warning)' : 'var(--success)'
                      : 'var(--surface-2)',
                  }} />
                ))}
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-text-muted">Força:</span>
                <span className={`font-semibold ${strength.score <= 2 ? 'text-danger' : strength.score <= 3 ? 'text-warning' : 'text-success'}`}>
                  {strength.label}
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="mt-3 flex items-start gap-2 bg-danger-soft border border-danger/30 rounded-lg px-3 py-2 text-[12px] text-danger">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />{error}
            </div>
          )}
          <div className="mt-3 flex justify-end items-center gap-2">
            {saved && <span className="text-[11.5px] text-success flex items-center gap-1"><Check size={12} /> Senha atualizada</span>}
            <Btn variant="primary" size="sm" icon={<Lock size={13} />} disabled={!canSave} onClick={save}>Atualizar senha</Btn>
          </div>
        </section>

        <section className="pt-5 border-t border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-[12.5px] font-semibold text-text">Autenticação em dois fatores</div>
                {twoFA.enabled
                  ? <Badge tone="success"><span className="w-1.5 h-1.5 rounded-full bg-success" /> Ativada</Badge>
                  : <Badge tone="warning">Inativa</Badge>}
              </div>
              <p className="text-[11.5px] text-text-muted max-w-md leading-relaxed">
                Adicione uma camada extra de segurança exigindo um código de 6 dígitos no login.
                Recomendamos <strong>Google Authenticator</strong> ou <strong>Authy</strong>.
              </p>
              {twoFA.enabled && twoFA.enabledAt && (
                <div className="mt-1 text-[11px] text-text-muted">
                  Ativada em <span className="font-mono">{fmtDate(twoFA.enabledAt)}</span> · Códigos de backup gerados.
                </div>
              )}
            </div>
            <div className="shrink-0">
              {twoFA.enabled
                ? <Btn variant="secondary" size="sm" icon={<Key size={13} />} onClick={() => on2FAChange({ enabled: false, enabledAt: null })}>Desativar</Btn>
                : <Btn variant="primary" size="sm" icon={<Shield size={13} />} onClick={() => setTwoFAOpen(true)}>Ativar 2FA</Btn>}
            </div>
          </div>
        </section>
      </div>

      <TwoFAModal open={twoFAOpen} onClose={() => setTwoFAOpen(false)}
        onActivate={() => { on2FAChange({ enabled: true, enabledAt: Date.now() }); setTwoFAOpen(false) }} />
    </CardSection>
  )
}

/* ============================================================
   InviteModal
   ============================================================ */

function InviteModal({ open, onClose, onInvite }: {
  open: boolean; onClose: () => void
  onInvite: (m: { email: string; role: Member['role'] }) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Member['role']>('editor')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setEmail(''); setRole('editor'); setError(''); setSending(false) } }, [open])

  function send() {
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setError('E-mail inválido.'); return }
    setSending(true)
    setTimeout(() => { setSending(false); onInvite({ email: email.trim(), role }); onClose() }, 900)
  }

  return (
    <Modal open={open} onClose={onClose}
      title="Convidar membro"
      subtitle="Envie um convite por e-mail. O acesso é concedido após o aceite."
      footer={
        <><Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" icon={<Send size={13} />} disabled={sending || !email.trim()} onClick={send}>
            {sending ? 'Enviando convite…' : 'Enviar convite'}
          </Btn></>
      }
    >
      <div className="space-y-3.5">
        <Field label="E-mail do convidado">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="nome@email.com" autoFocus className={INPUT} />
        </Field>
        <Field label="Papel">
          <div className="space-y-1.5">
            {(Object.entries(ROLE_MAP) as [Member['role'], typeof ROLE_MAP[string]][])
              .filter(([k]) => k !== 'owner')
              .map(([key, r]) => {
                const active = role === key
                return (
                  <button key={key} type="button" onClick={() => setRole(key)}
                    className={`w-full text-left p-2.5 rounded-lg border-2 transition-colors focus:outline-none ${
                      active ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:bg-surface-2'
                    }`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? 'border-primary' : 'border-border'}`}>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </span>
                      <Badge tone={r.tone}>{r.label}</Badge>
                    </div>
                    <div className="text-[11.5px] text-text-muted ml-5 leading-snug">{r.desc}</div>
                  </button>
                )
              })}
          </div>
        </Field>
        {error && (
          <div className="flex items-start gap-2 bg-danger-soft border border-danger/30 rounded-lg px-3 py-2 text-[12px] text-danger">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />{error}
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ============================================================
   TeamCard
   ============================================================ */

function TeamCard({ members, onUpdateRole, onRemove, onInvite }: {
  members: Member[]
  onUpdateRole: (id: string, role: Member['role']) => void
  onRemove: (id: string) => void
  onInvite: (m: { email: string; role: Member['role'] }) => void
}) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? members.filter(m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)) : members
  }, [members, filter])

  const active = members.filter(m => m.status === 'active').length
  const invited = members.filter(m => m.status === 'invited').length

  return (
    <CardSection
      title="Equipe"
      subtitle={`${active} ${active === 1 ? 'membro ativo' : 'membros ativos'}${invited > 0 ? ` · ${invited} convite${invited > 1 ? 's' : ''} pendente${invited > 1 ? 's' : ''}` : ''}`}
      action={<Btn variant="primary" size="sm" icon={<UserPlus size={13} />} onClick={() => setInviteOpen(true)}>Convidar membro</Btn>}
      noPadding
    >
      <div className="px-5 py-3 border-t border-border">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[12.5px] placeholder:text-text-muted text-text focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>

      <div className="border-t border-border divide-y divide-border">
        {filtered.length === 0 && (
          <div className="py-10 text-center text-[12.5px] text-text-muted">Nenhum membro encontrado.</div>
        )}
        {filtered.map(m => {
          const r = ROLE_MAP[m.role]
          return (
            <div key={m.id} className="px-5 py-3 flex items-center gap-3 hover:bg-surface-2/40 transition-colors">
              <div className="w-9 h-9 rounded-md flex items-center justify-center text-white font-semibold text-[13px] shrink-0"
                style={{ background: m.color }}>{m.avatar}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-[13px] font-medium text-text truncate">{m.name}</div>
                  {m.self && <Badge tone="muted">você</Badge>}
                  {m.status === 'invited' && <Badge tone="warning">Convite pendente</Badge>}
                </div>
                <div className="text-[11.5px] text-text-muted truncate">{m.email}</div>
                {m.status === 'active' && (
                  <div className="text-[10.5px] text-text-muted mt-0.5">Membro desde {fmtDate(m.joinedAt)} · {relTime(m.lastSeen)}</div>
                )}
                {m.status === 'invited' && (
                  <div className="text-[10.5px] text-text-muted mt-0.5">Convidado em {fmtDate(m.joinedAt)}</div>
                )}
              </div>
              <div className="hidden md:block min-w-[160px]">
                {m.role === 'owner' ? (
                  <Badge tone={r.tone}>{r.label}</Badge>
                ) : (
                  <select value={m.role} onChange={e => onUpdateRole(m.id, e.target.value as Member['role'])}
                    className="h-8 px-2 bg-surface border border-border rounded-lg text-[12px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                    {(Object.entries(ROLE_MAP) as [Member['role'], typeof ROLE_MAP[string]][])
                      .filter(([k]) => k !== 'owner')
                      .map(([key, rv]) => <option key={key} value={key}>{rv.label}</option>)}
                  </select>
                )}
              </div>
              <div className="shrink-0">
                {!m.self && m.role !== 'owner' && (
                  confirmRemove === m.id ? (
                    <div className="flex items-center gap-1">
                      <Btn variant="ghost" size="sm" onClick={() => setConfirmRemove(null)}>Cancelar</Btn>
                      <Btn variant="danger" size="sm" onClick={() => { onRemove(m.id); setConfirmRemove(null) }}>Remover</Btn>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmRemove(m.id)}
                      className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-danger-soft hover:text-danger"
                      title={m.status === 'invited' ? 'Cancelar convite' : 'Remover membro'}>
                      {m.status === 'invited' ? <X size={13} /> : <Trash2 size={13} />}
                    </button>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvite={onInvite} />
    </CardSection>
  )
}

/* ============================================================
   ProfilePage
   ============================================================ */

export default function ProfilePage() {
  const [account, setAccount] = useState(MOCK_ACCOUNT)
  const [members, setMembers] = useState(MOCK_MEMBERS)
  const [twoFA, setTwoFA] = useState<TwoFAState>({ enabled: false, enabledAt: null })
  const [toast, setToast] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient()
        const [{ data: profile }, { data: teamRows }] = await Promise.all([
          sb.from('profiles').select('*').limit(1).maybeSingle(),
          sb.from('team_members').select('*'),
        ])
        if (profile) setAccount(prev => ({ ...prev, ...(profile as Partial<Account>) }))
        if (teamRows?.length) setMembers(teamRows as Member[])
      } catch { /* silent fallback to mock */ }
    }
    load()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  function updateRole(id: string, role: Member['role']) {
    setMembers(arr => arr.map(m => m.id === id ? { ...m, role } : m))
    setToast('Papel atualizado.')
  }
  function removeMember(id: string) {
    const m = members.find(x => x.id === id)
    setMembers(arr => arr.filter(x => x.id !== id))
    setToast(m?.status === 'invited' ? 'Convite cancelado.' : 'Membro removido.')
  }
  function invite({ email, role }: { email: string; role: Member['role'] }) {
    const colors = ['#7c3aed','#10b981','#f97316','#0ea5e9','#ec4899']
    const seed = email.charCodeAt(0) + email.length
    const parts = email.split('@')[0].split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1))
    const name = parts.join(' ')
    const avatar = parts.map(s => s.charAt(0)).slice(0, 2).join('').toUpperCase()
    setMembers(arr => [...arr, {
      id: 'u_' + Date.now(), name, email, avatar,
      color: colors[seed % colors.length],
      role, status: 'invited', lastSeen: null, joinedAt: Date.now(), self: false,
    }])
    setToast(`Convite enviado para ${email}.`)
  }

  return (
    <DashboardLayout>
      <PageHeader title="Perfil" subtitle="Dados da sua conta, segurança e gerenciamento da equipe." />

      {toast && (
        <div className="mb-4 flex items-center gap-2.5 bg-success-soft border border-success/30 rounded-lg px-3.5 py-2">
          <CheckCircle2 size={15} className="text-success shrink-0" />
          <div className="text-[12.5px] text-success flex-1">{toast}</div>
          <button onClick={() => setToast('')} className="w-6 h-6 inline-flex items-center justify-center rounded-md text-success/70 hover:bg-success/10">
            <X size={11} />
          </button>
        </div>
      )}

      <div className="space-y-4 max-w-[1100px]">
        <AccountCard data={account} onSave={a => { setAccount(a); setToast('Dados da conta atualizados.') }} />
        <SecurityCard twoFA={twoFA} on2FAChange={v => {
          setTwoFA(v)
          setToast(v.enabled ? 'Autenticação em dois fatores ativada.' : 'Autenticação em dois fatores desativada.')
        }} />
        <TeamCard members={members} onUpdateRole={updateRole} onRemove={removeMember} onInvite={invite} />
      </div>
    </DashboardLayout>
  )
}
