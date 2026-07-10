'use client'
import { useState, useEffect, useCallback } from 'react'
import { Copy, Trash2, AlertCircle, CheckCircle2, FolderOpen, X, Send, Loader2, RefreshCw, Plus, Radio } from 'lucide-react'
import { nodeTypes } from '../../_shared/nodeTypes'
import { isSafeUrl } from '../../_shared/constants'
import { testRemarketingSendAction, listBotChannelsAction, connectBotChannelAction } from '@/app/actions/flows'
import type { FlowNodeType, FlowNodeStatsRow, GalleryItem, BotChannel } from '../../_shared/types'
import MediaLibraryModal from '../MediaLibraryModal'

interface Props {
  node: FlowNodeType
  stats: FlowNodeStatsRow | null
  botId: string | null
  onChange: (updated: FlowNodeType) => void
  onDelete: () => void
  onDuplicate: () => void
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>
      )}
    </div>
  )
}

const inputCls = 'w-full rounded-lg px-3 py-1.5 text-sm outline-none transition-colors'
const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
}

function UrlInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const trimmed = (value ?? '').trim()
  const isEmpty = trimmed.length === 0
  const isValid = !isEmpty && isSafeUrl(trimmed)
  const hasError = !isEmpty && !isValid

  return (
    <div>
      <div className="relative">
        <input
          className={inputCls}
          style={{
            ...inputStyle,
            paddingRight: 30,
            border: hasError
              ? '1px solid var(--danger)'
              : isValid
              ? '1px solid color-mix(in oklab, var(--success) 60%, var(--border))'
              : '1px solid var(--border)',
          }}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode="url"
        />
        {isValid && (
          <CheckCircle2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--success)' }} />
        )}
        {hasError && (
          <AlertCircle size={14} className="absolute right-2 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--danger)' }} />
        )}
      </div>
      {hasError && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--danger)' }}>
          URL inválida. Use http(s):// e evite endereços privados (localhost, 10.x, etc.).
        </p>
      )}
    </div>
  )
}

function MediaField({
  urlLabel, urlHint, placeholder, fileId, url, onUrl, onClearFile, onOpenLibrary,
}: {
  urlLabel: string
  urlHint: string
  placeholder: string
  fileId: string
  url: string
  onUrl: (v: string) => void
  onClearFile: () => void
  onOpenLibrary: () => void
}) {
  return (
    <Field label={urlLabel} hint={fileId ? undefined : urlHint}>
      {fileId ? (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: 'var(--success-soft)', border: '1px solid color-mix(in oklab, var(--success) 40%, var(--border))' }}>
          <FolderOpen size={14} style={{ color: 'var(--success)' }} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>Mídia da biblioteca</div>
            <div className="text-[10px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>{fileId.slice(0, 24)}…</div>
          </div>
          <button onClick={onClearFile} title="Remover" style={{ color: 'var(--text-muted)' }}>
            <X size={13} />
          </button>
        </div>
      ) : (
        <UrlInput value={url} onChange={onUrl} placeholder={placeholder} />
      )}
      <button type="button" onClick={onOpenLibrary}
        className="mt-1.5 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors hover:bg-surface-2"
        style={{ color: 'var(--primary)', border: '1px solid var(--border)' }}>
        <FolderOpen size={12} /> {fileId ? 'Trocar pela biblioteca' : 'Escolher da biblioteca'}
      </button>
    </Field>
  )
}

