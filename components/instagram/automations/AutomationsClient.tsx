'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, MessageCircle, Plus, Pencil, Trash2, Loader2, X, Film, Info } from 'lucide-react'
import Badge from '../shared/Badge'
import Toast from '../shared/Toast'
import {
  createAutomationAction, updateAutomationAction, toggleAutomationAction, deleteAutomationAction,
  listAccountMediaAction, type AccountMedia, type AutomationInput,
} from '@/app/actions/instagram-automations'

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface AutomationItem {
  id:                  string
  account_id:          string
  name:                string
  media_id:            string | null
  media_label:         string | null
  keywords:            string[]
  match_type:          'contains' | 'exact'
  reply_comment_text:  string | null
  dm_text:             string
  dm_button_label:     string | null
  final_text:          string | null
  final_buttons:       Array<{ title: string; url: string }>
  require_follow:      boolean
  follow_text:         string | null
  follow_button_label: string | null
  is_active:           boolean
  stats:               { sent: number; clicked: number; delivered: number; failed: number }
}

interface AccountOption { id: string; username: string | null; ig_user_id: string }

interface Props {
  items:     AutomationItem[]
  accounts:  AccountOption[]
  loadError: string | null
}

interface Draft {
  accountId:         string
  name:              string
  mediaId:           string | null
  mediaLabel:        string | null
  keywordsText:      string
  matchType:         'contains' | 'exact'
  replyEnabled:      boolean
  replyText:         string
  dmText:            string
  useButton:         boolean
  dmButtonLabel:     string
  finalText:         string
  finalButtons:      Array<{ title: string; url: string }>
  requireFollow:     boolean
  followText:        string
  followButtonLabel: string
}

const DEFAULT_FOLLOW_TEXT = 'Esse link é exclusivo para seguidores! 🔒 Me segue aqui e toca no botão abaixo que eu te libero na hora 👇'

function emptyDraft(accountId: string): Draft {
  return {
    accountId, name: '', mediaId: null, mediaLabel: null, keywordsText: '', matchType: 'contains',
    replyEnabled: true, replyText: 'Te enviei uma mensagem no direct! 📩 Dá uma olhada lá.',
    dmText: 'Fala, {usuario}! 👋 Toca no botão que eu te mando agora 👇',
    useButton: true, dmButtonLabel: 'Quero receber',
    finalText: 'Aqui está o que você pediu 👇',
    finalButtons: [{ title: 'Acessar agora', url: '' }],
    requireFollow: false, followText: DEFAULT_FOLLOW_TEXT, followButtonLabel: 'Seguindo',
  }
}

function draftFromItem(a: AutomationItem): Draft {
  return {
    accountId: a.account_id, name: a.name, mediaId: a.media_id, mediaLabel: a.media_label,
    keywordsText: a.keywords.join(', '), matchType: a.match_type,
    replyEnabled: !!a.reply_comment_text, replyText: a.reply_comment_text ?? '',
    dmText: a.dm_text, useButton: !!a.dm_button_label, dmButtonLabel: a.dm_button_label ?? 'Quero receber',
    finalText: a.final_text ?? '', finalButtons: a.final_buttons.length ? a.final_buttons : [{ title: '', url: '' }],
    requireFollow: a.require_follow, followText: a.follow_text ?? DEFAULT_FOLLOW_TEXT,
    followButtonLabel: a.follow_button_label ?? 'Seguindo',
  }
}

function draftToInput(d: Draft): AutomationInput {
  return {
    accountId:         d.accountId,
    name:              d.name,
    mediaId:           d.mediaId,
    mediaLabel:        d.mediaLabel,
    keywords:          d.keywordsText.split(',').map(k => k.trim()).filter(Boolean),
    matchType:         d.matchType,
    replyCommentText:  d.replyEnabled ? d.replyText : null,
    dmText:            d.dmText,
    dmButtonLabel:     d.useButton ? d.dmButtonLabel : null,
    finalText:         d.useButton ? d.finalText : null,
    finalButtons:      d.finalButtons.filter(b => b.title.trim() || b.url.trim()),
    requireFollow:     d.useButton && d.requireFollow,
    followText:        d.followText,
    followButtonLabel: d.followButtonLabel,
  }
}

