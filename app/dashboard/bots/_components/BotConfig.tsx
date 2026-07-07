'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  ChevronLeft, ExternalLink, Pause, Play, Settings, MessageSquare, GitBranch,
  Eye, EyeOff, AlertCircle, Webhook, Trash2, Save, Users, ShoppingBag, Target,
  CircleDollarSign, Info, Loader2, TriangleAlert, Pencil, ArrowUpRight, X,
} from 'lucide-react'
import {
  BotData, FlowData, MESSAGE_VARS, STATUS_CONFIG,
  fmtNum, fmtBRLdec, fmtPct, fmtDate, fmtDateTime,
} from './types'
import { Card, Btn, Badge, Tabs, CopyButton, ReadOnlyRow, BotAvatar } from './ui'
import { TelegramProfileModal } from './TelegramProfileModal'
import {
  registerWebhookAction,
  getBotTokenAction,
  getBotMessagesAction,
} from '@/app/actions/bots'

// ─── TokenReveal ───────────────────────────────────────────────────────────────

function TokenReveal({ botId }: { botId: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function toggle() {
    if (token) { setToken(null); return }
    setLoading(true); setErr('')
    try {
      setToken(await getBotTokenAction(botId))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao revelar token.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="relative">
        <input type="text" value={token ?? '•'.repeat(42)} readOnly
          className="w-full h-10 pl-3 pr-20 bg-surface-2 border border-border rounded-lg text-[12px] font-mono text-text-muted" />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          <button type="button" onClick={toggle} disabled={loading}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-3 hover:text-text disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : token ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          {token && <CopyButton text={token} />}
        </div>
      </div>
      {err && <p className="mt-1 text-[11px] text-danger flex items-center gap-1"><AlertCircle size={11} />{err}</p>}
    </div>
  )
}

// ─── RegisterWebhookButton ─────────────────────────────────────────────────────

function RegisterWebhookButton({
  botId, onSuccess, size = 'sm',
}: { botId: string; onSuccess: (url: string) => void; size?: 'sm' | 'md' }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handle() {
    setLoading(true); setErr('')
    try {
      const { webhookUrl } = await registerWebhookAction(botId)
      onSuccess(webhookUrl)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao registrar webhook.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Btn variant="primary" size={size} onClick={handle} disabled={loading}>
        {loading ? <><Loader2 size={13} className="animate-spin" /> Registrando…</> : <><Webhook size={13} /> Registrar webhook</>}
      </Btn>
      {err && <p className="mt-1.5 text-[11px] text-danger flex items-center gap-1"><AlertCircle size={11} />{err}</p>}
    </div>
  )
}

// ─── TextareaWithVars ─────────────────────────────────────────────────────────

function TextareaWithVars({ value, onChange, rows = 4, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  function insertVar(v: string) {
    const ta = ref.current
    if (!ta) return
    const start = ta.selectionStart ?? value.length
    const end   = ta.selectionEnd   ?? value.length
    const insert = `{${v}}`
    onChange(value.substring(0, start) + insert + value.substring(end))
    requestAnimationFrame(() => { ta.focus(); const pos = start + insert.length; ta.setSelectionRange(pos, pos) })
  }
  return (
    <>
      <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none leading-relaxed" />
      <div className="mt-2 flex flex-wrap gap-1 items-center text-[11px]">
        <span className="text-text-muted">Inserir variável:</span>
        {MESSAGE_VARS.map(v => (
          <button key={v} type="button" onClick={() => insertVar(v)}
            className="px-1.5 h-5 bg-surface-2 border border-border rounded font-mono text-[10.5px] text-text-muted hover:text-text hover:bg-surface-3">{`{${v}}`}</button>
        ))}
      </div>
    </>
  )
}

// ─── ChatBubble ────────────────────────────────────────────────────────────────

function ChatBubble({ text, incoming, placeholder }: { text: string; incoming?: boolean; placeholder?: boolean }) {
  return (
    <div className={`flex ${incoming ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[260px] text-[12px] leading-snug px-3 py-2 rounded-2xl whitespace-pre-wrap ${incoming ? 'bg-primary text-primary-fg rounded-br-sm' : 'bg-surface-2 text-text rounded-bl-sm'} ${placeholder ? 'opacity-50 italic' : ''}`}>
        {text}
      </div>
    </div>
  )
}

// ─── GeneralTab ────────────────────────────────────────────────────────────────

function GeneralTab({ bot, onUpdate, onStateUpdate, onDelete }: {
  bot: BotData
  onUpdate: (p: Partial<BotData>) => Promise<void>
  onStateUpdate: (p: Partial<BotData>) => void
  onDelete: (id: string) => Promise<void>
}) {
  const [name, setName]             = useState(bot.name)
  const [description, setDesc]      = useState(bot.description)
  const [saving, setSaving]         = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [tgProfileOpen, setTgProfileOpen] = useState(false)
  const dirty = name !== bot.name || description !== bot.description

  async function save() {
    setSaving(true)
    await onUpdate({ name, description })
    setSaving(false)
  }

  return (
    <>
      <TelegramProfileModal bot={bot} open={tgProfileOpen} onClose={() => setTgProfileOpen(false)} />
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
      <div className="space-y-4">
        <Card title="Informações básicas" subtitle="Dados internos do bot no Umbra Bot">
          <div className="space-y-3.5 mt-1">
            <div>
              <label className="block text-[12.5px] font-medium text-text mb-1.5">Nome</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-text mb-1.5">Descrição (interno)</label>
              <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
                placeholder="Curta descrição do propósito deste bot…"
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12px] pt-2 border-t border-border">
              {bot.username && <ReadOnlyRow label="@Username"           value={`@${bot.username}`} mono />}
              {bot.telegramId && <ReadOnlyRow label="Telegram ID"       value={bot.telegramId} mono />}
              <ReadOnlyRow label="Adicionado em"       value={fmtDate(bot.addedAt)} />
              {bot.lastSync && <ReadOnlyRow label="Última sincronização" value={fmtDateTime(bot.lastSync)} />}
            </div>
            {dirty && (
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Btn variant="ghost" size="sm" onClick={() => { setName(bot.name); setDesc(bot.description) }}>Descartar</Btn>
                <Btn variant="primary" size="sm" onClick={save} disabled={saving}>
                  {saving ? <><Loader2 size={13} className="animate-spin" /> Salvando…</> : <><Save size={13} /> Salvar alterações</>}
                </Btn>
              </div>
            )}
          </div>
        </Card>

        <Card title="Perfil no Telegram" subtitle="Foto, nome, descrição e comandos visíveis para os usuários">
          <div className="flex items-center justify-between mt-1 gap-4">
            <p className="text-[12px] text-text-muted leading-relaxed">
              Personalize a aparência do bot diretamente pelo painel — sem precisar abrir o BotFather.
            </p>
            <Btn variant="secondary" size="sm" onClick={() => setTgProfileOpen(true)} className="shrink-0">
              <Pencil size={13} /> Editar perfil
            </Btn>
          </div>
        </Card>

        <Card title="Token & Webhook" subtitle="Credenciais técnicas do bot">
          <div className="space-y-3.5 mt-1">
            <div>
              <label className="block text-[12.5px] font-medium text-text mb-1.5">Token do BotFather</label>
              <TokenReveal botId={bot.id} />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-text mb-1.5">Webhook URL</label>
              {bot.webhookUrl ? (
                <>
                  <div className="relative">
                    <input type="text" value={bot.webhookUrl} readOnly
                      className="w-full h-10 pl-3 pr-12 bg-surface-2 border border-border rounded-lg text-[12px] font-mono text-text-muted" />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2"><CopyButton text={bot.webhookUrl} /></div>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1">Atualizado automaticamente quando você reconecta o bot.</p>
                  <div className="mt-2">
                    <RegisterWebhookButton botId={bot.id} onSuccess={url => onStateUpdate({ webhookUrl: url, status: 'online' })} />
                  </div>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="p-3 bg-warning-soft border border-warning/20 rounded-lg flex items-start gap-2.5">
                    <TriangleAlert size={14} className="text-warning shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[12.5px] font-medium text-text">Webhook não configurado</div>
                      <div className="text-[11.5px] text-text-muted mt-0.5">O bot não receberá mensagens até que o webhook seja registrado.</div>
                    </div>
                  </div>
                  <RegisterWebhookButton botId={bot.id} onSuccess={url => onStateUpdate({ webhookUrl: url, status: 'online' })} />
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="bg-surface border-2 border-danger/30 rounded-xl p-5">
          <div className="text-[14px] font-semibold text-danger">Zona de perigo</div>
          <div className="text-[12px] text-text-muted mt-1 max-w-md">Remover o bot desconecta o webhook e arquiva todas as mensagens em fila. Esta ação não pode ser desfeita.</div>
          <div className="mt-4">
            {confirmDel ? (
              <div className="flex items-center gap-2">
                <Btn variant="ghost" size="sm" onClick={() => setConfirmDel(false)}>Cancelar</Btn>
                <Btn variant="danger" size="sm" onClick={() => onDelete(bot.id)}><Trash2 size={13} /> Sim, remover bot</Btn>
              </div>
            ) : (
              <Btn variant="secondary" size="sm" onClick={() => setConfirmDel(true)}><Trash2 size={13} /> Remover este bot</Btn>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Card title="Status" subtitle="Controle a operação do bot">
          <div className="space-y-3 mt-1">
            <div className={`p-3 rounded-lg border ${
              bot.status === 'online'  ? 'bg-success-soft border-success/20' :
              bot.status === 'banned'  ? 'bg-danger-soft border-danger/20'   : 'bg-surface-2 border-border'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`relative w-2 h-2 rounded-full ${STATUS_CONFIG[bot.status].dot}`}>
                  {STATUS_CONFIG[bot.status].pulse && <span className={`absolute inset-0 rounded-full ${STATUS_CONFIG[bot.status].dot} animate-ping opacity-60`} />}
                </span>
                <span className="text-[13px] font-semibold text-text">{STATUS_CONFIG[bot.status].label}</span>
              </div>
              <div className="text-[11.5px] text-text-muted mt-1.5">
                {bot.status === 'online'  && 'Recebendo e respondendo mensagens normalmente.'}
                {bot.status === 'offline' && 'Sem conexão com o Telegram. Registre o webhook para retomar.'}
                {bot.status === 'banned'  && 'Bot banido pelo Telegram. Substitua para retomar a operação.'}
                {bot.status === 'paused'  && 'Pausado manualmente. Mensagens em fila não estão sendo entregues.'}
              </div>
            </div>
            {bot.lastSync && (
              <p className="text-[11.5px] text-text-muted">Última sincronização: <span className="text-text">{fmtDateTime(bot.lastSync)}</span></p>
            )}
          </div>
        </Card>
      </div>
    </div>
    </>
  )
}

// ─── MessagesTab ───────────────────────────────────────────────────────────────

function MessagesTab({ bot, onUpdate }: { bot: BotData; onUpdate: (p: Partial<BotData>) => Promise<void> }) {
  const [welcome,  setWelcome]  = useState('')
  const [fallback, setFallback] = useState('')
  const [loaded,   setLoaded]   = useState(false)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    let cancelled = false
    getBotMessagesAction(bot.id).then(({ welcomeMessage, fallbackMessage }) => {
      if (cancelled) return
      setWelcome(welcomeMessage)
      setFallback(fallbackMessage)
      setLoaded(true)
    }).catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [bot.id])

  const dirty = loaded && (welcome !== (bot.welcomeMessage ?? '') || fallback !== (bot.fallbackMessage ?? ''))

  async function save() {
    setSaving(true)
    await onUpdate({ welcomeMessage: welcome, fallbackMessage: fallback })
    setSaving(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
      <div className="space-y-4">
        {!loaded ? (
          <div className="flex items-center justify-center py-12 text-text-muted gap-2">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Carregando mensagens…</span>
          </div>
        ) : (
          <>
            <Card title="Mensagem de boas-vindas" subtitle="Enviada automaticamente quando um usuário inicia conversa pela primeira vez.">
              <TextareaWithVars value={welcome} onChange={setWelcome} rows={5} placeholder="Olá {nome}! Bem-vindo…" />
            </Card>
            <Card title="Mensagem fallback" subtitle="Resposta automática quando o bot não entende a mensagem do usuário.">
              <TextareaWithVars value={fallback} onChange={setFallback} rows={4} placeholder="Não entendi sua mensagem…" />
            </Card>
            {dirty && (
              <div className="flex justify-end gap-2">
                <Btn variant="ghost" onClick={() => { setWelcome(bot.welcomeMessage ?? ''); setFallback(bot.fallbackMessage ?? '') }}>Descartar</Btn>
                <Btn variant="primary" onClick={save} disabled={saving}>
                  {saving ? <><Loader2 size={13} className="animate-spin" /> Salvando…</> : <><Save size={13} /> Salvar alterações</>}
                </Btn>
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <Card title="Pré-visualização" subtitle="Como aparece no Telegram">
          <div className="mt-2 space-y-2.5">
            <ChatBubble
              text={welcome.replace(/\{nome\}/g, 'João').replace(/\{bot\}/g, bot.name) || 'Mensagem de boas-vindas aparece aqui…'}
              placeholder={!welcome}
            />
          </div>
          <div className="mt-4 pt-3 border-t border-border space-y-2.5">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-subtle">Quando não entende</div>
            <ChatBubble incoming text="?? quanto custa" />
            <ChatBubble text={fallback.replace(/\{nome\}/g, 'João') || 'Mensagem de fallback aparece aqui…'} placeholder={!fallback} />
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── FlowTab ───────────────────────────────────────────────────────────────────

function FlowTab({ bot, flows, onUpdate }: { bot: BotData; flows: FlowData[]; onUpdate: (p: Partial<BotData>) => Promise<void> }) {
  const current = flows.find(f => f.id === bot.activeFlowId)
  const others  = flows.filter(f => f.id !== bot.activeFlowId)

  return (
    <div className="space-y-4">
      <Card title="Fluxo ativo" subtitle="Fluxo de mensagens executado quando o usuário interage com o bot">
        {current ? (
          <div className="mt-2 flex items-start gap-4 p-4 bg-primary-soft/40 border border-primary/20 rounded-lg">
            <div className="w-11 h-11 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
              <GitBranch size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold text-text">{current.name}</div>
              {current.description && <div className="text-[12px] text-text-muted mt-0.5 leading-relaxed">{current.description}</div>}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-text-muted">
                <span className="inline-flex items-center gap-1"><Users size={11} /> {fmtNum(bot.leads)} leads</span>
                <span className="inline-flex items-center gap-1"><ShoppingBag size={11} /> {fmtNum(bot.sales)} vendas</span>
                <span className="inline-flex items-center gap-1"><Target size={11} /> conv. {fmtPct(bot.conversion)}</span>
                <span className="inline-flex items-center gap-1"><CircleDollarSign size={11} /> {fmtBRLdec(bot.revenue)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <Btn variant="ghost" size="sm" onClick={() => onUpdate({ activeFlowId: null })}><X size={13} /> Desvincular</Btn>
            </div>
          </div>
        ) : (
          <div className="mt-2 p-4 bg-surface-2/40 border border-dashed border-border rounded-lg flex items-center gap-3 text-[12.5px] text-text-muted">
            <Info size={14} /> Nenhum fluxo vinculado. Selecione um abaixo para começar.
          </div>
        )}
      </Card>

      <Card title="Outros fluxos disponíveis" subtitle="Clique para vincular ao bot">
        {others.length === 0 && !current ? (
          <div className="py-6 text-center text-[12.5px] text-text-muted">
            Nenhum fluxo criado ainda. Crie fluxos em <strong className="text-text">Fluxos de venda</strong>.
          </div>
        ) : others.length === 0 ? (
          <div className="py-4 text-[12.5px] text-text-muted text-center">Todos os fluxos já estão vinculados a este bot.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {others.map(f => (
              <button key={f.id} type="button" onClick={() => onUpdate({ activeFlowId: f.id })}
                className="text-left p-3 bg-surface border border-border rounded-lg hover:border-primary hover:bg-primary-soft/20 transition-colors group">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-surface-2 text-text-muted group-hover:bg-primary-soft group-hover:text-primary flex items-center justify-center shrink-0 transition-colors">
                    <GitBranch size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-text truncate">{f.name}</div>
                    {f.description && <div className="text-[11px] text-text-muted truncate">{f.description}</div>}
                  </div>
                  <ArrowUpRight size={12} className="text-text-subtle group-hover:text-primary transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── BotConfig ─────────────────────────────────────────────────────────────────

export function BotConfig({ bot, flows, onBack, onUpdate, onStateUpdate, onDelete, defaultTab = 'geral' }: {
  bot: BotData; flows: FlowData[]; onBack: () => void
  onUpdate: (p: Partial<BotData>) => Promise<void>
  onStateUpdate: (p: Partial<BotData>) => void
  onDelete: (id: string) => Promise<void>
  defaultTab?: string
}) {
  const [tab, setTab] = useState(defaultTab)
  const TABS = [
    { id: 'geral',    label: 'Geral',            Icon: Settings      },
    { id: 'messages', label: 'Mensagens padrão', Icon: MessageSquare  },
    { id: 'flow',     label: 'Fluxo vinculado',  Icon: GitBranch      },
  ]

  const st = STATUS_CONFIG[bot.status]

  return (
    <>
      <div className="-mt-1 mb-5">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text mb-4 px-1">
          <ChevronLeft size={14} /> Voltar para todos os bots
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <BotAvatar bot={bot} size={56} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] font-semibold tracking-tight text-text leading-tight">{bot.name}</h1>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              <div className="text-[12.5px] text-text-muted mt-0.5">
                {bot.username ? `@${bot.username} · ` : ''}{bot.telegramId ? `ID ${bot.telegramId} · ` : ''}Adicionado {fmtDate(bot.addedAt)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {bot.username && (
              <a href={`https://t.me/${bot.username}`} target="_blank" rel="noreferrer">
                <Btn variant="secondary"><ExternalLink size={13} /> Ver no Telegram</Btn>
              </a>
            )}
            {bot.status === 'online'  && <Btn variant="secondary" onClick={() => onUpdate({ status: 'paused' })}><Pause size={13} /> Pausar</Btn>}
            {bot.status === 'paused'  && <Btn variant="primary"   onClick={() => onUpdate({ status: 'online' })}><Play  size={13} /> Retomar</Btn>}
            {bot.status === 'offline' && <RegisterWebhookButton botId={bot.id} size="md" onSuccess={url => onStateUpdate({ webhookUrl: url, status: 'online' })} />}
          </div>
        </div>
      </div>

      <div className="mb-5"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>

      {tab === 'geral'    && <GeneralTab  bot={bot} onUpdate={onUpdate} onStateUpdate={onStateUpdate} onDelete={onDelete} />}
      {tab === 'messages' && <MessagesTab bot={bot} onUpdate={onUpdate} />}
      {tab === 'flow'     && <FlowTab     bot={bot} flows={flows} onUpdate={onUpdate} />}
    </>
  )
}