// Seletor de canal/grupo onde o bot é admin (nó Entregável — modo convite).
function DeliveryChannelPicker({
  botId, value, onChange,
}: {
  botId: string | null
  value: string
  onChange: (chatId: string) => void
}) {
  const [channels, setChannels] = useState<BotChannel[]>([])
  const [loading, setLoading] = useState(false)
  const [manualRef, setManualRef] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!botId) return
    setLoading(true)
    try {
      const res = await listBotChannelsAction(botId)
      if (res.ok) setChannels(res.channels)
    } finally {
      setLoading(false)
    }
  }, [botId])

  useEffect(() => { void load() }, [load])

  const selected = channels.find(c => c.chatId === value)

  async function handleConnect() {
    if (!manualRef.trim() || connecting) return
    setConnecting(true)
    setMsg(null)
    try {
      const res = await connectBotChannelAction(botId, manualRef)
      if (res.ok && res.channel) {
        setChannels(prev => {
          const others = prev.filter(c => c.chatId !== res.channel!.chatId)
          return [res.channel!, ...others]
        })
        onChange(res.channel.chatId)
        setManualRef('')
        setMsg({ ok: true, text: `Canal "${res.channel.title}" conectado!` })
      } else {
        setMsg({ ok: false, text: res.error ?? 'Não consegui conectar o canal.' })
      }
    } finally {
      setConnecting(false)
    }
  }

  if (!botId) {
    return (
      <Field label="Canal do Telegram">
        <p className="text-[11px] rounded-lg px-3 py-2" style={{ background: 'var(--warning-soft)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          Vincule um bot ao fluxo (no topo do editor) para escolher o canal.
        </p>
      </Field>
    )
  }

  return (
    <Field label="Canal do Telegram" hint="O bot precisa ser admin do canal com permissão de convidar. A cada venda ele gera um convite de uso único.">
      {/* Lista de canais conectados */}
      <div className="flex items-center gap-1.5">
        <select className={inputCls} style={inputStyle}
          value={value}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">{loading ? 'Carregando canais…' : channels.length ? 'Selecione um canal…' : 'Nenhum canal conectado ainda'}</option>
          {channels.map(c => (
            <option key={c.chatId} value={c.chatId}>
              {c.title}{c.username ? ` (@${c.username})` : ''}{c.canInvite ? '' : ' — sem permissão de convidar'}
            </option>
          ))}
          {value && !selected && <option value={value}>Canal {value}</option>}
        </select>
        <button type="button" onClick={() => void load()} title="Atualizar lista"
          className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
          style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {selected && !selected.canInvite && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--danger)' }}>
          Este canal está sem a permissão “Convidar usuários via link”. Ative-a nas permissões do bot no canal.
        </p>
      )}

      {/* Conectar manualmente */}
      <div className="mt-2 rounded-lg p-2" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)' }}>
        <div className="flex items-center gap-1.5 mb-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <Radio size={11} /> Não apareceu? Adicione o bot como admin no canal — ele aparece sozinho. Ou conecte na mão:
        </div>
        <div className="flex items-center gap-1.5">
          <input className={inputCls} style={inputStyle}
            value={manualRef}
            onChange={e => setManualRef(e.target.value)}
            placeholder="@meucanal  ou  -1001234567890"
          />
          <button type="button" onClick={handleConnect} disabled={connecting || !manualRef.trim()}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--primary)', color: 'var(--primary-fg, #fff)' }}>
            {connecting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Conectar
          </button>
        </div>
        {msg && (
          <p className="text-[10px] mt-1.5" style={{ color: msg.ok ? 'var(--success)' : 'var(--danger)' }}>
            {msg.text}
          </p>
        )}
      </div>
    </Field>
  )
}