// ─── Estilos ────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
}
const inputCls = 'w-full px-3 py-2 rounded-xl text-sm outline-none'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{label}</span>
      {children}
      {hint && <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>{hint}</span>}
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</h3>
      {children}
    </section>
  )
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer" style={{ color: 'var(--text)' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-1" />
      <span>{children}</span>
    </label>
  )
}

// ─── Prévia do DM ───────────────────────────────────────────────────────────

function Bubble({ text, buttons }: { text: string; buttons: string[] }) {
  return (
    <div className="max-w-[260px] rounded-2xl p-3 space-y-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{text || '…'}</p>
      {buttons.map((b, i) => (
        <div key={i} className="text-center text-sm font-medium rounded-lg py-2"
          style={{ background: 'var(--bg)', color: 'var(--text)' }}>{b || '…'}</div>
      ))}
    </div>
  )
}

function Preview({ d }: { d: Draft }) {
  const sample = (t: string) => t.replace(/\{usuario\}/gi, '@maria')
  const links = d.finalButtons.map(b => b.title)
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>PRÉVIA DA CONVERSA</p>
      {d.replyEnabled && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Resposta no comentário: <span style={{ color: 'var(--text)' }}>{sample(d.replyText)}</span>
        </p>
      )}
      <Bubble text={sample(d.dmText)} buttons={d.useButton ? [d.dmButtonLabel] : links} />
      {d.useButton && (
        <>
          {d.requireFollow && (
            <>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>↓ clicou, mas ainda não segue</p>
              <Bubble text={d.followText} buttons={[d.followButtonLabel]} />
            </>
          )}
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>↓ {d.requireFollow ? 'segue e clicou' : 'clicou'}</p>
          <Bubble text={sample(d.finalText)} buttons={links} />
        </>
      )}
    </div>
  )
}

// ─── Editor ─────────────────────────────────────────────────────────────────

