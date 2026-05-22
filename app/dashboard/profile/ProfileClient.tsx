'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { DashboardLayout } from '@/components/dashboard/Layout'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { useAnalytics } from '@/hooks/use-analytics'
import type { RawProfile, RawMember } from './page'
import {
  Save, Upload, Lock, Eye, EyeOff, Shield, ShieldCheck,
  AlertTriangle, AlertCircle, Check, CheckCircle2, X, Key,
  ArrowRight, ArrowLeft, Search, UserPlus, UserCheck, Trash2, Send, Download,
  Loader2, Users,
} from 'lucide-react'

/* ================================================================
   Types
   ================================================================ */

interface Account {
  name: string; email: string; phone: string
  initials: string   // avatar_initials
  avatarColor: string; timezone: string; language: string
  workspace: string; createdAt: number
}

interface Member {
  id: string; name: string; email: string; avatar: string; color: string
  role: 'owner' | 'admin' | 'editor' | 'analyst'
  status: 'active' | 'invited'; lastSeen: number | null; joinedAt: number; self: boolean
}

interface TwoFAState { enabled: boolean; enabledAt: number | null }

export interface RawPendingInvite {
  id: string
  owner_id: string
  role: string
  joined_at: number
  owner_name: string
  owner_color: string
  owner_initials: string
  owner_workspace: string
}

interface PendingInvite {
  id: string
  ownerId: string
  role: string
  invitedAt: number
  ownerName: string
  ownerColor: string
  ownerInitials: string
  ownerWorkspace: string
}

interface ProfileClientProps {
  initialProfile: RawProfile | null
  initialMembers: RawMember[]
  initialPendingInvites: RawPendingInvite[]
  userId: string
  userEmail: string
  hasMfa: boolean
  mfaFactorId: string | null
}

/* ================================================================
   Constants
   ================================================================ */

const TIMEZONES = [
  'America/Sao_Paulo (GMT-03)', 'America/Manaus (GMT-04)', 'America/Belem (GMT-03)',
  'America/Rio_Branco (GMT-05)', 'America/New_York (GMT-05)', 'Europe/Lisbon (GMT+00)', 'UTC (GMT+00)',
]
const LANGUAGES = ['Português (Brasil)', 'Português (Portugal)', 'English (US)', 'Español (Latam)']

const ROLE_MAP: Record<string, { label: string; tone: string; desc: string }> = {
  owner:   { label: 'Proprietário',  tone: 'primary', desc: 'Acesso total · só o dono pode remover o workspace.' },
  admin:   { label: 'Administrador', tone: 'success', desc: 'Pode gerenciar bots, fluxos, finanças e equipe.' },
  editor:  { label: 'Editor',        tone: 'warning', desc: 'Pode editar fluxos e disparos. Sem acesso a finanças.' },
  analyst: { label: 'Analista',      tone: 'muted',   desc: 'Acesso somente leitura — análises e relatórios.' },
}

const AVATAR_COLORS = ['#7c3aed','#10b981','#f97316','#0ea5e9','#ec4899','#ef4444','#8b5cf6']

/* ================================================================
   Helpers
   ================================================================ */

function getInitials(name: string, email?: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  // Name is empty — fall back to first 2 chars of email local part
  if (email) {
    const local = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')
    if (local.length >= 2) return local.slice(0, 2).toUpperCase()
    if (local.length === 1) return local.toUpperCase()
  }
  return '?'
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function relTime(dt: number | null, now: number): string {
  if (!dt) return '—'
  const m = Math.floor((now - dt) / 60000)
  if (m < 1) return 'online agora'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.floor(h / 24)} d`
}

function scorePassword(pwd: string): { score: number; label: string } {
  if (!pwd) return { score: 0, label: 'vazia' }
  let s = 0
  if (pwd.length >= 8)  s++
  if (pwd.length >= 12) s++
  if (/[A-Z]/.test(pwd)) s++
  if (/[0-9]/.test(pwd)) s++
  if (/[^A-Za-z0-9]/.test(pwd)) s++
  return { score: s, label: ['fraquíssima','fraca','média','boa','forte','muito forte'][s] }
}

function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const bytes = new Uint8Array(4)
    crypto.getRandomValues(bytes)
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 4).toUpperCase()}-${hex.slice(4, 8).toUpperCase()}`
  })
}

