'use client'
import { useState } from 'react'
import { Trash2, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { disconnectAccountAction } from '@/app/actions/instagram'
import type { RawIgAccount } from '../page'

interface Props {
  account: RawIgAccount
  onToast: (msg: string, type?: 'success' | 'error') => void
}

export default function AccountCard({ account, onToast }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [removing,   setRemoving]   = useState(false)

  const expiresAtMs = account.token_expires_at ? new Date(account.token_expires_at).getTime() : null
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const daysLeft = expiresAtMs != null ? Math.ceil((expiresAtMs - nowMs) / 86_400_000) : null

  let expiryBadge: React.ReactNode = null
  if (daysLeft != null) {
    if (daysLeft <= 0) {
      expiryBadge = <Badge tone="danger"><AlertCircle size={10} />Expirado</Badge>
    } else if (daysLeft <= 7) {
      expiryBadge = <Badge tone="danger"><Clock size={10} />Expira em {daysLeft}d</Badge>
    } else if (daysLeft <= 30) {
      expiryBadge = <Badge tone="warning"><Clock size={10} />Expira em {daysLeft}d</Badge>
    } else {
      expiryBadge = <Badge tone="muted"><Clock size={10} />{daysLeft}d</Badge>
    }
  }

  async function handleDisconnect() {
    setRemoving(true)
    try {
      await disconnectAccountAction(account.id)
      onToast('Conta desconectada.', 'success')
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Erro ao desconectar.', 'error')
      setRemoving(false)
    }
  }

  return (
    <div className="rounded-xl p-4"
      style={{
        background: 'var(--surface)',
        border:     `1px solid ${account.is_active ? 'var(--border)' : 'var(--danger)'}`,
        opacity:    account.is_active ? 1 : 0.7,
      }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {account.profile_picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={account.profile_picture}
              alt={account.username ?? 'avatar'}
              className="w-10 h-10 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
              style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}>
              {(account.username ?? '?')[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
              @{account.username ?? '—'}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {account.is_active ? (
                <Badge tone="success"><CheckCircle2 size={10} />Conectada</Badge>
              ) : (
                <Badge tone="danger"><AlertCircle size={10} />Desconectada</Badge>
              )}
              {expiryBadge}
            </div>
          </div>
        </div>
      </div>

      {!account.is_active && (
        <div className="rounded-lg p-2 mb-3 text-xs"
          style={{
            background: 'color-mix(in oklab, var(--danger) 8%, transparent)',
            color:      'var(--danger)',
          }}>
          Reconecte esta conta no botão &ldquo;Conectar Instagram&rdquo;.
        </div>
      )}

      {confirming ? (
        <div className="flex gap-2">
          <button
            onClick={handleDisconnect}
            disabled={removing}
            className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--danger)', color: '#fff' }}
          >
            {removing ? 'Removendo…' : 'Confirmar'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={removing}
            className="flex-1 px-2.5 py-1.5 rounded-lg text-xs"
            style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors hover:bg-surface-2"
          style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <Trash2 size={11} />
          Desconectar
        </button>
      )}
    </div>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'success' | 'danger' | 'warning' | 'muted' }) {
  const colors: Record<typeof tone, { bg: string; fg: string }> = {
    success: { bg: 'color-mix(in oklab, var(--success) 12%, transparent)', fg: 'var(--success)' },
    danger:  { bg: 'color-mix(in oklab, var(--danger) 12%, transparent)',  fg: 'var(--danger)' },
    warning: { bg: 'color-mix(in oklab, var(--warning) 12%, transparent)', fg: 'var(--warning)' },
    muted:   { bg: 'var(--surface-2)',                                       fg: 'var(--text-muted)' },
  }
  const c = colors[tone]
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: c.bg, color: c.fg }}>
      {children}
    </span>
  )
}
