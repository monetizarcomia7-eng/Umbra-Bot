'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, CheckCircle2, Clock, Info, ExternalLink, Loader2,
  Trash2, RefreshCw, Settings as SettingsIcon, Camera,
} from 'lucide-react'
import Badge from '../shared/Badge'
import Toast from '../shared/Toast'
import { disconnectAccountAction } from '@/app/actions/instagram'
import type { RawIgAccount } from '@/app/dashboard/instagram/page'

interface Props {
  accounts:             RawIgAccount[]
  hasMetaConfig:        boolean
  cronSecretConfigured: boolean
}

export default function AccountSettings({ accounts, hasMetaConfig, cronSecretConfigured }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting,      setDeleting]      = useState(false)
  const [toast,         setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4_000)
  }

  async function handleDisconnect(id: string) {
    setDeleting(true)
    try {
      await disconnectAccountAction(id)
      showToast('Conta desconectada.', 'success')
      setConfirmDelete(null)
      // Hard reload — recarrega o SSR pra refletir a remoção
      setTimeout(() => { window.location.reload() }, 600)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao desconectar.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        {/* Status da integração */}
        <Section title="Status da integração" Icon={SettingsIcon}>
          <ConfigRow
            ok={hasMetaConfig}
            okLabel="Integração Meta configurada"
            failLabel="Variáveis META_APP_ID e META_APP_SECRET não configuradas"
            hint="Defina no Vercel: Settings → Environment Variables"
          />
          <ConfigRow
            ok={cronSecretConfigured}
            okLabel="CRON_SECRET configurado"
            failLabel="CRON_SECRET ausente"
            hint="Necessário para o worker /api/cron/publish-instagram"
          />
          <ConfigRow
            ok={true}
            okLabel="Worker rodando 1x/min via cron-job.org"
            hint="Crons: publish-instagram (1min) · refresh-instagram-tokens (12h) · cleanup-instagram-logs (1d)"
          />
        </Section>

        {/* Limites do Instagram */}
        <Section title="Limites e regras do Instagram" Icon={Info}>
          <ul className="space-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--primary)' }}>•</span>
              <span><strong style={{ color: 'var(--text)' }}>Caption:</strong> até 2.200 caracteres</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--primary)' }}>•</span>
              <span><strong style={{ color: 'var(--text)' }}>Imagem:</strong> JPG/PNG/WEBP até 8 MB</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--primary)' }}>•</span>
              <span><strong style={{ color: 'var(--text)' }}>Vídeo (Reels):</strong> MP4/MOV até 500 MB, mín. 720p, proporção 9:16</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--primary)' }}>•</span>
              <span><strong style={{ color: 'var(--text)' }}>Carrossel:</strong> de 2 a 10 mídias</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--primary)' }}>•</span>
              <span><strong style={{ color: 'var(--text)' }}>Posts/dia:</strong> Instagram limita 50 por conta</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--primary)' }}>•</span>
              <span><strong style={{ color: 'var(--text)' }}>Agendamento:</strong> mínimo 3 minutos no futuro</span>
            </li>
          </ul>
        </Section>

        {/* Contas conectadas */}
        <Section
          title="Contas conectadas"
          Icon={Camera}
          action={
            <Link
              href="/dashboard/instagram/accounts"
              className="text-xs font-medium"
              style={{ color: 'var(--primary)' }}
            >
              Conectar nova conta →
            </Link>
          }
        >
          {accounts.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Nenhuma conta conectada. Vá em <Link href="/dashboard/instagram/accounts"
                className="font-medium underline" style={{ color: 'var(--primary)' }}>Contas</Link>
              {' '}para conectar uma agora.
            </p>
          ) : (
            <div className="space-y-2">
              {accounts.map(a => {
                const expiresAtMs = a.token_expires_at ? new Date(a.token_expires_at).getTime() : null
                // eslint-disable-next-line react-hooks/purity
                const nowMs = Date.now()
                const daysLeft = expiresAtMs ? Math.ceil((expiresAtMs - nowMs) / 86_400_000) : null
                return (
                  <div key={a.id}
                    className="rounded-lg p-3 flex items-center gap-3"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    {a.profile_picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}>
                        {(a.username ?? '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                        @{a.username ?? '—'}
                      </p>
                      <p className="text-[10px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                        ID: {a.ig_user_id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!a.is_active ? (
                        <Badge tone="danger">Desativada</Badge>
                      ) : daysLeft === null ? (
                        <Badge tone="muted">Token permanente</Badge>
                      ) : daysLeft <= 0 ? (
                        <Badge tone="danger">
                          <AlertTriangle size={9} />
                          Token expirado
                        </Badge>
                      ) : daysLeft <= 7 ? (
                        <Badge tone="danger">
                          <Clock size={9} />
                          {daysLeft}d
                        </Badge>
                      ) : daysLeft <= 30 ? (
                        <Badge tone="warning">
                          <Clock size={9} />
                          {daysLeft}d
                        </Badge>
                      ) : (
                        <Badge tone="success">
                          <CheckCircle2 size={9} />
                          {daysLeft}d
                        </Badge>
                      )}

                      {/* Reconectar — abre OAuth de novo (gera novo token longo) */}
                      <Link
                        href="/api/auth/instagram/connect"
                        className="p-1.5 rounded-md"
                        style={{ background: 'var(--surface)', color: 'var(--primary)' }}
                        title="Reconectar / renovar token"
                      >
                        <RefreshCw size={12} />
                      </Link>

                      {confirmDelete === a.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDisconnect(a.id)}
                            disabled={deleting}
                            className="px-2 py-1 rounded text-[10px] font-semibold"
                            style={{ background: 'var(--danger)', color: '#fff' }}
                          >
                            {deleting ? <Loader2 size={10} className="animate-spin" /> : 'Confirmar'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            disabled={deleting}
                            className="px-2 py-1 rounded text-[10px] font-semibold"
                            style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(a.id)}
                          className="p-1.5 rounded-md"
                          style={{ background: 'var(--surface)', color: 'var(--danger)' }}
                          title="Desconectar"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        {/* Webhooks */}
        <Section title="Webhooks da Meta" Icon={Info}>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            Configure o webhook no <strong style={{ color: 'var(--text)' }}>Meta for Developers</strong>{' '}
            apontando para a URL abaixo para receber eventos de comentários, mensagens e menções:
          </p>
          <div className="rounded-lg p-2.5 font-mono text-[11px] break-all"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/instagram
          </div>
          <a
            href="https://developers.facebook.com/apps"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs mt-2"
            style={{ color: 'var(--primary)' }}
          >
            Abrir Meta for Developers
            <ExternalLink size={11} />
          </a>
        </Section>

        {/* Documentação */}
        <Section title="Documentação útil" Icon={Info}>
          <div className="space-y-2 text-xs">
            <Doc href="https://developers.facebook.com/docs/instagram-api/guides/content-publishing"
              label="Content Publishing API (Meta)" />
            <Doc href="https://developers.facebook.com/docs/graph-api/webhooks"
              label="Webhooks (Meta)" />
            <Doc href="https://help.instagram.com/377435406492028"
              label="Diretrizes da comunidade do Instagram" />
          </div>
        </Section>
      </div>
    </>
  )
}

function Section({
  title, Icon, action, children,
}: {
  title: string
  Icon: React.ElementType
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
          <Icon size={14} style={{ color: 'var(--primary)' }} />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function ConfigRow({
  ok, okLabel, failLabel, hint,
}: {
  ok: boolean
  okLabel: string
  failLabel?: string
  hint?: string
}) {
  return (
    <div className="flex items-start gap-2 py-1.5 text-xs">
      {ok
        ? <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
        : <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />}
      <div>
        <p style={{ color: 'var(--text)' }}>{ok ? okLabel : (failLabel ?? okLabel)}</p>
        {hint && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
      </div>
    </div>
  )
}

function Doc({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 hover:underline"
      style={{ color: 'var(--primary)' }}
    >
      <ExternalLink size={11} />
      {label}
    </a>
  )
}
