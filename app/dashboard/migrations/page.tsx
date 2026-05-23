'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import {
  Database, Copy, Check, Play, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Loader2, Info, ExternalLink,
  Terminal, RefreshCw,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Migration { name: string; sql: string; description: string }
type RunStatus = 'idle' | 'running' | 'ok' | 'error'
interface RunResult { migration: string; status: RunStatus; message: string }

// ─── Local components ────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-surface border border-border rounded-xl ${className}`}>{children}</div>
}

function Btn({ children, variant = 'secondary', size = 'md', onClick, disabled, className = '' }: {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none'
  const sz = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[12.5px]'
  const v = {
    primary:   'bg-primary text-primary-fg hover:bg-primary/90',
    secondary: 'bg-surface border border-border text-text hover:bg-surface-2',
    ghost:     'text-text-muted hover:text-text hover:bg-surface-2',
  }[variant]
  return (
    <button className={`${base} ${sz} ${v} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    success: 'bg-[color:var(--success)]/10 text-[color:var(--success)] border-[color:var(--success)]/20',
    warning: 'bg-[color:var(--warning)]/10 text-[color:var(--warning)] border-[color:var(--warning)]/20',
    danger:  'bg-[color:var(--danger)]/10 text-[color:var(--danger)] border-[color:var(--danger)]/20',
    muted:   'bg-surface-2 text-text-muted border-border',
    info:    'bg-primary/10 text-primary border-primary/20',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${tones[tone] ?? tones.muted}`}>
      {children}
    </span>
  )
}

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'md' }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <Btn size={size} variant="secondary" onClick={copy}>
      {copied ? <Check size={13} className="text-[color:var(--success)]" /> : <Copy size={13} />}
      {copied ? 'Copiado!' : 'Copiar SQL'}
    </Btn>
  )
}

// ─── SetupBanner ─────────────────────────────────────────────────────────────
function SetupBanner() {
  const [open, setOpen] = useState(false)
  return (
    <Card className="border-[color:var(--warning)]/40 bg-[color:var(--warning)]/5">
      <div className="px-5 py-4 flex items-start gap-3">
        <Info size={16} className="text-[color:var(--warning)] mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-text">Execução automática não configurada</div>
          <div className="text-[12px] text-text-muted mt-1">
            Para executar aqui sem abrir o Supabase, adicione duas variáveis ao{' '}
            <code className="bg-surface-2 px-1 rounded text-[11px] font-mono">.env.local</code>.{' '}
            Enquanto isso, use <strong>Copiar SQL</strong> e cole no{' '}
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Supabase → SQL Editor
            </a>.
          </div>
          <button
            className="mt-2 text-[12px] text-primary hover:underline flex items-center gap-1"
            onClick={() => setOpen(v => !v)}
          >
            <Terminal size={11} />
            {open ? 'Ocultar instruções' : 'Como configurar'}
          </button>
          {open && (
            <div className="mt-3 space-y-3">
              <div className="bg-surface rounded-lg border border-border px-4 py-3 font-mono text-[11.5px] text-text-muted space-y-1">
                <div><span className="text-primary select-all">SUPABASE_ACCESS_TOKEN</span>=sbp_xxxxxxxxxxxxxxxxxxxxxxxx</div>
                <div><span className="text-primary select-all">SUPABASE_PROJECT_REF</span>=abcdefghijklmnop</div>
              </div>
              <ol className="space-y-1.5 text-[12px] text-text-muted list-none">
                <li className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-surface-2 border border-border text-[10px] flex items-center justify-center shrink-0 font-semibold">1</span>
                  <span><strong className="text-text">SUPABASE_ACCESS_TOKEN</strong> — supabase.com → seu avatar → Access Tokens → Generate new token</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-surface-2 border border-border text-[10px] flex items-center justify-center shrink-0 font-semibold">2</span>
                  <span><strong className="text-text">SUPABASE_PROJECT_REF</strong> — Dashboard do projeto → Settings → General → Reference ID</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-surface-2 border border-border text-[10px] flex items-center justify-center shrink-0 font-semibold">3</span>
                  <span>Reinicie o servidor de dev (<code className="bg-surface-2 px-1 rounded">npm run dev</code>) para as vars serem carregadas</span>
                </li>
              </ol>
            </div>
          )}
        </div>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-lg bg-surface border border-border text-text hover:bg-surface-2 transition-colors"
        >
          <ExternalLink size={12} />
          Abrir Supabase
        </a>
      </div>
    </Card>
  )
}