export default function Inspector({ node, stats, botId, onChange, onDelete, onDuplicate }: Props) {
  const t = nodeTypes[node.type]
  const [libOpen, setLibOpen] = useState(false)
  const [libGalleryIndex, setLibGalleryIndex] = useState<number | null>(null)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (patch: Partial<typeof node.data>) =>
    onChange({ ...node, data: { ...node.data, ...patch } })

  // ── Galeria (álbum de mídias) ──
  const gItems: GalleryItem[] = node.data.galleryItems ?? []
  const setGItems = (items: GalleryItem[]) => set({ galleryItems: items })
  const addGItem = () => { if (gItems.length < 10) setGItems([...gItems, { kind: 'image', url: '', fileId: '' }]) }
  const updateGItem = (i: number, patch: Partial<GalleryItem>) => setGItems(gItems.map((g, idx) => idx === i ? { ...g, ...patch } : g))
  const removeGItem = (i: number) => setGItems(gItems.filter((_, idx) => idx !== i))

  async function runRemarketingTest() {
    setTesting(true); setTestMsg(null)
    try {
      const r = await testRemarketingSendAction(botId, {
        text:        node.data.text,
        mediaKind:   node.data.mediaKind,
        mediaUrl:    node.data.mediaUrl,
        mediaFileId: node.data.mediaFileId,
      })
      setTestMsg(r.ok
        ? { ok: true,  text: '✅ Enviado! Confira no seu Telegram.' }
        : { ok: false, text: r.error ?? 'Falhou ao enviar.' })
    } catch {
      setTestMsg({ ok: false, text: 'Erro inesperado ao testar.' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border)' }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {t?.label ?? node.type}
          </p>
          <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
            ID: {node.id.slice(0, 12)}…
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onDuplicate}
            className="text-xs px-2 py-1 rounded-lg hover:bg-surface-2 transition-colors flex items-center gap-1"
            style={{ color: 'var(--text-muted)' }}
            title="Duplicar (D)"
          >
            <Copy size={12} />
          </button>
          <button
            onClick={onDelete}
            className="text-xs px-2 py-1 rounded-lg hover:bg-surface-2 transition-colors flex items-center gap-1"
            style={{ color: 'var(--danger)' }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Mini-stats (30d) */}
      {stats && (stats.sent > 0 || stats.entered > 0 || stats.failed > 0) && (
        <div className="px-4 py-2 border-b grid grid-cols-3 gap-2 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          <div>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Enviados</p>
            <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{stats.sent}</p>
          </div>
          <div>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Concluíram</p>
            <p className="text-xs font-semibold" style={{ color: 'var(--success)' }}>{stats.completed}</p>
          </div>
          <div>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Falhas</p>
            <p className="text-xs font-semibold" style={{ color: stats.failed > 0 ? 'var(--danger)' : 'var(--text)' }}>
              {stats.failed}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {/* Message */}
        {node.type === 'message' && (
          <Field label="Mensagem" hint="Suporta {nome}, {email}, {bot}, {data}">
            <textarea
              className={inputCls}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
              value={node.data.text ?? ''}
              onChange={e => set({ text: e.target.value })}
              placeholder="Digite a mensagem..."
            />
          </Field>
        )}

        {/* Question */}
        {node.type === 'question' && (
          <>
            <Field label="Pergunta">
              <textarea
                className={inputCls}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
                value={node.data.text ?? node.data.question ?? ''}
                onChange={e => set({ text: e.target.value, question: e.target.value })}
                placeholder="Qual o seu nome?"
              />
            </Field>
            <Field label="Salvar resposta em variável">
              <input
                className={inputCls}
                style={inputStyle}
                value={node.data.variable ?? ''}
                onChange={e => set({ variable: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                placeholder="nome"
              />
            </Field>
          </>
        )}

        {/* Buttons */}
        {node.type === 'buttons' && (
          <>
            <Field label="Texto da mensagem">
              <textarea
                className={inputCls}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
                value={node.data.text ?? ''}
                onChange={e => set({ text: e.target.value })}
                placeholder="Escolha uma opção:"
              />
            </Field>
            <Field label="Opções (uma por linha — máx 6)">
              <textarea
                className={inputCls}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                value={(node.data.options ?? []).join('\n')}
                onChange={e => {
                  const opts = e.target.value.split('\n').filter(Boolean).slice(0, 6)
                  set({ options: opts })
                }}
                placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
              />
            </Field>
          </>
        )}

        {/* Condition */}
        {node.type === 'condition' && (
          <>
            <Field label="Variável" hint="Nome da variável a comparar (ex: nome)">
              <input className={inputCls} style={inputStyle}
                value={node.data.variable ?? ''}
                onChange={e => set({ variable: e.target.value })}
                placeholder="nome"
              />
            </Field>
            <Field label="Operador">
              <select className={inputCls} style={inputStyle}
                value={node.data.operator ?? 'equals'}
                onChange={e => set({ operator: e.target.value })}
              >
                <option value="equals">é igual a</option>
                <option value="not_equals">é diferente de</option>
                <option value="contains">contém</option>
                <option value="starts_with">começa com</option>
                <option value="ends_with">termina com</option>
                <option value="not_empty">não está vazio</option>
                <option value="empty">está vazio</option>
                <option value="gt">maior que (número)</option>
                <option value="lt">menor que (número)</option>
              </select>
            </Field>
            {!['not_empty', 'empty'].includes(node.data.operator ?? '') && (
              <Field label="Valor">
                <input className={inputCls} style={inputStyle}
                  value={node.data.value ?? ''}
                  onChange={e => set({ value: e.target.value })}
                  placeholder="valor"
                />
              </Field>
            )}
          </>
        )}

        {/* Delay */}
        {node.type === 'delay' && (
          <>
            <Field label="Quantidade">
              <input type="number" min={1} className={inputCls} style={inputStyle}
                value={node.data.amount ?? 1}
                onChange={e => set({ amount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Unidade" hint="O contato recebe a mensagem do próximo nó após este intervalo. Processado pelo cron a cada 1 hora.">
              <select className={inputCls} style={inputStyle}
                value={node.data.unit ?? 'minutos'}
                onChange={e => set({ unit: e.target.value })}
              >
                <option value="minutos">Minutos</option>
                <option value="horas">Horas</option>
                <option value="dias">Dias</option>
              </select>
            </Field>
          </>
        )}

        {/* Offer */}
        {node.type === 'offer' && (
          <>
            <Field label="Nome do produto">
              <input className={inputCls} style={inputStyle}
                value={node.data.product ?? ''}
                onChange={e => set({ product: e.target.value })}
                placeholder="Meu Produto"
              />
            </Field>
            <Field label="Preço (R$)">
              <input type="number" min={0} step={0.01} className={inputCls} style={inputStyle}
                value={node.data.price ?? 0}
                onChange={e => set({ price: Number(e.target.value) })}
              />
            </Field>
            <Field label="Texto do botão">
              <input className={inputCls} style={inputStyle}
                value={node.data.cta ?? ''}
                onChange={e => set({ cta: e.target.value })}
                placeholder="Comprar agora"
              />
            </Field>
          </>
        )}

        {/* Tag */}
        {node.type === 'tag' && (
          <>
            <Field label="Ação">
              <select className={inputCls} style={inputStyle}
                value={node.data.action ?? 'add'}
                onChange={e => set({ action: e.target.value })}
              >
                <option value="add">Adicionar tag</option>
                <option value="remove">Remover tag</option>
              </select>
            </Field>
            <Field label="Tag">
              <input className={inputCls} style={inputStyle}
                value={node.data.tag ?? ''}
                onChange={e => set({ tag: e.target.value })}
                placeholder="lead"
              />
            </Field>
          </>
        )}

        {/* Handoff */}
        {node.type === 'handoff' && (
          <Field label="Time / Atendente" hint="O atendimento via humano ainda não está disponível. Este nó marca o fluxo como concluído.">
            <input className={inputCls} style={inputStyle}
              value={node.data.team ?? ''}
              onChange={e => set({ team: e.target.value })}
              placeholder="Suporte"
            />
          </Field>
        )}

        {/* Image */}
        {node.type === 'image' && (
          <>
            <MediaField
              urlLabel="URL da imagem"
              urlHint="Use HTTPS. Domínios privados são bloqueados."
              placeholder="https://..."
              fileId={(node.data.fileId as string) ?? ''}
              url={(node.data.imageUrl as string) ?? ''}
              onUrl={v => set({ imageUrl: v })}
              onClearFile={() => set({ fileId: '' })}
              onOpenLibrary={() => setLibOpen(true)}
            />
            <Field label="Legenda (opcional)">
              <input className={inputCls} style={inputStyle}
                value={node.data.caption ?? ''}
                onChange={e => set({ caption: e.target.value })}
              />
            </Field>
          </>
        )}

        {/* Video */}
        {node.type === 'video' && (
          <>
            <MediaField
              urlLabel="URL do vídeo"
              urlHint="MP4 público. Use HTTPS."
              placeholder="https://..."
              fileId={(node.data.fileId as string) ?? ''}
              url={(node.data.videoUrl as string) ?? ''}
              onUrl={v => set({ videoUrl: v })}
              onClearFile={() => set({ fileId: '' })}
              onOpenLibrary={() => setLibOpen(true)}
            />
            <Field label="Legenda (opcional)">
              <input className={inputCls} style={inputStyle}
                value={node.data.caption ?? ''}
                onChange={e => set({ caption: e.target.value })}
              />
            </Field>
          </>
        )}

        {/* Galeria (álbum) */}
        {node.type === 'gallery' && (
          <>
            <Field label={`Mídias do álbum (${gItems.length}/10)`} hint="Envia todas de uma vez. 2 a 10 imagens/vídeos.">
              <div className="space-y-2">
                {gItems.map((it, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <select value={it.kind}
                      onChange={e => updateGItem(i, { kind: e.target.value as GalleryItem['kind'] })}
                      className="rounded-lg px-2 py-1.5 text-xs outline-none shrink-0"
                      style={{ ...inputStyle, width: 84 }}>
                      <option value="image">Imagem</option>
                      <option value="video">Vídeo</option>
                    </select>
                    {it.fileId ? (
                      <div className="flex-1 min-w-0 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px]"
                        style={{ background: 'var(--success-soft)', border: '1px solid color-mix(in oklab, var(--success) 40%, var(--border))' }}>
                        <FolderOpen size={12} style={{ color: 'var(--success)' }} />
                        <span className="truncate font-mono" style={{ color: 'var(--text-muted)' }}>{it.fileId.slice(0, 12)}…</span>
                        <button onClick={() => updateGItem(i, { fileId: '' })} className="ml-auto" style={{ color: 'var(--text-muted)' }}><X size={12} /></button>
                      </div>
                    ) : (
                      <input className={`${inputCls} flex-1 min-w-0`} style={inputStyle}
                        value={it.url ?? ''} onChange={e => updateGItem(i, { url: e.target.value })}
                        placeholder="https://…" inputMode="url" />
                    )}
                    <button onClick={() => { setLibGalleryIndex(i); setLibOpen(true) }} title="Escolher da biblioteca"
                      className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0 hover:bg-surface-2"
                      style={{ color: 'var(--primary)', border: '1px solid var(--border)' }}>
                      <FolderOpen size={13} />
                    </button>
                    <button onClick={() => removeGItem(i)} title="Remover"
                      className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0 hover:bg-surface-2"
                      style={{ color: 'var(--text-muted)' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {gItems.length < 10 && (
                  <button onClick={addGItem}
                    className="w-full h-9 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg border border-dashed transition-colors hover:bg-surface-2"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    + Adicionar mídia
                  </button>
                )}
                {gItems.length < 2 && (
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Dica: com 2+ mídias vira um álbum. Com 1 só, envia normal.
                  </p>
                )}
              </div>
            </Field>
            <Field label="Legenda (opcional)" hint="Aparece na primeira mídia do álbum.">
              <input className={inputCls} style={inputStyle}
                value={node.data.caption ?? ''}
                onChange={e => set({ caption: e.target.value })}
              />
            </Field>
          </>
        )}

        {/* Link */}
        {node.type === 'link' && (
          <>
            <Field label="Texto do botão">
              <input className={inputCls} style={inputStyle}
                value={node.data.text ?? ''}
                onChange={e => set({ text: e.target.value })}
                placeholder="Clique aqui"
              />
            </Field>
            <Field label="URL">
              <UrlInput
                value={node.data.url ?? ''}
                onChange={v => set({ url: v })}
                placeholder="https://..."
              />
            </Field>
          </>
        )}

        {/* Checkout */}
        {node.type === 'checkout' && (
          <>
            <Field label="Texto do botão (opcional)">
              <input className={inputCls} style={inputStyle}
                value={node.data.text ?? ''}
                onChange={e => set({ text: e.target.value })}
                placeholder="Comprar agora"
              />
            </Field>
            <Field label="URL do checkout" hint="Link da página de checkout Umbra Bot ou externo.">
              <UrlInput
                value={node.data.url ?? ''}
                onChange={v => set({ url: v })}
                placeholder="https://umbrabot.com.br/c/..."
              />
            </Field>
          </>
        )}

        {/* Pix no Chat */}
        {node.type === 'pix' && (
          <>
            <Field label="Nome do plano/produto">
              <input className={inputCls} style={inputStyle}
                value={node.data.product ?? ''}
                onChange={e => set({ product: e.target.value })}
                placeholder="Aproveite O Desconto Agora ✅"
              />
            </Field>
            <Field label="Valor (R$)">
              <input type="number" min={0} step={0.01} className={inputCls} style={inputStyle}
                value={node.data.price ?? 0}
                onChange={e => set({ price: Number(e.target.value) })}
              />
            </Field>
            <Field label="CPF do pagador (fixo)" hint="Usado em todos os PIX deste nó. Só números. Precisa ser um CPF válido do Mercado Pago.">
              <input className={inputCls} style={inputStyle}
                value={node.data.cpf ?? ''}
                onChange={e => set({ cpf: e.target.value.replace(/\D/g, '').slice(0, 14) })}
                placeholder="00000000000"
                inputMode="numeric"
              />
            </Field>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Gera o PIX no chat (QR + copia-e-cola + botões). Requer o gateway Mercado Pago conectado no bot.
              O fluxo só avança quando o pagamento cai: ligue o nó <b>Entregável</b> na saída <b>✅ Pago</b>
              e (opcional) uma mensagem de follow-up na saída <b>❌ Não pago</b>.
            </p>
          </>
        )}

        {/* Entregável */}
        {node.type === 'delivery' && (
          <>
            <Field label="Mensagem de entrega" hint="Suporta {nome}, {email}, {bot}, {data}">
              <textarea
                className={inputCls}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }}
                value={node.data.message ?? ''}
                onChange={e => set({ message: e.target.value })}
                placeholder="🎉 Pagamento confirmado! Aqui está o seu acesso:"
              />
            </Field>
            <Field label="Forma de entrega">
              <select className={inputCls} style={inputStyle}
                value={(node.data.mode as string) ?? 'link'}
                onChange={e => set({ mode: e.target.value as 'link' | 'invite' })}
              >
                <option value="link">Link fixo (grupo, canal, área de membros…)</option>
                <option value="invite">Convite único do Telegram (por venda)</option>
              </select>
            </Field>
            {((node.data.mode as string) ?? 'link') === 'link' ? (
              <Field label="Link de acesso" hint="Enviado só para quem pagou. Ex.: convite do grupo, área de membros, Drive.">
                <UrlInput
                  value={node.data.url ?? ''}
                  onChange={v => set({ url: v })}
                  placeholder="https://t.me/+abc123 ou https://..."
                />
              </Field>
            ) : (
              <DeliveryChannelPicker
                botId={botId}
                value={node.data.chatRef ?? ''}
                onChange={v => set({ chatRef: v })}
              />
            )}
            <Field label="Texto do botão">
              <input className={inputCls} style={inputStyle}
                value={node.data.buttonText ?? ''}
                onChange={e => set({ buttonText: e.target.value })}
                placeholder="🔓 Acessar agora"
              />
            </Field>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Conecte este nó na saída <b>✅ Pago</b> do Pix. Ele só é executado após o pagamento
              ser confirmado (webhook do Mercado Pago ou clique em “Verificar Status”), e entrega uma única vez.
              No modo <b>convite único</b>, o bot gera um link de uso único a cada venda.
            </p>
          </>
        )}

        {/* Phone */}
        {node.type === 'phone' && (
          <>
            <Field label="Texto da solicitação">
              <input className={inputCls} style={inputStyle}
                value={(node.data.text as string) ?? ''}
                onChange={e => set({ text: e.target.value })}
                placeholder="Por favor, compartilhe seu telefone"
              />
            </Field>
            <Field label="Salvar em variável">
              <input className={inputCls} style={inputStyle}
                value={node.data.variable ?? 'telefone'}
                onChange={e => set({ variable: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
              />
            </Field>
          </>
        )}

        {/* Upsell / Downsell */}
        {(node.type === 'upsell' || node.type === 'downsell') && (
          <>
            <Field label="Nome do produto">
              <input className={inputCls} style={inputStyle}
                value={node.data.product ?? ''}
                onChange={e => set({ product: e.target.value })}
              />
            </Field>
            <Field label="Preço com desconto (R$)">
              <input type="number" min={0} step={0.01} className={inputCls} style={inputStyle}
                value={node.data.discountPrice ?? 0}
                onChange={e => set({ discountPrice: Number(e.target.value) })}
              />
            </Field>
            <Field label="Descrição">
              <textarea className={inputCls}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
                value={node.data.description ?? ''}
                onChange={e => set({ description: e.target.value })}
              />
            </Field>
            <Field label="Texto do botão (CTA)">
              <input className={inputCls} style={inputStyle}
                value={node.data.cta ?? ''}
                onChange={e => set({ cta: e.target.value })}
              />
            </Field>
            <Field label="URL do botão (opcional)">
              <UrlInput
                value={node.data.url ?? ''}
                onChange={v => set({ url: v })}
                placeholder="https://..."
              />
            </Field>
          </>
        )}

        {/* Order Bump */}
        {node.type === 'orderbump' && (
          <>
            <Field label="Nome do bônus">
              <input className={inputCls} style={inputStyle}
                value={node.data.product ?? ''}
                onChange={e => set({ product: e.target.value })}
              />
            </Field>
            <Field label="Preço (R$)">
              <input type="number" min={0} step={0.01} className={inputCls} style={inputStyle}
                value={node.data.price ?? 0}
                onChange={e => set({ price: Number(e.target.value) })}
              />
            </Field>
            <Field label="Descrição">
              <textarea className={inputCls}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
                value={node.data.description ?? ''}
                onChange={e => set({ description: e.target.value })}
              />
            </Field>
          </>
        )}

        {/* Remarketing */}
        {node.type === 'remarketing' && (
          <>
            <Field label="Mensagem" hint="Suporta {nome}, {email}.">
              <textarea className={inputCls}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                value={node.data.text ?? ''}
                onChange={e => set({ text: e.target.value })}
              />
            </Field>
            <Field label="Atraso" hint="O envio ocorre na próxima execução do cron. Para envio rápido, configure o cron-job.org para rodar a cada 1 min.">
              <div className="flex gap-2">
                <input type="number" min={1} className={inputCls} style={inputStyle}
                  value={node.data.delayAmount ?? 1}
                  onChange={e => set({ delayAmount: Number(e.target.value) })}
                />
                <select className={inputCls} style={inputStyle}
                  value={node.data.delayUnit ?? 'horas'}
                  onChange={e => set({ delayUnit: e.target.value })}
                >
                  <option value="minutos">Min</option>
                  <option value="horas">Horas</option>
                  <option value="dias">Dias</option>
                </select>
              </div>
            </Field>
            <Field label="Adicionar tag (opcional)">
              <input className={inputCls} style={inputStyle}
                value={node.data.tag ?? ''}
                onChange={e => set({ tag: e.target.value })}
                placeholder="seguindo"
              />
            </Field>
            <Field label="Mídia (opcional)" hint="A mensagem acima vira a legenda da mídia.">
              <select className={inputCls} style={inputStyle}
                value={node.data.mediaKind ?? 'none'}
                onChange={e => set({ mediaKind: e.target.value as 'none' | 'image' | 'video' })}
              >
                <option value="none">Nenhuma</option>
                <option value="image">Imagem</option>
                <option value="video">Vídeo</option>
              </select>
            </Field>
            {(node.data.mediaKind === 'image' || node.data.mediaKind === 'video') && (
              <MediaField
                urlLabel={node.data.mediaKind === 'image' ? 'URL da imagem' : 'URL do vídeo'}
                urlHint="Use HTTPS ou escolha da biblioteca."
                placeholder="https://..."
                fileId={(node.data.mediaFileId as string) ?? ''}
                url={(node.data.mediaUrl as string) ?? ''}
                onUrl={v => set({ mediaUrl: v })}
                onClearFile={() => set({ mediaFileId: '' })}
                onOpenLibrary={() => setLibOpen(true)}
              />
            )}

            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={runRemarketingTest}
                disabled={testing}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}
              >
                {testing
                  ? <><Loader2 size={13} className="animate-spin" /> Enviando…</>
                  : <><Send size={13} /> Testar remarketing agora</>}
              </button>
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                Envia esta mensagem agora para o seu Telegram vinculado (Notificações), sem esperar o cron.
              </p>
              {testMsg && (
                <p className="text-[10.5px] mt-1 font-medium"
                  style={{ color: testMsg.ok ? 'var(--success)' : 'var(--danger)' }}>
                  {testMsg.text}
                </p>
              )}
            </div>
          </>
        )}

        {!t && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Tipo de nó não reconhecido: {node.type}
          </p>
        )}
      </div>

      {(node.type === 'image' || node.type === 'video' || node.type === 'remarketing' || node.type === 'gallery') && (
        <MediaLibraryModal
          open={libOpen}
          onClose={() => { setLibOpen(false); setLibGalleryIndex(null) }}
          botId={botId}
          mediaType={
            node.type === 'gallery'
              ? (gItems[libGalleryIndex ?? 0]?.kind === 'video' ? 'video' : 'image')
              : node.type === 'video' ? 'video'
              : node.type === 'image' ? 'image'
              : (node.data.mediaKind === 'video' ? 'video' : 'image')
          }
          onSelect={(item) => {
            if (node.type === 'gallery' && libGalleryIndex !== null) {
              updateGItem(libGalleryIndex, { fileId: item.file_id, url: '' })
              return
            }
            if (node.type === 'remarketing') {
              set({ mediaFileId: item.file_id, mediaUrl: '' })
              return
            }
            const patch: Record<string, string> = { fileId: item.file_id }
            if (node.type === 'image') patch.imageUrl = ''
            else if (node.type === 'video') patch.videoUrl = ''
            if (!(node.data.caption ?? '') && item.caption) patch.caption = item.caption
            set(patch)
          }}
        />
      )}
    </div>
  )
}
