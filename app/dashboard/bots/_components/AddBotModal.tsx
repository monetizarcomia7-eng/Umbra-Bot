'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Bot, Check, AlertCircle, ChevronDown, ChevronRight,
  ShieldCheck, Webhook, Loader2, ArrowLeft,
} from 'lucide-react'
import { BotData, FlowData, BOT_COLORS } from './types'
import { Modal, Btn, Dropdown } from './ui'
import {
  validateBotTokenAction,
  saveBotAction,
  registerWebhookAction,
} from '@/app/actions/bots'

// ─── AddBotModal ───────────────────────────────────────────────────────────────

export function AddBotModal({ open, onClose, flows, onAdded }: {
  open: boolean; onClose: () => void; flows: FlowData[]
  onAdded: (bot: BotData) => void
}) {
  const [step, setStep]         = useState<'token' | 'confirm' | 'success'>('token')
  const [token, setToken]       = useState('')
  const [error, setError]       = useState('')
  const [validating, setValid]  = useState(false)
  const [adding, setAdding]     = useState(false)
  const [showHelp, setHelp]     = useState(false)
  const [linkFlow, setLinkFlow] = useState('Nenhum')
  const [editedName, setName]   = useState('')
  const [foundBot, setFound]    = useState<{ username: string; firstName: string; telegramId: string } | null>(null)
  // Stable webhook preview — computed once per confirm step
  const webhookPreviewRef = useRef('')

  useEffect(() => {
    if (open) {
      setStep('token'); setToken(''); setError(''); setValid(false)
      setAdding(false); setHelp(false); setLinkFlow('Nenhum'); setName(''); setFound(null)
    }
  }, [open])

  const tokenShape = /^\d{8,12}:[A-Za-z0-9_-]{30,}$/.test(token.trim())

  async function validate() {
    setError(''); setValid(true)
    try {
      const info = await validateBotTokenAction(token.trim())
      setFound(info)
      setName(info.firstName)
      webhookPreviewRef.current = `APP_URL/api/telegram/webhook?bot_id=<uuid>`
      setStep('confirm')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao validar token.')
    } finally {
      setValid(false)
    }
  }

  async function addBot() {
    if (!foundBot) return
    setAdding(true); setError('')
    try {
      const flowId = linkFlow === 'Nenhum' ? null : (flows.find(f => f.name === linkFlow)?.id ?? null)

      // 1. Salva com token criptografado no servidor
      const { id } = await saveBotAction({
        name:          editedName.trim(),
        token:         token.trim(),
        username:      foundBot.username,
        telegramId:    foundBot.telegramId,
        activeFlowId:  flowId,
      })

      // 2. Registra webhook (best effort — pode falhar; bot fica offline até reconectar)
      let webhookUrl = ''
      let status: BotData['status'] = 'offline'
      try {
        const result = await registerWebhookAction(id)
        webhookUrl = result.webhookUrl
        status     = 'online'
      } catch (_) {
        // Bot salvo mas offline; usuário pode registrar via aba Geral
      }

      const newBot: BotData = {
        id,
        name:           editedName.trim(),
        username:       foundBot.username,
        status,
        leads: 0, sales: 0, conversion: 0, revenue: 0,
        activeFlowId:   flowId,
        color:          BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)],
        telegramId:     foundBot.telegramId,
        webhookUrl,
        welcomeMessage: 'Olá {nome}! Bem-vindo. Em que posso te ajudar?',
        fallbackMessage:'Não entendi sua mensagem. Digite /menu para ver as opções.',
        description:    '',
        lastSync:       Date.now(),
        addedAt:        Date.now(),
      }
      onAdded(newBot)
      setStep('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao conectar bot.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}
      title={step === 'success' ? null : 'Conectar novo bot'}
      subtitle={step === 'token' ? 'Cole o token gerado pelo BotFather no Telegram.' : null}
      footer={
        step === 'token' ? (
          <><Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" disabled={!tokenShape || validating} onClick={validate}>
              {validating ? <><Loader2 size={13} className="animate-spin" /> Validando…</> : 'Validar token'}
            </Btn></>
        ) : step === 'confirm' ? (
          <><Btn variant="secondary" onClick={() => setStep('token')}><ArrowLeft size={14} /> Voltar</Btn>
            <Btn variant="primary" onClick={addBot} disabled={adding || !editedName.trim()}>
              {adding ? <><Loader2 size={13} className="animate-spin" /> Conectando…</> : 'Adicionar bot'}
            </Btn></>
        ) : (
          <Btn variant="primary" onClick={onClose}>Concluir</Btn>
        )
      }
    >
      {step === 'token' && (
        <div className="space-y-3.5">
          <div>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">Token do bot</label>
            <input type="text" value={token} onChange={e => setToken(e.target.value)}
              placeholder="7234567890:ABCdefGHIjklMNOpqrSTU..." autoFocus
              className={`w-full h-11 px-3 bg-surface border rounded-lg text-[12.5px] font-mono text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 ${error ? 'border-danger focus:ring-danger/25' : 'border-border focus:ring-primary/30 focus:border-primary/50'}`}
            />
            {error && <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-danger"><AlertCircle size={12} />{error}</p>}
          </div>

          <button type="button" onClick={() => setHelp(s => !s)} className="text-[12px] text-primary hover:underline inline-flex items-center gap-1">
            {showHelp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Como obter o token do BotFather?
          </button>

          {showHelp && (
            <div className="bg-surface-2/50 border border-border rounded-lg p-3.5 text-[12px] text-text-muted leading-relaxed">
              <ol className="space-y-2 list-decimal list-inside marker:text-text-subtle">
                <li>Abra o <strong className="text-text">@BotFather</strong> no Telegram.</li>
                <li>Envie <code className="bg-surface-3 px-1 rounded font-mono text-[11px]">/newbot</code> e siga as instruções.</li>
                <li>Copie o token completo (ex: <code className="bg-surface-3 px-1 rounded font-mono text-[11px]">12345:ABCDEF...</code>) e cole acima.</li>
                <li>O Umbra Bot configura o webhook automaticamente.</li>
              </ol>
            </div>
          )}

          <div className="flex items-start gap-2 bg-surface-2/40 border border-border rounded-lg p-3 text-[11.5px] text-text-muted">
            <ShieldCheck size={14} className="text-success mt-0.5 shrink-0" />
            <span>Seu token é armazenado criptografado com AES-256-GCM. Pode ser revogado a qualquer momento pelo BotFather.</span>
          </div>
        </div>
      )}

      {step === 'confirm' && foundBot && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 bg-success-soft border border-success/30 rounded-lg">
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0"><Bot size={20} /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-success flex items-center gap-1">
                <Check size={11} /> Bot encontrado
              </div>
              <div className="text-[13.5px] font-semibold text-text mt-0.5">{foundBot.firstName}</div>
              <div className="text-[11.5px] text-text-muted">
                {foundBot.username ? `@${foundBot.username}` : 'Sem @username'} · ID {foundBot.telegramId}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">Nome no Umbra Bot</label>
            <input type="text" value={editedName} onChange={e => setName(e.target.value)}
              className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
            <p className="text-[11px] text-text-muted mt-1">Usado apenas internamente — não altera o nome no Telegram.</p>
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">Vincular a um fluxo (opcional)</label>
            {flows.length > 0 ? (
              <Dropdown label="Fluxo" value={linkFlow} options={['Nenhum', ...flows.map(f => f.name)]} onChange={setLinkFlow} />
            ) : (
              <p className="text-[12px] text-text-muted">Nenhum fluxo criado ainda. Você pode vincular depois em Fluxos de venda.</p>
            )}
          </div>

          <div className="bg-surface-2/40 border border-border rounded-lg p-3.5">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-text">
              <Webhook size={13} className="text-success" /> Webhook configurado automaticamente
            </div>
            <p className="text-[11px] text-text-muted mt-1 font-mono">APP_URL/api/telegram/webhook?bot_id=&lt;uuid&gt;</p>
          </div>

          {error && <p className="flex items-center gap-1.5 text-[12px] text-danger"><AlertCircle size={13} />{error}</p>}
        </div>
      )}

      {step === 'success' && foundBot && (
        <div className="text-center py-6">
          <div className="relative w-14 h-14 mx-auto rounded-full bg-success-soft text-success flex items-center justify-center mb-4">
            <Check size={26} />
            <span className="absolute inset-0 rounded-full border border-success/40 animate-ping opacity-50" />
          </div>
          <h3 className="text-[16px] font-semibold text-text">Bot conectado!</h3>
          <p className="text-[12.5px] text-text-muted mt-1.5">
            <span className="text-text font-medium">{foundBot.username ? `@${foundBot.username}` : foundBot.firstName}</span> está pronto para receber mensagens.
          </p>
        </div>
      )}
    </Modal>
  )
}