// ─── MigrationCard ───────────────────────────────────────────────────────────
function MigrationCard({ migration, configured, onRun, result }: {
  migration: Migration
  configured: boolean
  onRun: (m: Migration) => void
  result?: RunResult
}) {
  const [expanded, setExpanded] = useState(false)

  const isRunning = result?.status === 'running'
  const isOk      = result?.status === 'ok'
  const isError   = result?.status === 'error'

  return (
    <Card>
      {/* Header row */}
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Database size={16} className="text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold font-mono text-text truncate">{migration.name}</span>
            {isOk
              ? <Badge tone="success"><CheckCircle2 size={10} /> Aplicada</Badge>
              : <Badge tone="warning">Pendente</Badge>
            }
          </div>
          <div className="text-[12px] text-text-muted mt-0.5 capitalize">{migration.description}</div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Btn size="sm" variant="ghost" onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            SQL
          </Btn>
          <CopyButton text={migration.sql} />
          {configured && (
            <Btn
              size="sm"
              variant={isOk ? 'ghost' : 'primary'}
              onClick={() => onRun(migration)}
              disabled={isRunning}
            >
              {isRunning
                ? <Loader2 size={13} className="animate-spin" />
                : <Play size={13} />}
              {isRunning ? 'Executando…' : isOk ? 'Re-executar' : 'Executar'}
            </Btn>
          )}
        </div>
      </div>

      {/* SQL block */}
      {expanded && (
        <div className="border-t border-border">
          <pre className="p-4 text-[11.5px] font-mono text-text-muted bg-surface-2/40 rounded-b-xl overflow-x-auto max-h-[420px] overflow-y-auto leading-[1.7]">
            {migration.sql}
          </pre>
        </div>
      )}

      {/* Result bar */}
      {result && result.status !== 'idle' && (
        <div className={`border-t border-border px-5 py-3 flex items-start gap-2.5 ${expanded ? '' : 'rounded-b-xl'} ${
          isOk    ? 'bg-[color:var(--success)]/5' :
          isError ? 'bg-[color:var(--danger)]/5'  : 'bg-surface-2/40'
        }`}>
          {isOk      && <CheckCircle2 size={14} className="text-[color:var(--success)] mt-0.5 shrink-0" />}
          {isError   && <AlertCircle  size={14} className="text-[color:var(--danger)]  mt-0.5 shrink-0" />}
          {isRunning && <Loader2      size={14} className="animate-spin text-primary    mt-0.5 shrink-0" />}
          <div className="min-w-0">
            <div className={`text-[12.5px] font-medium ${
              isOk ? 'text-[color:var(--success)]' : isError ? 'text-[color:var(--danger)]' : 'text-text'
            }`}>
              {isOk      ? 'Migration executada com sucesso' :
               isError   ? 'Erro ao executar migration'      :
               isRunning ? 'Executando…'                     : ''}
            </div>
            {result.message && (
              <pre className="mt-1 text-[11px] text-text-muted font-mono whitespace-pre-wrap break-all">
                {result.message}
              </pre>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MigrationsPage() {
  const [migrations,  setMigrations]  = useState<Migration[]>([])
  const [configured,  setConfigured]  = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [fetchError,  setFetchError]  = useState('')
  const [results,     setResults]     = useState<Record<string, RunResult>>({})

  const load = useCallback(() => {
    setLoading(true)
    setFetchError('')
    fetch('/api/migrations')
      .then(r => r.json())
      .then((d: { migrations?: Migration[]; configured?: boolean; error?: string }) => {
        setMigrations(d.migrations ?? [])
        setConfigured(d.configured ?? false)
        if (d.error) setFetchError(d.error)
      })
      .catch(e => setFetchError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function runMigration(m: Migration) {
    setResults(prev => ({ ...prev, [m.name]: { migration: m.name, status: 'running', message: '' } }))
    try {
      const res  = await fetch('/api/migrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: m.sql }),
      })
      const data = await res.json() as { error?: string; result?: unknown }
      if (!res.ok) {
        setResults(prev => ({ ...prev, [m.name]: { migration: m.name, status: 'error', message: data.error ?? 'Erro desconhecido' } }))
      } else {
        const msg = data.result ? JSON.stringify(data.result, null, 2) : ''
        setResults(prev => ({ ...prev, [m.name]: { migration: m.name, status: 'ok', message: msg } }))
      }
    } catch (e) {
      setResults(prev => ({ ...prev, [m.name]: { migration: m.name, status: 'error', message: String(e) } }))
    }
  }

  const applied = Object.values(results).filter(r => r.status === 'ok').length

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Migrations SQL"
          subtitle="Execute as migrations do banco de dados sem abrir o Supabase."
          actions={
            <Btn size="sm" variant="secondary" onClick={load} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </Btn>
          }
        />

        {/* Config banner */}
        {!loading && !configured && <SetupBanner />}

        {/* Stats strip */}
        {!loading && migrations.length > 0 && (
          <div className="flex items-center gap-6 text-[12.5px] text-text-muted px-1">
            <span><strong className="text-text">{migrations.length}</strong> arquivo{migrations.length !== 1 ? 's' : ''}</span>
            <span><strong className="text-[color:var(--success)]">{applied}</strong> aplicada{applied !== 1 ? 's' : ''}</span>
            <span><strong className="text-[color:var(--warning)]">{migrations.length - applied}</strong> pendente{migrations.length - applied !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-text-muted" />
          </div>
        ) : fetchError ? (
          <Card className="border-[color:var(--danger)]/30">
            <div className="px-5 py-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-[color:var(--danger)] mt-0.5 shrink-0" />
              <div>
                <div className="text-[13px] font-semibold text-text">Erro ao carregar migrations</div>
                <pre className="text-[11.5px] text-text-muted mt-1 font-mono">{fetchError}</pre>
              </div>
            </div>
          </Card>
        ) : migrations.length === 0 ? (
          <Card>
            <div className="py-20 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted mb-4">
                <Database size={20} />
              </div>
              <div className="text-[14px] font-semibold text-text">Nenhuma migration encontrada</div>
              <div className="text-[12.5px] text-text-muted mt-1 max-w-xs">
                Adicione arquivos <code className="bg-surface-2 px-1 rounded">.sql</code> na pasta{' '}
                <code className="bg-surface-2 px-1 rounded">supabase/migrations/</code>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {migrations.map(m => (
              <MigrationCard
                key={m.name}
                migration={m}
                configured={configured}
                onRun={runMigration}
                result={results[m.name]}
              />
            ))}
          </div>
        )}
    </div>
  )
}
