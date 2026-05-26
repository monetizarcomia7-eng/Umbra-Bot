'use client'
import { Copy, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { nodeTypes } from '../../_shared/nodeTypes'
import { isSafeUrl } from '../../_shared/constants'
import type { FlowNodeType, FlowNodeStatsRow } from '../../_shared/types'

interface Props {
  node: FlowNodeType
  stats: FlowNodeStatsRow | null
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

export default function Inspector({ node, stats, onChange, onDelete, onDuplicate }: Props) {
  const t = nodeTypes[node.type]
  const set = (patch: Partial<typeof node.data>) =>
    onChange({ ...node, data: { ...node.data, ...patch } })

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
            <Field label="URL da imagem" hint="Use HTTPS. Domínios privados são bloqueados.">
              <UrlInput
                value={node.data.imageUrl ?? ''}
                onChange={v => set({ imageUrl: v })}
                placeholder="https://..."
              />
            </Field>
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
            <Field label="URL do vídeo" hint="MP4 público. Use HTTPS.">
              <UrlInput
                value={node.data.videoUrl ?? ''}
                onChange={v => set({ videoUrl: v })}
                placeholder="https://..."
              />
            </Field>
            <Field label="Legenda (opcional)">
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
            <Field label="Atraso" hint="Processado pelo cron a cada hora.">
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
          </>
        )}

        {!t && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Tipo de nó não reconhecido: {node.type}
          </p>
        )}
      </div>
    </div>
  )
}