function downloadBackupCodes(codes: string[], email: string): void {
  const lines = [
    'Umbra Bot — Códigos de backup para 2FA',
    `Conta: ${email}`,
    `Gerados em: ${new Date().toLocaleDateString('pt-BR')}`,
    '',
    ...codes.map((c, i) => `${i + 1}. ${c}`),
    '',
    'Cada código funciona uma única vez.',
    'Guarde este arquivo em local seguro.',
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'umbra-backup-codes.txt'; a.click()
  URL.revokeObjectURL(url)
}

function profileToAccount(p: RawProfile | null, email: string): Account {
  return {
    name:       p?.name       ?? '',
    email,
    phone:      p?.phone      ?? '',
    initials:   (p?.avatar_initials && p.avatar_initials.trim()) ? p.avatar_initials : getInitials(p?.name ?? '', email),
    avatarColor: p?.avatar_color ?? '#7c3aed',
    timezone:   p?.timezone   ?? 'America/Sao_Paulo (GMT-03)',
    language:   p?.language   ?? 'Português (Brasil)',
    workspace:  p?.workspace  ?? '',
    createdAt:  p?.created_at ? new Date(p.created_at).getTime() : Date.now(),
  }
}

function mapMember(row: RawMember): Member {
  return {
    id:       row.id,
    name:     row.name,
    email:    row.email,
    avatar:   row.avatar || getInitials(row.name, row.email),
    color:    row.color  || '#7c3aed',
    role:     row.role as Member['role'],
    status:   row.status as Member['status'],
    lastSeen: row.last_seen != null ? Number(row.last_seen) : null,
    joinedAt: Number(row.joined_at),
    self:     false,
  }
}

/* ================================================================
   Shared UI
   ================================================================ */

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
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${TONE[tone] ?? TONE.muted}`}>
      {children}
    </span>
  )
}

function Btn({ variant = 'secondary', size = 'sm', icon, loading = false, disabled = false, onClick, children }: {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: React.ReactNode
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  children?: React.ReactNode
}) {
  const sz = size === 'md' ? 'h-9 px-4 text-[12.5px]' : 'h-8 px-3 text-[12px]'
  const v = variant === 'primary' ? 'bg-primary text-white hover:opacity-90'
    : variant === 'danger'  ? 'bg-danger-soft text-danger border border-danger/20 hover:bg-danger/10'
    : variant === 'ghost'   ? 'text-text-muted hover:bg-surface-2 hover:text-text'
    :                         'bg-surface-2 text-text border border-border hover:bg-surface-3'
  return (
    <button type="button" disabled={disabled || loading} onClick={onClick}
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${sz} ${v}`}>
      {loading ? <Loader2 size={13} className="animate-spin" /> : icon}{children}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className={`relative w-full ${maxW} bg-surface rounded-2xl shadow-2xl border border-border`}>
        <button onClick={onClose}
          className="absolute top-4 right-4 z-10 w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-2">
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

/* ================================================================
   AccountCard
   ================================================================ */

