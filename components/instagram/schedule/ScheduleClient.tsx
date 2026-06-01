'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Send, AlertTriangle } from 'lucide-react'
import { schedulePostAction } from '@/app/actions/instagram'
import MediaUpload, { type UploadedMedia } from './MediaUpload'
import PostPreview from './PostPreview'
import Toast from '../shared/Toast'
import type { RawIgAccount } from '@/app/dashboard/instagram/page'

interface Props {
  accounts:      RawIgAccount[]
  hasMetaConfig: boolean
}

const MAX_CAPTION = 2200

export default function ScheduleClient({ accounts, hasMetaConfig }: Props) {
  const router = useRouter()
  const [accountId,   setAccountId]   = useState(accounts[0]?.id ?? '')
  const [caption,     setCaption]     = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [medias,      setMedias]      = useState<UploadedMedia[]>([])
  const [submitting,  setSubmitting]  = useState(false)
  const [toast,       setToast]       = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4_000)
  }, [])

  const mediaType: 'IMAGE' | 'REELS' | 'CAROUSEL' | null =
    medias.length === 0 ? null :
    medias.length > 1 ? 'CAROUSEL' :
    medias[0].isVideo ? 'REELS' :
    'IMAGE'

  const selectedAccount = accounts.find(a => a.id === accountId) ?? null

  // eslint-disable-next-line react-hooks/purity
  const minDateTime = new Date(Date.now() + 3 * 60_000).toISOString().slice(0, 16)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accountId)      { showToast('Selecione uma conta.', 'error'); return }
    if (!medias.length)  { showToast('Adicione pelo menos uma mídia.', 'error'); return }
    if (!scheduledAt)    { showToast('Defina data e horário.', 'error'); return }
    if (!mediaType)      { showToast('Tipo de mídia inválido.', 'error'); return }

    setSubmitting(true)
    try {
      await schedulePostAction({
        accountId,
        mediaType,
        mediaUrls:   medias.map(m => m.url),
        caption,
        scheduledAt: new Date(scheduledAt).toISOString(),
      })
      showToast('Post agendado com sucesso!', 'success')
      // Redireciona pra aba Posts pra ver
      setTimeout(() => router.push('/dashboard/instagram/posts'), 800)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao agendar.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Sem contas — bloqueia
  if (accounts.length === 0) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="rounded-xl p-8 text-center"
          style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
          <AlertTriangle size={32} className="mx-auto mb-3" style={{ color: 'var(--warning)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Nenhuma conta Instagram conectada
          </p>
          <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>
            Conecte uma conta primeiro para começar a agendar posts.
          </p>
          <Link
            href="/dashboard/instagram/accounts"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}
          >
            Ir para Contas →
          </Link>
        </div>
      </div>
    )
  }

  if (!hasMetaConfig) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="rounded-xl p-4 text-sm" style={{
          background: 'color-mix(in oklab, var(--warning) 10%, transparent)',
          border:     '1px solid var(--warning)',
        }}>
          <AlertTriangle size={16} style={{ color: 'var(--warning)' }} className="inline -mt-1 mr-1" />
          <span style={{ color: 'var(--text)' }}>
            Integração Meta não configurada. Avise o administrador.
          </span>
        </div>
      </div>
    )
  }

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Conta */}
            <Section title="Conta">
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>@{a.username ?? '—'}</option>
                ))}
              </select>
            </Section>

            {/* Mídia */}
            <Section
              title="Mídia"
              hint="Imagem, vídeo ou até 10 arquivos para carrossel"
            >
              <MediaUpload
                medias={medias}
                onChange={setMedias}
                onError={msg => showToast(msg, 'error')}
              />
              {mediaType && (
                <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                  Tipo detectado: <strong>{mediaType}</strong>
                </p>
              )}
            </Section>

            {/* Legenda */}
            <Section title="Legenda">
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                maxLength={MAX_CAPTION}
                rows={4}
                placeholder="Escreva a legenda do post…"
                className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
              <p className="text-[10px] text-right mt-1" style={{ color: 'var(--text-muted)' }}>
                {caption.length}/{MAX_CAPTION}
              </p>
            </Section>

            {/* Data e hora */}
            <Section
              title="Agendar para"
              hint="Mínimo de 3 minutos no futuro. O cron processa a cada 1 min."
            >
              <input
                type="datetime-local"
                value={scheduledAt}
                min={minDateTime}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </Section>

            <button
              type="submit"
              disabled={submitting || medias.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-opacity"
              style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {submitting ? 'Agendando…' : 'Agendar post'}
            </button>
          </form>

          {/* Preview */}
          <aside>
            <PostPreview
              account={selectedAccount}
              medias={medias}
              caption={caption}
              scheduledAt={scheduledAt || null}
            />
          </aside>
        </div>
      </div>
    </>
  )
}

function Section({
  title, hint, children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
        {title}
      </label>
      {children}
      {hint && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>
      )}
    </div>
  )
}
