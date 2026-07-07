'use client'

import React, { useState, useEffect } from 'react'
import { TriangleAlert, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useDashboard } from '@/providers/DashboardProvider'
import {
  updateBotAction,
  deleteBotAction,
  setBotStatusAction,
} from '@/app/actions/bots'
import { RawBotRow, BotData, FlowData, mapRaw } from './_components/types'
import { BotsList } from './_components/BotsList'
import { AddBotModal } from './_components/AddBotModal'
import { BotConfig } from './_components/BotConfig'

// Re-exporta os tipos usados pelo Server Component (page.tsx)
export type { RawBotRow, FlowData } from './_components/types'

// ─── BotsClient ────────────────────────────────────────────────────────────────

export default function BotsClient({ initialBots, flows, userId }: {
  initialBots: RawBotRow[]
  flows: FlowData[]
  userId: string
}) {
  const [bots, setBots]       = useState<BotData[]>(() => initialBots.map(mapRaw))
  const [selectedId, setSelected] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState('geral')
  const [addOpen, setAddOpen] = useState(false)
  const [toast, setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const { refreshBotsCount }  = useDashboard()

  // Supabase Realtime — sincroniza status dos bots (ex: cron detecta disconnect)
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel('bots-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bots', filter: `user_id=eq.${userId}` },
        (payload) => {
          setBots(prev => prev.map(b =>
            b.id === (payload.new as RawBotRow).id ? { ...b, ...mapRaw(payload.new as RawBotRow) } : b
          ))
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const selected = bots.find(b => b.id === selectedId)

  function openBot(id: string, tab = 'geral') {
    setSelectedTab(tab)
    setSelected(id)
  }

  // Atualiza estado local SEM chamar o banco (para pós-server-action external)
  function setBotState(id: string, patch: Partial<BotData>) {
    setBots(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b))
  }

  // Atualiza local + banco com rollback em caso de erro
  async function updateBot(patch: Partial<BotData>) {
    if (!selectedId) return
    const snapshot = bots.slice()
    setBotState(selectedId, patch) // optimistic
    try {
      // Status (pause/resume) usa Server Action dedicada — não vai em updateBotAction
      if (patch.status === 'paused' || patch.status === 'online') {
        await setBotStatusAction(selectedId, patch.status)
      }

      const dbPatch: Parameters<typeof updateBotAction>[1] = {}
      if (patch.name             !== undefined) dbPatch.name             = patch.name
      if (patch.description      !== undefined) dbPatch.description      = patch.description
      if (patch.welcomeMessage   !== undefined) dbPatch.welcome_message  = patch.welcomeMessage
      if (patch.fallbackMessage  !== undefined) dbPatch.fallback_message = patch.fallbackMessage
      if (patch.activeFlowId     !== undefined) dbPatch.active_flow_id   = patch.activeFlowId

      if (Object.keys(dbPatch).length > 0) {
        await updateBotAction(selectedId, dbPatch)
      }
      setToast({ msg: 'Alterações salvas.', type: 'success' })
    } catch (e) {
      setBots(snapshot) // rollback
      setToast({ msg: e instanceof Error ? e.message : 'Erro ao salvar.', type: 'error' })
    }
  }

  async function deleteBot(id: string) {
    const snapshot = bots.slice()
    setBots(arr => arr.filter(b => b.id !== id))
    setSelected(null)
    try {
      await deleteBotAction(id)
      refreshBotsCount()
      setToast({ msg: 'Bot removido.', type: 'success' })
    } catch (e) {
      setBots(snapshot)
      setSelected(id)
      setToast({ msg: e instanceof Error ? e.message : 'Erro ao remover bot.', type: 'error' })
    }
  }

  function handleBotAdded(bot: BotData) {
    setBots(arr => [bot, ...arr])
    refreshBotsCount()
    setToast({ msg: `Bot ${bot.username ? `@${bot.username}` : bot.name} conectado com sucesso.`, type: 'success' })
  }

  return (
    <>
      {toast && (
        <div className={`mb-3 flex items-center gap-2.5 border rounded-lg px-3.5 py-2 ${
          toast.type === 'error'
            ? 'bg-danger-soft border-danger/30'
            : 'bg-surface border-border'
        }`} style={{ boxShadow: 'var(--shadow-md)' }}>
          {toast.type === 'error'
            ? <TriangleAlert size={15} className="text-danger" />
            : <CheckCircle2  size={15} className="text-success" />}
          <div className="text-[12.5px] text-text">{toast.msg}</div>
        </div>
      )}

      {selected ? (
        <BotConfig
          bot={selected}
          flows={flows}
          defaultTab={selectedTab}
          onBack={() => setSelected(null)}
          onUpdate={updateBot}
          onStateUpdate={(patch) => setBotState(selected.id, patch)}
          onDelete={deleteBot}
        />
      ) : (
        <BotsList
          bots={bots}
          flows={flows}
          onOpen={id => openBot(id)}
          onOpenTab={openBot}
          onAddClick={() => setAddOpen(true)}
        />
      )}

      <AddBotModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        flows={flows}
        onAdded={handleBotAdded}
      />
    </>
  )
}
