'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, CheckCircle2, Camera } from 'lucide-react'
import AccountCard from './AccountCard'
import AccountStats from './AccountStats'
import ConnectButton from './ConnectButton'
import Toast from '../shared/Toast'
import type { RawIgAccount, IgStats } from '@/app/dashboard/instagram/page'

interface Props {
  initialAccounts: RawIgAccount[]
  initialStats:    IgStats
  userId:          string
  hasMetaConfig:   boolean
}

const ERROR_LABELS: Record<string, string> = {
  cancelled:      'Conexão cancelada.',
  invalid_state:  'Sessão expirada. Tente conectar novamente.',
  no_code:        'Resposta inválida do Meta.',
  no_pages:       'Nenhuma página do Facebook encontrada. Vincule uma página primeiro.',
  no_ig_business: 'Nenhuma conta Instagram Business vinculada à página.',
  oauth_failed:   'Falha na autenticação. Tente novamente.',
  config_missing: 'Integração Meta não configurada. Avise o administrador.',
}

export default function AccountsClient({
  initialAccounts, initialStats, userId, hasMetaConfig,
}: Props) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4_000)
  }, [])

  // Feedback do OAuth callback
  useEffect(() => {
    const success = searchParams?.get('success')
    const error   = searchParams?.get('error')
    const count   = searchParams?.get('count')

    if (success === 'connected' && count) {
      showToast(`${count} conta(s) conectada(s) com sucesso!`, 'success')
      router.replace('/dashboard/instagram/accounts', { scroll: false })
    }
    if (error) {
      showToast(ERROR_LABELS[error] ?? `Erro: ${error}`, 'error')
      router.replace('/dashboard/instagram/accounts', { scroll: false })
    }
  }, [searchParams, showToast, router])

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('instagram-accounts-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'instagram_accounts', filter: `user_id=eq.${userId}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string }
            setAccounts(arr => arr.filter(a => a.id !== old.id))
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as RawIgAccount
            setAccounts(arr => arr.map(a => a.id === row.id ? row : a))
          } else if (payload.eventType === 'INSERT') {
            const row = payload.new as RawIgAccount
            setAccounts(arr => arr.some(a => a.id === row.id) ? arr : [row, ...arr])
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId])

  const activeAccounts = accounts.filter(a => a.is_active)

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        {!hasMetaConfig && (
          <div className="rounded-xl p-4 text-sm" style={{
            background: 'color-mix(in oklab, var(--warning) 10%, transparent)',
            border:     '1px solid var(--warning)',
            color:      'var(--text)',
          }}>
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} style={{ color: 'var(--warning)' }} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold mb-1" style={{ color: 'var(--warning)' }}>
                  Integração Meta não configurada
                </p>
                <p>
                  As variáveis <code>META_APP_ID</code>, <code>META_APP_SECRET</code> e <code>META_REDIRECT_URI </code>
                  precisam estar definidas no servidor para conectar o Instagram.
                </p>
              </div>
            </div>
          </div>
        )}

        <AccountStats stats={initialStats} />

        <section>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <Camera size={16} style={{ color: 'var(--primary)' }} />
              Contas conectadas ({activeAccounts.length})
            </h2>
            <ConnectButton disabled={!hasMetaConfig} />
          </div>

          {accounts.length === 0 ? (
            <div className="rounded-xl p-8 text-center"
              style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
              <Camera size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Nenhuma conta conectada
              </p>
              <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>
                Conecte uma conta Instagram Business para começar a agendar posts.
              </p>
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Suporta múltiplas contas
                </span>
              </div>
              <div className="mt-4">
                <ConnectButton disabled={!hasMetaConfig} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {accounts.map(acc => (
                <AccountCard key={acc.id} account={acc} onToast={showToast} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
