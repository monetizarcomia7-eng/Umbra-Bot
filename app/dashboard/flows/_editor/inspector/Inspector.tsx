'use client'
import { nodeTypes } from '../../_shared/nodeTypes'
import type { FlowNodeType } from '../../_shared/types'

interface Props {
  node: FlowNodeType
  onChange: (updated: FlowNodeType) => void
  onDelete: () => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-lg px-3 py-1.5 text-sm outline-none transition-colors'
const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
}

export default function Inspector({ node, onChange, onDelete }: Props) {
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
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            ID: {node.id}
          </p>
        </div>
        <button
          onClick={onDelete}
          className="text-xs px-2 py-1 rounded-lg hover:bg-surface-2 transition-colors"
          style={{ color: 'var(--danger)' }}
        >
          Apagar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Message */}
        {node.type === 'message' && (
          <Field label="Mensagem">
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
                onChange={e => set({ variable: e.target.value })}
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
            <Field label="Opções (uma por linha)">
              <textarea
                className={inputCls}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                value={(node.data.options ?? []).join('\n')}
                onChange={e => set({ options: e.target.value.split('\n').filter(Boolean) })}
                placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
              />
            </Field>
          </>
        )}

        {/* Condition */}
        {node.type === 'condition' && (
          <>
            <Field label="Variável">
              <input
                className={inputCls}
                style={inputStyle}
                value={node.data.variable ?? ''}
                onChange={e => set({ variable: e.target.value })}
                placeholder="nome"
              />
            </Field>
            <Field label="Operador">
              <select
                className={inputCls}
                style={inputStyle}
                value={node.data.operator ?? 'equals'}
                onChange={e => set({ operator: e.target.value })}
              >
                <option value="equals">é igual a</option>
                <option value="contains">contém</option>
                <option value="starts_with">começa com</option>
                <option value="not_empty">não está vazio</option>
              </select>
            </Field>
            {node.data.operator !== 'not_empty' && (
              <Field label="Valor">
                <input
                  className={inputCls}
                  style={inputStyle}
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
              <input
                type="number"
                min={1}
                className={inputCls}
                style={inputStyle}
                value={node.data.amount ?? 1}
                onChange={e => set({ amount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Unidade">
              <select
                className={inputCls}
                style={inputStyle}
                value={node.data.unit ?? 'minutos'}
                onChange={e => set({ unit: e.target.value })}
              >
                <option value="segundos">Segundos</option>
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
          <Field label="Time / Atendente">
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
            <Field label="URL da imagem">
              <input className={inputCls} style={inputStyle}
                value={node.data.imageUrl ?? ''}
                onChange={e => set({ imageUrl: e.target.value })}
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
            <Field label="URL do vídeo">
              <input className={inputCls} style={inputStyle}
                value={node.data.videoUrl ?? ''}
                onChange={e => set({ videoUrl: e.target.value })}
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
              <input className={inputCls} style={inputStyle}
                value={node.data.url ?? ''}
                onChange={e => set({ url: e.target.value })}
                placeholder="https://..."
              />
            </Field>
          </>
        )}

        {/* Checkout */}
        {node.type === 'checkout' && (
          <Field label="URL do checkout">
            <input className={inputCls} style={inputStyle}
              value={node.data.url ?? ''}
              onChange={e => set({ url: e.target.value })}
              placeholder="https://..."
            />
          </Field>
        )}

        {/* Phone */}
        {node.type === 'phone' && (
          <Field label="Texto da solicitação">
            <input className={inputCls} style={inputStyle}
              value={(node.data.text as string) ?? ''}
              onChange={e => set({ text: e.target.value })}
              placeholder="Por favor, compartilhe seu telefone"
            />
          </Field>
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
          </>
        )}

        {/* Remarketing */}
        {node.type === 'remarketing' && (
          <>
            <Field label="Mensagem">
              <textarea className={inputCls}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                value={node.data.text ?? ''}
                onChange={e => set({ text: e.target.value })}
              />
            </Field>
            <Field label="Atraso">
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
