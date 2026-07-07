'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Bot, AlertCircle, Loader2, Save, Camera,
  ArrowUp, ArrowDown, Trash2, Plus,
} from 'lucide-react'
import { BotData, DEFAULT_COMMANDS } from './types'
import { Modal, Btn } from './ui'
import {
  getBotTelegramProfileAction,
  saveBotTelegramProfileAction,
  setBotPhotoAction,
} from '@/app/actions/bots'

// ─── TelegramProfileModal ─────────────────────────────────────────────────────

export function TelegramProfileModal({ bot, open, onClose }: {
  bot: BotData; open: boolean; onClose: () => void
}) {
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [name,         setName]         = useState('')
  const [desc,         setDesc]         = useState('')
  const [short,        setShort]        = useState('')
  const [cmds,         setCmds]         = useState<Array<{ command: string; description: string }>>([])
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [newPhoto,     setNewPhoto]     = useState<File | null>(null)
  const [preview,      setPreview]      = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Revoga URL de objeto ao trocar ou desmontar
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  // Carrega perfil do Telegram ao abrir
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true); setError('')
    setNewPhoto(null); setPreview(null)

    getBotTelegramProfileAction(bot.id)
      .then(p => {
        if (cancelled) return
        setName(p.name)
        setDesc(p.description)
        setShort(p.shortDescription)
        setCmds(p.commands.length > 0 ? p.commands : DEFAULT_COMMANDS)
        setPhotoDataUrl(p.photoDataUrl)
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar perfil.') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [open, bot.id])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      setError('Formato inválido. Use JPG, PNG ou GIF.'); return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Imagem muito grande. Máximo 10MB.'); return
    }
    setError('')
    setNewPhoto(file)
    setPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  async function save() {
    setSaving(true); setError('')
    let photoErr = ''
    try {
      if (newPhoto) {
        const rp = await setBotPhotoAction(bot.id, newPhoto)
        if (!rp.ok) photoErr = rp.error ?? 'Erro ao atualizar foto.'
      }
      const r = await saveBotTelegramProfileAction(bot.id, {
        name:             name.trim(),
        description:      desc,
        shortDescription: short,
        commands:         cmds.filter(c => c.command.trim() && c.description.trim()),
      })
      if (!r.ok) {
        setError(r.error ?? 'Erro ao salvar no Telegram.')
      } else if (photoErr) {
        setError('Texto salvo! Foto não atualizada: ' + photoErr)
      } else {
        onClose()
      }
    } catch {
      setError('Erro inesperado. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  function moveCmd(idx: number, dir: -1 | 1) {
    const next   = [...cmds]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setCmds(next)
  }

  function updateCmd(idx: number, field: 'command' | 'description', value: string) {
    setCmds(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c))
  }

  function removeCmd(idx: number) {
    setCmds(prev => prev.filter((_, i) => i !== idx))
  }

  const displayPhoto = preview ?? photoDataUrl

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar perfil no Telegram"
      subtitle="Alterações são aplicadas diretamente pelo Bot API do Telegram."
      size="lg"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={save} disabled={saving || loading}>
            {saving
              ? <><Loader2 size={13} className="animate-spin" /> Salvando…</>
              : <><Save size={13} /> Salvar alterações</>}
          </Btn>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2.5 text-text-muted">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Carregando perfil do Telegram…</span>
        </div>
      ) : (
        <div className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-danger-soft border border-danger/20 rounded-lg text-[12.5px] text-danger">
              <AlertCircle size={14} className="shrink-0" />{error}
            </div>
          )}

          {/* Foto de perfil */}
          <div>
            <div className="text-[12.5px] font-medium text-text mb-2">Foto de perfil</div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative w-20 h-20 rounded-xl overflow-hidden bg-surface-2 border-2 border-dashed border-border hover:border-primary transition-colors group shrink-0"
              >
                {/* eslint-disable @next/next/no-img-element */}
                {displayPhoto ? (
                  <img src={displayPhoto} alt="Foto do bot" className="w-full h-full object-cover" />
                ) : (
                  <Bot size={28} className="absolute inset-0 m-auto text-text-muted" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={18} className="text-white" />
                </div>
              </button>
              <div className="text-[11.5px] text-text-muted leading-relaxed">
                <div className="font-medium text-text text-[12.5px] mb-1">Alterar foto de perfil</div>
                Clique na imagem para selecionar. JPG, PNG ou GIF — máximo 10MB.
                {newPhoto && <div className="text-success mt-1 text-[11px]">Nova foto: {newPhoto.name}</div>}
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif" className="hidden" onChange={onFileChange} />
          </div>

          {/* @Username (somente leitura) */}
          {bot.username && (
            <div>
              <div className="text-[12.5px] font-medium text-text mb-1.5">@Username</div>
              <div className="h-10 px-3 bg-surface-2 border border-border rounded-lg text-[12.5px] font-mono text-text-muted flex items-center">
                @{bot.username}
              </div>
              <p className="text-[11px] text-text-muted mt-1">O @username só pode ser alterado pelo BotFather.</p>
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="block text-[12.5px] font-medium text-text mb-1.5">Nome do bot</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={64}
              className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            />
          </div>

          {/* Descrição */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12.5px] font-medium text-text">Descrição</label>
              <span className="text-[11px] text-text-muted">{desc.length}/512</span>
            </div>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value.slice(0, 512))}
              rows={3}
              placeholder="Descreva o que este bot faz…"
              className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
            />
          </div>

          {/* Descrição curta */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12.5px] font-medium text-text">Descrição curta</label>
              <span className="text-[11px] text-text-muted">{short.length}/120</span>
            </div>
            <textarea
              value={short}
              onChange={e => setShort(e.target.value.slice(0, 120))}
              rows={2}
              placeholder="Frase exibida na tela de início de conversa…"
              className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
            />
          </div>

          {/* Comandos */}
          <div>
            <div className="text-[12.5px] font-medium text-text mb-2">Comandos</div>
            <div className="space-y-2">
              {cmds.map((cmd, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button type="button" onClick={() => moveCmd(idx, -1)} disabled={idx === 0}
                      className="w-6 h-5 flex items-center justify-center rounded text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-25 disabled:pointer-events-none">
                      <ArrowUp size={11} />
                    </button>
                    <button type="button" onClick={() => moveCmd(idx, 1)} disabled={idx === cmds.length - 1}
                      className="w-6 h-5 flex items-center justify-center rounded text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-25 disabled:pointer-events-none">
                      <ArrowDown size={11} />
                    </button>
                  </div>
                  <span className="text-text-muted text-[13px] font-mono shrink-0">/</span>
                  <input
                    type="text"
                    value={cmd.command}
                    onChange={e => updateCmd(idx, 'command', e.target.value.replace(/[^a-z0-9_]/g, '').toLowerCase())}
                    placeholder="comando"
                    className="w-28 h-9 px-2 bg-surface border border-border rounded-lg text-[12.5px] font-mono text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 shrink-0"
                  />
                  <input
                    type="text"
                    value={cmd.description}
                    onChange={e => updateCmd(idx, 'description', e.target.value)}
                    placeholder="Descrição do comando…"
                    maxLength={256}
                    className="flex-1 h-9 px-3 bg-surface border border-border rounded-lg text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 min-w-0"
                  />
                  <button type="button" onClick={() => removeCmd(idx)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-danger-soft hover:text-danger shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button"
              onClick={() => setCmds(prev => [...prev, { command: '', description: '' }])}
              className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline">
              <Plus size={13} /> Adicionar comando
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