function Editor({
  initial, editingId, accounts, onClose, onSaved, onToast,
}: {
  initial:   Draft
  editingId: string | null
  accounts:  AccountOption[]
  onClose:   () => void
  onSaved:   () => void
  onToast:   (msg: string, type: 'success' | 'error') => void
}) {
  const [d, setD]                 = useState(initial)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [media, setMedia]         = useState<AccountMedia[] | null>(null)
  const [loadingMedia, setLoadingMedia] = useState(false)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }))

  async function loadMedia() {
    setLoadingMedia(true)
    const r = await listAccountMediaAction(d.accountId)
    setLoadingMedia(false)
    if (!r.ok) { onToast(r.error, 'error'); return }
    setMedia(r.media)
  }

  function setButton(i: number, patch: Partial<{ title: string; url: string }>) {
    set('finalButtons', d.finalButtons.map((b, idx) => (idx === i ? { ...b, ...patch } : b)))
  }

  async function save() {
    setSaving(true)
    setError(null)
    const input = draftToInput(d)
    const r = editingId ? await updateAutomationAction(editingId, input) : await createAutomationAction(input)
    setSaving(false)
    if (!r.ok) { setError(r.error); return }
    onToast(editingId ? 'Automação atualizada.' : 'Automação criada e ativa.', 'success')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="max-w-5xl mx-auto my-6 px-4">
        <div className="rounded-2xl p-5" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              {editingId ? 'Editar automação' : 'Nova automação'}
            </h2>
            <button onClick={onClose} disabled={saving} className="opacity-60 hover:opacity-100"><X size={18} /></button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
            <div className="space-y-4">
              <Section title="1. Quando disparar">
                <Field label="Nome da automação">
                  <input className={inputCls} style={inputStyle} value={d.name} maxLength={80}
                    onChange={e => set('name', e.target.value)} placeholder="Ex.: Link do material grátis" />
                </Field>

                <Field label="Conta">
                  <select className={inputCls} style={inputStyle} value={d.accountId}
                    onChange={e => { set('accountId', e.target.value); set('mediaId', null); set('mediaLabel', null); setMedia(null) }}>
                    {accounts.map(a => <option key={a.id} value={a.id}>@{a.username ?? a.ig_user_id}</option>)}
                  </select>
                </Field>

                <div className="space-y-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>Publicação</span>
                  <div className="rounded-xl p-2 space-y-1" style={{ border: '1px solid var(--border)' }}>
                    <label className="flex items-center gap-2 text-sm p-1 cursor-pointer" style={{ color: 'var(--text)' }}>
                      <input type="radio" checked={d.mediaId === null}
                        onChange={() => { set('mediaId', null); set('mediaLabel', null) }} />
                      Qualquer publicação da conta
                    </label>
                    {d.mediaId && (
                      <label className="flex items-center gap-2 text-sm p-1" style={{ color: 'var(--text)' }}>
                        <input type="radio" checked readOnly />
                        <span className="truncate">{d.mediaLabel || `Post ${d.mediaId}`}</span>
                      </label>
                    )}
                    {media?.map(m => (
                      <label key={m.id} className="flex items-center gap-2 text-sm p-1 cursor-pointer" style={{ color: 'var(--text)' }}>
                        <input type="radio" checked={d.mediaId === m.id}
                          onChange={() => { set('mediaId', m.id); set('mediaLabel', m.caption || `${m.type} sem legenda`) }} />
                        {m.thumb
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={m.thumb} alt="" className="w-8 h-8 rounded object-cover" />
                          : <Film size={16} />}
                        <span className="truncate">[{m.type}] {m.caption || 'Sem legenda'}</span>
                      </label>
                    ))}
                    <button type="button" onClick={loadMedia} disabled={loadingMedia || !d.accountId}
                      className="text-xs font-medium px-2 py-1 inline-flex items-center gap-1" style={{ color: 'var(--primary)' }}>
                      {loadingMedia && <Loader2 size={12} className="animate-spin" />}
                      {media ? 'Recarregar meus posts' : 'Escolher um post/Reels específico'}
                    </button>
                  </div>
                </div>

                <Field label="Palavras-chave (separe por vírgula)" hint="Ex.: eu quero, link, material. Maiúsculas, acentos e pontuação são ignorados.">
                  <input className={inputCls} style={inputStyle} value={d.keywordsText}
                    onChange={e => set('keywordsText', e.target.value)} placeholder="eu quero, link" />
                </Field>

                <Field label="Como comparar">
                  <select className={inputCls} style={inputStyle} value={d.matchType}
                    onChange={e => set('matchType', e.target.value as Draft['matchType'])}>
                    <option value="contains">O comentário contém a palavra</option>
                    <option value="exact">O comentário é exatamente a palavra</option>
                  </select>
                </Field>
              </Section>

              <Section title="2. Resposta pública no comentário">
                <Check checked={d.replyEnabled} onChange={v => set('replyEnabled', v)}>
                  Responder o comentário avisando que a mensagem foi enviada no direct
                </Check>
                {d.replyEnabled && (
                  <Field label="Texto da resposta" hint="Use {usuario} para marcar quem comentou.">
                    <textarea className={inputCls} style={inputStyle} rows={2} maxLength={300} value={d.replyText}
                      onChange={e => set('replyText', e.target.value)} />
                  </Field>
                )}
              </Section>

              <Section title="3. Mensagem no direct">
                <Field label="Mensagem" hint="Máximo 640 caracteres. Use {usuario} para o @ da pessoa.">
                  <textarea className={inputCls} style={inputStyle} rows={3} maxLength={640} value={d.dmText}
                    onChange={e => set('dmText', e.target.value)} />
                </Field>

                <Check checked={d.useButton} onChange={v => set('useButton', v)}>
                  Pedir um clique antes de enviar o link (recomendado)
                </Check>
                <p className="text-[11px] -mt-1" style={{ color: 'var(--text-muted)' }}>
                  A Meta só libera a segunda mensagem depois que a pessoa responde, e é esse clique que também permite checar se ela segue você.
                </p>

                {d.useButton && (
                  <Field label="Texto do botão (máx. 20)">
                    <input className={inputCls} style={inputStyle} maxLength={20} value={d.dmButtonLabel}
                      onChange={e => set('dmButtonLabel', e.target.value)} />
                  </Field>
                )}
              </Section>

              <Section title={d.useButton ? '4. Mensagem final (depois do clique)' : '4. Botões de link'}>
                {d.useButton && (
                  <Field label="Mensagem final">
                    <textarea className={inputCls} style={inputStyle} rows={3} maxLength={640} value={d.finalText}
                      onChange={e => set('finalText', e.target.value)} />
                  </Field>
                )}

                <div className="space-y-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>Botões de link (até 3)</span>
                  {d.finalButtons.map((b, i) => (
                    <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                      <input className={inputCls} style={inputStyle} maxLength={20} placeholder="Texto" value={b.title}
                        onChange={e => setButton(i, { title: e.target.value })} />
                      <input className={inputCls} style={inputStyle} placeholder="https://…" value={b.url}
                        onChange={e => setButton(i, { url: e.target.value })} />
                      <button type="button" onClick={() => set('finalButtons', d.finalButtons.filter((_, idx) => idx !== i))}
                        className="px-2 opacity-60 hover:opacity-100" aria-label="Remover botão"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {d.finalButtons.length < 3 && (
                    <button type="button" onClick={() => set('finalButtons', [...d.finalButtons, { title: '', url: '' }])}
                      className="text-xs font-medium inline-flex items-center gap-1" style={{ color: 'var(--primary)' }}>
                      <Plus size={12} /> Adicionar botão
                    </button>
                  )}
                </div>

                {d.useButton && (
                  <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                    <Check checked={d.requireFollow} onChange={v => set('requireFollow', v)}>
                      Só liberar o link para quem me segue
                    </Check>
                    {d.requireFollow && (
                      <>
                        <Field label="Mensagem para quem ainda não segue">
                          <textarea className={inputCls} style={inputStyle} rows={2} maxLength={640} value={d.followText}
                            onChange={e => set('followText', e.target.value)} />
                        </Field>
                        <Field label="Texto do botão de confirmação (máx. 20)">
                          <input className={inputCls} style={inputStyle} maxLength={20} value={d.followButtonLabel}
                            onChange={e => set('followButtonLabel', e.target.value)} />
                        </Field>
                      </>
                    )}
                  </div>
                )}
              </Section>
            </div>

            <div className="lg:sticky lg:top-6 self-start"><Preview d={d} /></div>
          </div>

          {error && <p className="text-sm mt-4" style={{ color: 'var(--danger)' }}>{error}</p>}

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl text-sm" style={{ color: 'var(--text-muted)' }}>
              Cancelar
            </button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--primary)', color: 'var(--accent-fg, #fff)' }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Salvando…' : 'Salvar automação'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Lista ──────────────────────────────────────────────────────────────────

export default function AutomationsClient({ items, accounts, loadError }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editor, setEditor] = useState<{ id: string | null; draft: Draft } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast]   = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4_000)
  }, [])

  const refresh = () => startTransition(() => router.refresh())

  async function toggle(a: AutomationItem) {
    setBusyId(a.id)
    const r = await toggleAutomationAction(a.id, !a.is_active)
    setBusyId(null)
    if (!r.ok) { showToast(r.error, 'error'); return }
    refresh()
  }

  async function remove(a: AutomationItem) {
    if (!window.confirm(`Apagar a automação "${a.name}"? O histórico dela também será apagado.`)) return
    setBusyId(a.id)
    const r = await deleteAutomationAction(a.id)
    setBusyId(null)
    if (!r.ok) { showToast(r.error, 'error'); return }
    showToast('Automação apagada.')
    refresh()
  }

  const accountName = (id: string) => {
    const a = accounts.find(x => x.id === id)
    return a ? `@${a.username ?? a.ig_user_id}` : 'conta desconectada'
  }

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        <div className="rounded-xl p-4 text-sm flex gap-2" style={{
          background: 'color-mix(in oklab, var(--info) 8%, transparent)', border: '1px solid var(--border)', color: 'var(--text)',
        }}>
          <Info size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--info)' }} />
          <div className="space-y-1">
            <p>
              Quando alguém comenta a palavra-chave, o Umbra Bot responde o comentário e manda um DM com botões.
              A Meta permite <strong>1 DM por comentário</strong>, em até 7 dias.
            </p>
            <p style={{ color: 'var(--text-muted)' }}>
              Requisitos: token com as permissões de <code>comentários</code> e <code>mensagens</code> do Instagram e o webhook
              do app Meta assinado nos campos <code>comments</code> e <code>messaging_postbacks</code>. Com o app em modo
              desenvolvimento, só dispara para comentários de contas com função no app (admin, desenvolvedor ou testador).
            </p>
          </div>
        </div>

        {loadError && (
          <div className="rounded-xl p-4 text-sm flex gap-2" style={{
            background: 'color-mix(in oklab, var(--danger) 10%, transparent)', border: '1px solid var(--danger)', color: 'var(--text)',
          }}>
            <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
            <p>
              Não foi possível carregar as automações (código {loadError}). Se for <code>42P01</code>, aplique a migração
              <code> 20261102000121_instagram_automations.sql</code> no Supabase.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <MessageCircle size={16} style={{ color: 'var(--primary)' }} />
            Automações de comentário ({items.length})
          </h2>
          <button
            onClick={() => accounts.length > 0 && setEditor({ id: null, draft: emptyDraft(accounts[0].id) })}
            disabled={accounts.length === 0}
            title={accounts.length === 0 ? 'Conecte uma conta Instagram primeiro' : undefined}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--primary)', color: 'var(--accent-fg, #fff)' }}>
            <Plus size={14} /> Nova automação
          </button>
        </div>

        {accounts.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Conecte uma conta na aba <strong>Contas</strong> para criar automações.
          </p>
        )}

        {items.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
            <MessageCircle size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Nenhuma automação criada</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Crie uma para enviar link/material no direct de quem comentar uma palavra-chave.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {items.map(a => (
              <div key={a.id} className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{a.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {accountName(a.account_id)} · {a.media_id ? (a.media_label || 'Post específico') : 'Qualquer publicação'}
                    </p>
                  </div>
                  <Badge tone={a.is_active ? 'success' : 'muted'}>{a.is_active ? 'Ativa' : 'Pausada'}</Badge>
                </div>

                <div className="flex flex-wrap gap-1">
                  {a.keywords.map(k => <Badge key={k} tone="primary">{k}</Badge>)}
                  {a.require_follow && <Badge tone="info">exige seguir</Badge>}
                  {a.reply_comment_text && <Badge tone="muted">responde o comentário</Badge>}
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    ['DMs enviados', a.stats.sent], ['Cliques', a.stats.clicked],
                    ['Links entregues', a.stats.delivered], ['Falhas', a.stats.failed],
                  ].map(([label, n]) => (
                    <div key={label as string} className="rounded-lg py-2" style={{ background: 'var(--bg)' }}>
                      <p className="text-base font-bold" style={{ color: label === 'Falhas' && Number(n) > 0 ? 'var(--danger)' : 'var(--text)' }}>{n}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Últimos 30 dias</p>

                <div className="flex items-center gap-2">
                  <button onClick={() => toggle(a)} disabled={busyId === a.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    {a.is_active ? 'Pausar' : 'Ativar'}
                  </button>
                  <button onClick={() => setEditor({ id: a.id, draft: draftFromItem(a) })}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <Pencil size={12} /> Editar
                  </button>
                  <button onClick={() => remove(a)} disabled={busyId === a.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 ml-auto disabled:opacity-50"
                    style={{ color: 'var(--danger)' }}>
                    <Trash2 size={12} /> Apagar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editor && (
        <Editor
          key={editor.id ?? 'new'}
          initial={editor.draft}
          editingId={editor.id}
          accounts={accounts}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); refresh() }}
          onToast={showToast}
        />
      )}
    </>
  )
}
