'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import ConnectButton from './_components/ConnectButton'
import AccountCard from './_components/AccountCard'
import PostForm from './_components/PostForm'
import PostList from './_components/PostList'
import KpiRow from './_components/KpiRow'
import type { RawIgAccount, RawIgPost, IgStats } from './page'

interface Props {
  initialAccounts: RawIgAccount[]
  initialPosts:    RawIgPost[]
  initialStats:    IgStats
  userId:          string
  hasMetaConfig:   boolean
  oauthFeedback: {
    success: string | null
    error:   string | null
    count:   number | null
  }
}

interface Toast { msg: string; type: 'success' | 'error' }

const ERROR_LABELS: Record<string, string> = {
  cancelled:        'Conexão cancelada.',
  invalid_state:    'Sessão expirada. Tente conectar novamente.',
  no_code:          'Resposta inválida do Meta.',
  no_pages:         'Nenhuma página do Facebook encontrada na sua conta. Vincule uma página primeiro.',
  no_ig_business:   'Nenhuma conta Instagram Business vinculada às suas páginas do Facebook.',
  oauth_failed:     'Falha na autenticação. Tente novamente.',
  config_missing:   'Integração Meta não configurada. Avise o administrador.',
}

export default function InstagramClient({
  initialAccounts, initialPosts, initialStats, userId, hasMetaConfig, oauthFeedback,
}: Props) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [posts,    setPosts]    = useState(initialPosts)
  const [stats]                  = useState(initialStats)
  const [showForm, setShowForm] = useState(false)
  const [toast,    setToast]    = useState<Toast | null>(null)

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4_000)
  }, [])

  // Mostra resultado do OAuth callback
  useEffect(() => {
    if (oauthFeedback.success === 'connected' && oauthFeedback.count) {
      showToast(`${oauthFeedback.count} conta(s) conectada(s) com sucesso!`, 'success')
      window.history.replaceState(null, '', '/dashboard/instagram')
    }
    if (oauthFeedback.error) {
      showToast(ERROR_LABELS[oauthFeedback.error] ?? `Erro: ${oauthFeedback.error}`, 'error')
      window.history.replaceState(null, '', '/dashboard/instagram')
    }
  }, [oauthFeedback, showToast])

  // Realtime: posts (UPDATE → atualiza status em tempo real)
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('instagram-posts-realtime')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'instagram_posts', filter: `user_id=eq.${userId}` },
        payload => {
          const row = payload.new as RawIgPost
          setPosts(arr => arr.map(p => p.id === row.id ? row : p))
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'instagram_posts', filter: `user_id=eq.${userId}` },
        payload => {
          const row = payload.new as RawIgPost
          setPosts(arr => arr.some(p => p.id === row.id) ? arr : [row, ...arr])
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'instagram_posts', filter: `user_id=eq.${userId}` },
        payload => {
          const deleted = payload.old as { id: string }
          setPosts(arr => arr.filter(p => p.id !== deleted.id))
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId])

  // Realtime: accounts (DELETE → remove da lista)
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('instagram-accounts-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'instagram_accounts', filter: `user_id=eq.${userId}` },
        payload => {
          if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setAccounts(arr => arr.filter(a => a.id !== deleted.id))
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
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-md px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2"
          style={{
            background: toast.type === 'success'
              ? 'color-mix(in oklab, var(--success) 12%, var(--surface))'
              : 'color-mix(in oklab, var(--danger) 12%, var(--surface))',
            border: `1px solid ${toast.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
            color:  toast.type === 'success' ? 'var(--success)' : 'var(--danger)',
          }}>
          {toast.type === 'success'
            ? <CheckCircle2 size={16} />
            : <AlertTriangle size={16} />}
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}

      <PageHeader
        title="Instagram"
        subtitle="Agende posts, reels e carrosséis automaticamente nas suas contas do Instagram."
        actions={
          activeAccounts.length > 0 && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ background: 'var(--primary)', color: 'var(--accent-fg)' }}
            >
              <Plus size={14} />
              Novo post
            </button>
          )
        }
      />

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        {/* Aviso config */}
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
                  precisam estar definidas no servidor para conectar o Instagram. Avise o administrador.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* KPIs */}
        <KpiRow stats={stats} />

        {/* Contas conectadas */}
        <section>
          <div className="flex items-center justify-between mb-3">
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
              <ConnectButton disabled={!hasMetaConfig} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {accounts.map(acc => (
                <AccountCard key={acc.id} account={acc} onToast={showToast} />
              ))}
            </div>
          )}
        </section>

        {/* Formulário de novo post */}
        {showForm && activeAccounts.length > 0 && (
          <PostForm
            accounts={activeAccounts}
            onClose={() => setShowForm(false)}
            onSuccess={() => {
              setShowForm(false)
              showToast('Post agendado!', 'success')
            }}
            onError={msg => showToast(msg, 'error')}
          />
        )}

        {/* Lista de posts */}
        <section>
          <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
            Posts ({posts.length})
          </h2>
          <PostList
            posts={posts}
            accounts={accounts}
            onToast={showToast}
          />
        </section>
      </div>
    </>
  )
}