function AccountCard({ data, userId, onSaved }: {
  data: Account; userId: string; onSaved: (updated: Account) => void
}) {
  const [draft, setDraft] = useState(data)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { track } = useAnalytics()

  useEffect(() => { setDraft(data); setAvatarPreview(null) }, [data])

  const dirty = JSON.stringify(draft) !== JSON.stringify(data)

  function set(patch: Partial<Account>) { setDraft(d => ({ ...d, ...patch })); setSaved(false); setSaveError(null) }

  async function save() {
    setSaving(true); setSaveError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({
          name:             draft.name,
          phone:            draft.phone,
          avatar_color:     draft.avatarColor,
          avatar_initials:  draft.initials,
          timezone:         draft.timezone,
          language:         draft.language,
          workspace:        draft.workspace,
        })
        .eq('id', userId)
      if (error) throw error
      onSaved(draft)
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
      track('profile_saved')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar perfil')
    } finally {
      setSaving(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setUploadError('Arquivo muito grande. Máximo: 2 MB.'); return }
    setUploading(true); setUploadError(null)
    try {
      const supabase = createClient()
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = urlData.publicUrl + `?t=${Date.now()}`
      setAvatarPreview(url)
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
      track('avatar_updated')
    } catch (err) {
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
          {dirty && !saved && <Btn variant="ghost" size="sm" onClick={() => { setDraft(data); setSaveError(null) }}>Descartar</Btn>}
          <Btn variant="primary" size="sm" icon={<Save size={13} />} loading={saving} disabled={!dirty} onClick={save}>
            Salvar alterações
          </Btn>
        </div>
      }
    >
      <div className="space-y-4">
        {saveError && (
          <div className="flex items-start gap-2 bg-danger-soft border border-danger/30 rounded-lg px-3 py-2 text-[12px] text-danger">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />{saveError}
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          {/* Avatar */}
          <div className="relative w-16 h-16 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {avatarPreview
              ? <img src={avatarPreview} alt="Avatar" className="w-16 h-16 rounded-full object-cover" />
              : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-[22px]"
                  style={{ background: draft.avatarColor }}>{draft.initials || '?'}</div>
              )}
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <Loader2 size={20} className="text-white animate-spin" />
              </div>
            )}
          </div>

          <div className="flex-1 grid grid-cols-2 gap-2 max-w-md">
            <Field label="Iniciais">
              <input type="text" value={draft.initials} maxLength={3}
                onChange={e => set({ initials: e.target.value.toUpperCase().slice(0, 3) })}
                className={INPUT} />
            </Field>
            <Field label="Cor do avatar">
              <div className="flex items-center gap-2 h-10 bg-surface border border-border rounded-lg px-2">
                <span className="w-6 h-6 rounded border border-border shrink-0" style={{ background: draft.avatarColor }} />
                <input type="color" value={draft.avatarColor}
                  onChange={e => set({ avatarColor: e.target.value })}
                  className="sr-only" id="avatar-color-pick" />
                <input type="text" value={draft.avatarColor}
                  onChange={e => set({ avatarColor: e.target.value })}
                  className="flex-1 bg-transparent text-[12px] font-mono text-text focus:outline-none" />
                <div className="flex gap-1">
                  {AVATAR_COLORS.map(c => (
                    <button key={c} type="button" title={c} onClick={() => set({ avatarColor: c })}
                      className="w-4 h-4 rounded-full border border-white/30 shrink-0"
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </Field>
          </div>

          <div className="flex flex-col gap-1">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <Btn variant="secondary" size="sm" icon={<Upload size={13} />}
              loading={uploading} onClick={() => fileRef.current?.click()}>
              Enviar foto
            </Btn>
            {uploadError && <p className="text-[11px] text-danger max-w-[120px]">{uploadError}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t border-border">
          <Field label="Nome completo">
            <input type="text" value={draft.name} onChange={e => set({ name: e.target.value })} className={INPUT} />
          </Field>
          <Field label="E-mail">
            <input type="email" value={draft.email} readOnly
              className={INPUT + ' cursor-not-allowed opacity-60'} />
          </Field>
          <Field label="Telefone">
            <input type="tel" value={draft.phone} onChange={e => set({ phone: e.target.value })}
              className={INPUT + ' font-mono'} placeholder="+55 11 9 9999-9999" />
          </Field>
          <Field label="Workspace">
            <div className="h-10 px-3 bg-surface-2/50 border border-border rounded-lg text-[13px] text-text-muted flex items-center justify-between">
              <span>{draft.workspace || '—'}</span>
              <Badge tone="primary">{ROLE_MAP.owner.label}</Badge>
            </div>
          </Field>
          <Field label="Fuso horário">
            <select value={draft.timezone} onChange={e => set({ timezone: e.target.value })}
              className={INPUT + ' cursor-pointer'}>
              {TIMEZONES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Idioma">
            <select value={draft.language} onChange={e => set({ language: e.target.value })}
              className={INPUT + ' cursor-pointer'}>
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

/* ================================================================
   TwoFAModal — real Supabase MFA (TOTP)
   ================================================================ */

function TwoFAModal({ open, userId, userEmail, onClose, onActivated }: {
  open: boolean; userId: string; userEmail: string
  onClose: () => void
  onActivated: (factorId: string, enabledAt: number) => void
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const enrolledFactorIdRef = useRef<string | null>(null)
  const backupCodesRef = useRef<string[]>([])
  const { track } = useAnalytics()

  useEffect(() => {
    if (!open) return
    setStep(1); setCode(''); setError(''); setQrCode(''); setSecret('')
    enrolledFactorIdRef.current = null
    backupCodesRef.current = generateBackupCodes()
    startEnroll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function startEnroll() {
    setEnrolling(true); setError('')
    try {
      const supabase = createClient()
      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Umbra Bot',
      })
      if (enrollErr) throw enrollErr
      enrolledFactorIdRef.current = data.id
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar configuração. Tente novamente.')
    } finally {
      setEnrolling(false)
    }
  }

  async function handleClose() {
    // Unenroll if enrollment started but not completed
    const fid = enrolledFactorIdRef.current
    if (fid && step < 3) {
      const supabase = createClient()
      await supabase.auth.mfa.unenroll({ factorId: fid }).catch(() => {})
    }
    onClose()
  }

  async function verify() {
    setError('')
    if (!/^\d{6}$/.test(code)) { setError('O código tem 6 dígitos.'); return }
    const factorId = enrolledFactorIdRef.current
    if (!factorId) { setError('Erro interno. Reabra o modal e tente novamente.'); return }
    setVerifying(true)
    try {
      const supabase = createClient()
      const { data: challengeData, error: cErr } = await supabase.auth.mfa.challenge({ factorId })
      if (cErr) throw cErr
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      })
      if (vErr) { setError('Código inválido. Tente novamente com o código atual do app.'); return }
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao verificar código')
    } finally {
      setVerifying(false)
    }
  }

  async function handleActivate() {
    const factorId = enrolledFactorIdRef.current!
    const enabledAt = Date.now()
    try {
      const supabase = createClient()
      await supabase
        .from('profiles')
        .update({ two_fa_enabled: true, two_fa_enabled_at: enabledAt })
        .eq('id', userId)
    } catch { /* non-blocking — MFA is active in Auth regardless */ }
    track('two_fa_enabled')
    onActivated(factorId, enabledAt)
  }

  const secretFormatted = secret.replace(/(.{4})/g, '$1 ').trim()

  return (
    <Modal open={open} onClose={handleClose}
      title={step === 3 ? null : 'Ativar autenticação de dois fatores'}
      subtitle={
        step === 1 ? 'Passo 1 de 2 · escaneie o QR no app de autenticação.'
        : step === 2 ? 'Passo 2 de 2 · informe o código atual do app.' : null
      }
      footer={
        step === 1 ? (
          <><Btn variant="secondary" onClick={handleClose}>Cancelar</Btn>
            <Btn variant="primary" icon={<ArrowRight size={13} />}
              disabled={enrolling || !qrCode}
              onClick={() => setStep(2)}>Já escaneei</Btn></>
        ) : step === 2 ? (
          <><Btn variant="secondary" icon={<ArrowLeft size={13} />} onClick={() => setStep(1)}>Voltar</Btn>
            <Btn variant="primary" loading={verifying} disabled={code.length !== 6} onClick={verify}>
              Confirmar código
            </Btn></>
        ) : (
          <Btn variant="primary" onClick={handleActivate}>Concluir</Btn>
        )
      }
    >
      {step === 1 && (
        <div className="space-y-3">
          <div className="bg-surface-2/40 border border-border rounded-xl p-5 flex flex-col items-center min-h-[200px] justify-center">
            {enrolling && <Loader2 size={32} className="text-primary animate-spin" />}
            {!enrolling && error && (
              <div className="text-center text-[12px] text-danger">
                {error}
                <button type="button" onClick={startEnroll}
                  className="block mt-2 text-primary underline text-[11.5px]">Tentar novamente</button>
              </div>
            )}
            {!enrolling && !error && qrCode && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="QR Code 2FA" className="w-44 h-44 block" />
                <div className="mt-3 text-center w-full">
                  <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-muted mb-1">
                    Ou insira manualmente:
                  </div>
                  <code className="text-[11.5px] font-mono text-text block bg-surface border border-border rounded px-2 py-1 break-all">
                    {secretFormatted}
                  </code>
                </div>
              </>
            )}
          </div>
          <div className="space-y-2 text-[12px] text-text-muted">
            {[
              <>Abra <strong className="text-text">Google Authenticator</strong>, <strong className="text-text">Authy</strong> ou outro app TOTP.</>,
              'Escaneie o QR code ou insira o código manualmente.',
              'Avance e informe o código de 6 dígitos gerado pelo app.',
            ].map((txt, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-md bg-primary/10 text-primary text-[10.5px] font-semibold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
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
          <div className="text-[11.5px] text-text-muted">
            O código muda a cada 30 s. Use o código <strong>atual</strong> mostrado no app.
          </div>
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
            <h3 className="text-[16px] font-semibold text-text">2FA ativada com sucesso!</h3>
            <p className="text-[12px] text-text-muted mt-1 max-w-xs mx-auto">
              Guarde os códigos abaixo num lugar seguro. Cada código funciona uma única vez.
            </p>
          </div>
          <div className="bg-surface-2/40 border border-border rounded-lg p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-muted">
                Códigos de backup ({backupCodesRef.current.length})
              </div>
              <Btn variant="ghost" size="sm" icon={<Download size={12} />}
                onClick={() => downloadBackupCodes(backupCodesRef.current, userEmail)}>
                Baixar TXT
              </Btn>
            </div>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[11.5px]">
              {backupCodesRef.current.map(c => (
                <code key={c} className="bg-surface border border-border rounded px-2 py-1 text-text">{c}</code>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2 bg-warning-soft/40 border border-warning/20 rounded-lg p-3 text-[11.5px] text-text">
            <AlertTriangle size={13} className="text-warning mt-0.5 shrink-0" />
            <span>
              Guarde esses códigos agora. Por segurança, eles <strong>não serão exibidos novamente</strong>.
            </span>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ================================================================
   SecurityCard
   ================================================================ */

function SecurityCard({ twoFA, userId, userEmail, mfaFactorId, on2FAChange }: {
  twoFA: TwoFAState; userId: string; userEmail: string; mfaFactorId: string | null
  on2FAChange: (v: TwoFAState, newFactorId: string | null) => void
}) {
  const [current, setCurrent]   = useState('')
  const [next, setNext]         = useState('')
  const [confirm, setConfirm]   = useState('')
  const [show, setShow]         = useState(false)
  const [pwSaved, setPwSaved]   = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError]   = useState('')
  const [twoFAOpen, setTwoFAOpen]         = useState(false)
  const [disableConfirm, setDisableConfirm] = useState(false)
  const [disabling, setDisabling]          = useState(false)
  const { track } = useAnalytics()

  const strength = scorePassword(next)
  const match    = next.length > 0 && confirm.length > 0 && next === confirm
  const canSave  = current.length > 0 && next.length >= 8 && match

  async function handlePasswordChange() {
    setPwError('')
    if (!current)          { setPwError('Informe a senha atual.'); return }
    if (next.length < 8)   { setPwError('A nova senha precisa ter ao menos 8 caracteres.'); return }
    if (next !== confirm)  { setPwError('A confirmação não confere com a nova senha.'); return }
    setPwSaving(true)
    try {
      const supabase = createClient()
      // Verify current password first
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: current })
      if (signInErr) { setPwError('Senha atual incorreta.'); return }
      // Change password
      const { error: updateErr } = await supabase.auth.updateUser({ password: next })
      if (updateErr) throw updateErr
      setPwSaved(true); setCurrent(''); setNext(''); setConfirm('')
      setTimeout(() => setPwSaved(false), 2500)
      track('password_changed')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Erro ao atualizar senha')
    } finally {
      setPwSaving(false)
    }
  }

  async function handleDisable2FA() {
    if (!mfaFactorId) return
    setDisabling(true)
    try {
      const supabase = createClient()
      const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId })
      if (unenrollErr) throw unenrollErr
      await supabase.from('profiles')
        .update({ two_fa_enabled: false, two_fa_enabled_at: null })
        .eq('id', userId)
      on2FAChange({ enabled: false, enabledAt: null }, null)
      setDisableConfirm(false)
      track('two_fa_disabled')
    } catch (err) {
      // Surface error inside the confirm UI — re-use pwError for simplicity
      setPwError(err instanceof Error ? err.message : 'Erro ao desativar 2FA')
      setDisableConfirm(false)
    } finally {
      setDisabling(false)
    }
  }

  return (
    <CardSection title="Segurança" subtitle="Senha de acesso e autenticação em dois fatores (2FA).">
      <div className="space-y-5">
        {/* Password section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12.5px] font-semibold text-text">Senha</div>
            <button type="button" onClick={() => setShow(s => !s)}
              className="text-[11.5px] text-text-muted hover:text-text inline-flex items-center gap-1 rounded px-1">
              {show ? <EyeOff size={11} /> : <Eye size={11} />}
              {show ? 'Ocultar' : 'Mostrar'} senhas
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Senha atual">
              <input type={show ? 'text' : 'password'} value={current}
                onChange={e => { setCurrent(e.target.value); setPwError('') }}
                placeholder="••••••••" autoComplete="current-password" className={INPUT} />
            </Field>
            <Field label="Nova senha">
              <input type={show ? 'text' : 'password'} value={next}
                onChange={e => { setNext(e.target.value); setPwError('') }}
                placeholder="Mínimo 8 caracteres" autoComplete="new-password" className={INPUT} />
            </Field>
            <Field label="Confirmar nova senha">
              <input type={show ? 'text' : 'password'} value={confirm}
                onChange={e => { setConfirm(e.target.value); setPwError('') }}
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
          {pwError && (
            <div className="mt-3 flex items-start gap-2 bg-danger-soft border border-danger/30 rounded-lg px-3 py-2 text-[12px] text-danger">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />{pwError}
            </div>
          )}
          <div className="mt-3 flex justify-end items-center gap-2">
            {pwSaved && (
              <span className="text-[11.5px] text-success flex items-center gap-1">
                <Check size={12} /> Senha atualizada
              </span>
            )}
            <Btn variant="primary" size="sm" icon={<Lock size={13} />}
              loading={pwSaving} disabled={!canSave} onClick={handlePasswordChange}>
              Atualizar senha
            </Btn>
          </div>
        </section>

        {/* 2FA section */}
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
                  Ativada em <span className="font-mono">{fmtDate(twoFA.enabledAt)}</span>.
                </div>
              )}
            </div>
            <div className="shrink-0">
              {twoFA.enabled ? (
                disableConfirm ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11.5px] text-text-muted">Confirmar desativação?</span>
                    <Btn variant="ghost" size="sm" onClick={() => setDisableConfirm(false)}>Cancelar</Btn>
                    <Btn variant="danger" size="sm" loading={disabling} onClick={handleDisable2FA}>Desativar</Btn>
                  </div>
                ) : (
                  <Btn variant="secondary" size="sm" icon={<Key size={13} />} onClick={() => setDisableConfirm(true)}>
                    Desativar 2FA
                  </Btn>
                )
              ) : (
                <Btn variant="primary" size="sm" icon={<Shield size={13} />} onClick={() => setTwoFAOpen(true)}>
                  Ativar 2FA
                </Btn>
              )}
            </div>
          </div>
        </section>
      </div>

      <TwoFAModal
        open={twoFAOpen}
        userId={userId}
        userEmail={userEmail}
        onClose={() => setTwoFAOpen(false)}
        onActivated={(factorId, enabledAt) => {
          on2FAChange({ enabled: true, enabledAt }, factorId)
          setTwoFAOpen(false)
        }}
      />
    </CardSection>
  )
}

/* ================================================================
   InviteModal
   ================================================================ */

function InviteModal({ open, userId, onClose, onInvited }: {
  open: boolean; userId: string
  onClose: () => void; onInvited: (m: Member) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole]   = useState<Member['role']>('editor')
  const [sending, setSending] = useState(false)
  const [error, setError]     = useState('')
  const { track } = useAnalytics()

  useEffect(() => {
    if (open) { setEmail(''); setRole('editor'); setError(''); setSending(false) }
  }, [open])

  async function send() {
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setError('E-mail inválido.'); return }
    setSending(true)
    try {
      const supabase = createClient()
      const emailTrimmed = email.trim().toLowerCase()
      const seed      = emailTrimmed.charCodeAt(0) + emailTrimmed.length
      const parts     = emailTrimmed.split('@')[0].split(/[._-]/).map(s => s.charAt(0).toUpperCase() + s.slice(1))
      const name      = parts.join(' ')
      const avatar    = getInitials(name, emailTrimmed)
      const color     = AVATAR_COLORS[seed % AVATAR_COLORS.length]
      const newId     = crypto.randomUUID()
      const joinedAt  = Date.now()

      // Use RPC so the invite also creates an in-app alert for the invitee
      const { data, error: rpcErr } = await supabase.rpc('invite_team_member', {
        p_owner_id:  userId,
        p_id:        newId,
        p_name:      name,
        p_email:     emailTrimmed,
        p_avatar:    avatar,
        p_color:     color,
        p_role:      role,
        p_joined_at: joinedAt,
      })
      if (rpcErr) throw rpcErr
      const result = data as { ok: boolean; error?: string }
      if (!result.ok) throw new Error(result.error ?? 'Erro ao convidar membro')

      onInvited({ id: newId, name, email: emailTrimmed, avatar, color, role, status: 'invited', lastSeen: null, joinedAt, self: false })
      track('member_invited', { role })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao convidar membro')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}
      title="Convidar membro"
      subtitle="O membro receberá acesso após aceitar o convite."
      footer={
        <><Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" icon={<Send size={13} />} loading={sending} disabled={!email.trim()} onClick={send}>
            Enviar convite
          </Btn></>
      }
    >
      <div className="space-y-3.5">
        <Field label="E-mail do convidado">
          <input type="email" value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
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

/* ================================================================
   TeamCard
   ================================================================ */

function TeamCard({ members, userId, now, onMembersChange }: {
  members: Member[]; userId: string; now: number
  onMembersChange: (updated: Member[]) => void
}) {
  const [inviteOpen, setInviteOpen]     = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [filter, setFilter]             = useState('')
  const [toast, setToast]               = useState('')
  const { track } = useAnalytics()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q
      ? members.filter(m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      : members
  }, [members, filter])

  const active  = members.filter(m => m.status === 'active').length
  const invited = members.filter(m => m.status === 'invited').length

  async function handleRoleChange(id: string, role: Member['role']) {
    const supabase = createClient()
    const { error } = await supabase
      .from('team_members')
      .update({ role })
      .eq('id', id)
      .eq('user_id', userId)
    if (error) { setToast('Erro ao alterar papel.'); return }
    onMembersChange(members.map(m => m.id === id ? { ...m, role } : m))
    setToast('Papel atualizado.')
    track('member_role_changed', { role })
  }

  async function handleRemove(id: string) {
    const m = members.find(x => x.id === id)
    const supabase = createClient()
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (error) { setToast('Erro ao remover membro.'); return }
    onMembersChange(members.filter(x => x.id !== id))
    setConfirmRemove(null)
    setToast(m?.status === 'invited' ? 'Convite cancelado.' : 'Membro removido.')
    track('member_removed')
  }

  return (
    <CardSection
      title="Equipe"
      subtitle={`${active} ${active === 1 ? 'membro ativo' : 'membros ativos'}${invited > 0 ? ` · ${invited} convite${invited > 1 ? 's' : ''} pendente${invited > 1 ? 's' : ''}` : ''}`}
      action={<Btn variant="primary" size="sm" icon={<UserPlus size={13} />} onClick={() => setInviteOpen(true)}>Convidar membro</Btn>}
      noPadding
    >
      {toast && (
        <div className="mx-5 mt-3 flex items-center gap-2 bg-success-soft border border-success/20 rounded-lg px-3 py-2 text-[12px] text-success">
          <Check size={12} className="shrink-0" />{toast}
        </div>
      )}

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
                  <div className="text-[10.5px] text-text-muted mt-0.5">
                    Membro desde {fmtDate(m.joinedAt)} · {relTime(m.lastSeen, now)}
                  </div>
                )}
                {m.status === 'invited' && (
                  <div className="text-[10.5px] text-text-muted mt-0.5">
                    Convidado em {fmtDate(m.joinedAt)}
                  </div>
                )}
              </div>
              <div className="hidden md:block min-w-[160px]">
                {m.role === 'owner' ? (
                  <Badge tone={r.tone}>{r.label}</Badge>
                ) : (
                  <select value={m.role}
                    onChange={e => handleRoleChange(m.id, e.target.value as Member['role'])}
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
                      <Btn variant="danger" size="sm" onClick={() => handleRemove(m.id)}>Remover</Btn>
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

      <InviteModal
        open={inviteOpen}
        userId={userId}
        onClose={() => setInviteOpen(false)}
        onInvited={m => {
          onMembersChange([...members, m])
          setInviteOpen(false)
        }}
      />
    </CardSection>
  )
}

/* ================================================================
   PendingInvitesCard
   ================================================================ */

function mapPendingInvite(row: RawPendingInvite): PendingInvite {
  return {
    id:             row.id,
    ownerId:        row.owner_id,
    role:           row.role,
    invitedAt:      Number(row.joined_at),
    ownerName:      row.owner_name,
    ownerColor:     row.owner_color,
    ownerInitials:  row.owner_initials || getInitials(row.owner_name),
    ownerWorkspace: row.owner_workspace,
  }
}

function PendingInvitesCard({ invites, userId, onAccepted, onRejected }: {
  invites: PendingInvite[]
  userId: string
  onAccepted: (inviteId: string) => void
  onRejected: (inviteId: string) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept(inv: PendingInvite) {
    setBusy(inv.id); setError(null)
    try {
      const supabase = createClient()
      const { data, error: rpcErr } = await supabase.rpc('accept_team_invite', {
        p_invite_id: inv.id,
        p_user_id:   userId,
      })
      if (rpcErr) throw rpcErr
      const result = data as { ok: boolean; error?: string }
      if (!result.ok) throw new Error(result.error ?? 'Erro ao aceitar convite')
      onAccepted(inv.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aceitar convite')
    } finally {
      setBusy(null)
    }
  }

  async function handleReject(inv: PendingInvite) {
    setBusy(inv.id + '_reject'); setError(null)
    try {
      const supabase = createClient()
      const { data, error: rpcErr } = await supabase.rpc('reject_team_invite', {
        p_invite_id: inv.id,
        p_user_id:   userId,
      })
      if (rpcErr) throw rpcErr
      const result = data as { ok: boolean; error?: string }
      if (!result.ok) throw new Error(result.error ?? 'Erro ao recusar convite')
      onRejected(inv.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao recusar convite')
    } finally {
      setBusy(null)
    }
  }

  if (invites.length === 0) return null

  return (
    <CardSection
      title="Convites pendentes"
      subtitle={`Você tem ${invites.length} convite${invites.length > 1 ? 's' : ''} de equipe aguardando resposta.`}
    >
      <div className="space-y-3">
        {error && (
          <div className="flex items-start gap-2 bg-danger-soft border border-danger/30 rounded-lg px-3 py-2 text-[12px] text-danger">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />{error}
          </div>
        )}
        {invites.map(inv => {
          const roleInfo = ROLE_MAP[inv.role] ?? { label: inv.role, tone: 'muted' }
          const accepting = busy === inv.id
          const rejecting = busy === inv.id + '_reject'
          return (
            <div key={inv.id}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface-2/40">
              {/* Owner avatar */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[13px] shrink-0"
                style={{ background: inv.ownerColor }}>
                {inv.ownerInitials || <Users size={16} />}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-text">
                  {inv.ownerName || 'Usuário'} convidou você
                </div>
                {inv.ownerWorkspace && (
                  <div className="text-[11.5px] text-text-muted truncate">
                    Workspace: {inv.ownerWorkspace}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge tone={roleInfo.tone}>{roleInfo.label}</Badge>
                  <span className="text-[10.5px] text-text-muted">·</span>
                  <span className="text-[10.5px] text-text-muted">{fmtDate(inv.invitedAt)}</span>
                </div>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Btn variant="ghost" size="sm" loading={rejecting} disabled={accepting || rejecting}
                  onClick={() => handleReject(inv)}>
                  Recusar
                </Btn>
                <Btn variant="primary" size="sm" icon={<UserCheck size={13} />}
                  loading={accepting} disabled={accepting || rejecting}
                  onClick={() => handleAccept(inv)}>
                  Aceitar
                </Btn>
              </div>
            </div>
          )
        })}
      </div>
    </CardSection>
  )
}

/* ================================================================
   ProfileClient — main export
   ================================================================ */

export default function ProfileClient({
  initialProfile, initialMembers, initialPendingInvites, userId, userEmail, hasMfa, mfaFactorId,
}: ProfileClientProps) {
  // Owner member derived from profile data, NOT stored in team_members
  const ownerMember: Member = useMemo(() => ({
    id:       'owner',
    name:     initialProfile?.name || userEmail.split('@')[0],
    email:    userEmail,
    avatar:   (initialProfile?.avatar_initials && initialProfile.avatar_initials.trim())
              ? initialProfile.avatar_initials
              : getInitials(initialProfile?.name ?? '', userEmail),
    color:    initialProfile?.avatar_color ?? '#7c3aed',
    role:     'owner',
    status:   'active',
    lastSeen: Date.now(),
    joinedAt: initialProfile?.created_at ? new Date(initialProfile.created_at).getTime() : Date.now(),
    self:     true,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  const [account, setAccount]       = useState(() => profileToAccount(initialProfile, userEmail))
  const [members, setMembers]       = useState<Member[]>(() => [ownerMember, ...initialMembers.map(mapMember)])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>(() => initialPendingInvites.map(mapPendingInvite))
  const [twoFA, setTwoFA]           = useState<TwoFAState>({
    enabled:   hasMfa,
    enabledAt: initialProfile?.two_fa_enabled_at != null ? Number(initialProfile.two_fa_enabled_at) : null,
  })
  const [activeMfaFactorId, setActiveMfaFactorId] = useState<string | null>(mfaFactorId)
  const [now, setNow]               = useState(Date.now())
  const [toast, setToast]           = useState('')

  // Tick every 30s for relative timestamps
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])

  function handle2FAChange(v: TwoFAState, newFactorId: string | null) {
    setTwoFA(v)
    setActiveMfaFactorId(newFactorId)
    setToast(v.enabled ? 'Autenticação em dois fatores ativada.' : 'Autenticação em dois fatores desativada.')
  }

  return (
    <DashboardLayout>
      <PageHeader title="Perfil" subtitle="Dados da sua conta, segurança e gerenciamento da equipe." />

      {toast && (
        <div className="mb-4 flex items-center gap-2.5 bg-success-soft border border-success/30 rounded-lg px-3.5 py-2">
          <CheckCircle2 size={15} className="text-success shrink-0" />
          <div className="text-[12.5px] text-success flex-1">{toast}</div>
          <button onClick={() => setToast('')}
            className="w-6 h-6 inline-flex items-center justify-center rounded-md text-success/70 hover:bg-success/10">
            <X size={11} />
          </button>
        </div>
      )}

      <div className="space-y-4 max-w-[1100px]">
        {pendingInvites.length > 0 && (
          <PendingInvitesCard
            invites={pendingInvites}
            userId={userId}
            onAccepted={id => {
              setPendingInvites(arr => arr.filter(i => i.id !== id))
              setToast('Convite aceito! Você agora faz parte da equipe.')
            }}
            onRejected={id => {
              setPendingInvites(arr => arr.filter(i => i.id !== id))
              setToast('Convite recusado.')
            }}
          />
        )}

        <AccountCard
          data={account}
          userId={userId}
          onSaved={updated => {
            setAccount(updated)
            setMembers(arr => arr.map(m => m.self
              ? { ...m, name: updated.name, avatar: updated.initials || getInitials(updated.name, updated.email), color: updated.avatarColor }
              : m
            ))
            setToast('Dados da conta atualizados.')
          }}
        />

        <SecurityCard
          twoFA={twoFA}
          userId={userId}
          userEmail={userEmail}
          mfaFactorId={activeMfaFactorId}
          on2FAChange={handle2FAChange}
        />

        <TeamCard
          members={members}
          userId={userId}
          now={now}
          onMembersChange={updated => {
            setMembers(updated)
            setToast(updated.length < members.length ? 'Membro removido.' : 'Equipe atualizada.')
          }}
        />
      </div>
    </DashboardLayout>
  )
}
