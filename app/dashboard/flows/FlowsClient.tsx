'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { useAnalytics } from '@/hooks/use-analytics'
import type { RawFlowRow, RawBotOption, FlowMeta, FlowEditorData, FlowTemplate } from './_shared/types'
import { mapRawMeta, mapRawFull } from './_shared/mappers'
import { Toast } from './_shared/ui'
import FlowsList from './_list/FlowsList'
import TemplatesModal from './_list/TemplatesModal'
import FlowEditor from './_editor/FlowEditor'

interface Props {
  initialFlows: RawFlowRow[]
  bots: RawBotOption[]
  userId: string
}

export default function FlowsClient({ initialFlows, bots, userId }: Props) {
  const { track } = useAnalytics()
  const [flows, setFlows] = useState<FlowMeta[]>(() => initialFlows.map(mapRawMeta))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorData, setEditorData] = useState<FlowEditorData | null>(null)
  const [editorLoading, setEditorLoading] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // Realtime — sincroniza listagem entre dispositivos
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('flows-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'flows', filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as RawFlowRow
          setFlows(arr => arr.map(f => f.id === updated.id ? mapRawMeta(updated) : f))
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'flows', filter: `user_id=eq.${userId}` },
        (payload) => {
          const inserted = payload.new as RawFlowRow
          setFlows(arr => arr.some(f => f.id === inserted.id) ? arr : [mapRawMeta(inserted), ...arr])
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'flows', filter: `user_id=eq.${userId}` },
        (payload) => {
          const deleted = payload.old as { id: string }
          setFlows(arr => arr.filter(f => f.id !== deleted.id))
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Carrega nodes+edges ao abrir o editor
  useEffect(() => {
    if (!editingId) { setEditorData(null); return }
    setEditorLoading(true)
    const supabase = createClient()
    supabase
      .from('flows')
      .select('id, name, bot, bot_color, status, executions, conversion, description, updated_at, nodes, edges, trigger_type, keywords')
      .eq('id', editingId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setEditorData(mapRawFull(data as unknown as Record<string, unknown>))
        } else {
          showToast('Erro ao carregar o fluxo.', 'error')
          setEditingId(null)
        }
        setEditorLoading(false)
      })
  }, [editingId, showToast])

  async function createFlow(template?: FlowTemplate) {
    if (creating) return
    setCreating(true)
    const supabase = createClient()
    const name = template && template.id !== 'blank' ? template.name : 'Novo fluxo'
    const nodes = template?.nodes ?? []
    const edges = template?.edges ?? []

    const { data, error } = await supabase
      .from('flows')
      .insert({ user_id: userId, name, status: 'draft', description: '', nodes, edges })
      .select('id')
      .single()

    if (error || !data) {
      showToast('Erro ao criar fluxo. Tente novamente.', 'error')
      setCreating(false)
      return
    }

    const newMeta: FlowMeta = {
      id: data.id, name, bot: '', botColor: '#6366f1', status: 'draft',
      executions: 0, conversion: 0, revenue: 0, sales: 0, leads: 0,
      updatedAt: Date.now(), description: '',
    }
    setFlows(arr => [newMeta, ...arr])
    setCreating(false)
    setShowTemplates(false)
    setEditingId(data.id)
    track('flow_created', { flow_name: name })
  }

  async function duplicateFlow(id: string) {
    const supabase = createClient()

    const { data: src, error: srcErr } = await supabase
      .from('flows')
      .select('name, bot, bot_color, description, nodes, edges, trigger_type, keywords')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (srcErr || !src) { showToast('Erro ao duplicar o fluxo.', 'error'); return }

    const { data, error } = await supabase
      .from('flows')
      .insert({
        user_id: userId, name: `${src.name} (cópia)`,
        bot: src.bot, bot_color: src.bot_color,
        description: src.description, status: 'draft',
        nodes: src.nodes ?? [], edges: src.edges ?? [],
        trigger_type: (src as Record<string, unknown>).trigger_type ?? 'start',
        keywords: (src as Record<string, unknown>).keywords ?? [],
      })
      .select('id')
      .single()

    if (error || !data) { showToast('Erro ao duplicar o fluxo.', 'error'); return }

    const original = flows.find(f => f.id === id)
    const newMeta: FlowMeta = {
      id: data.id, name: `${src.name} (cópia)`,
      bot: original?.bot ?? '', botColor: original?.botColor ?? '#6366f1',
      status: 'draft', executions: 0, conversion: 0, revenue: 0, sales: 0, leads: 0,
      updatedAt: Date.now(), description: src.description ?? '',
    }
    setFlows(arr => [newMeta, ...arr])
    showToast('Fluxo duplicado com sucesso.', 'success')
  }

  async function saveFlow(updated: FlowEditorData): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase
      .from('flows')
      .update({
        name: updated.name, bot: updated.bot, bot_color: updated.botColor,
        status: updated.status, description: updated.description,
        nodes: updated.nodes, edges: updated.edges,
        trigger_type: updated.triggerType, keywords: updated.keywords,
      })
      .eq('id', updated.id)
      .eq('user_id', userId)

    if (error) { showToast('Erro ao salvar. Verifique sua conexão.', 'error'); return false }

    setFlows(arr => arr.map(f => f.id === updated.id
      ? { ...f, name: updated.name, bot: updated.bot, botColor: updated.botColor, status: updated.status, description: updated.description, updatedAt: Date.now() }
      : f
    ))
    return true
  }

  async function publishFlow(updated: FlowEditorData): Promise<void> {
    const toPublish = { ...updated, status: 'published' as const }
    const ok = await saveFlow(toPublish)
    if (!ok) return

    const supabase = createClient()
    const botEntry = bots.find(b => (b.username ? `@${b.username}` : b.name) === updated.bot)
    if (botEntry) {
      supabase.from('bots').update({ active_flow_id: updated.id }).eq('id', botEntry.id).eq('user_id', userId).then()
    }
    supabase.from('activity_events').insert({
      user_id: userId, type: 'flowPublished',
      title: 'Fluxo publicado',
      description: `Fluxo "${updated.name}" publicado com ${updated.nodes.length} nós.`,
    }).then()

    track('flow_published', { flow_name: updated.name, node_count: updated.nodes.length })
    showToast(`Fluxo "${updated.name}" publicado!`, 'success')
  }

  async function deleteFlow(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('flows').delete().eq('id', id).eq('user_id', userId)
    if (error) { showToast('Erro ao apagar o fluxo.', 'error'); return }
    setFlows(arr => arr.filter(f => f.id !== id))
    track('flow_deleted', {})
  }

  // ── Editor carregando ──────────────────────────────────────────────────────
  if (editingId && editorLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    )
  }

  // ── Editor aberto ──────────────────────────────────────────────────────────
  if (editingId && editorData) {
    return (
      <>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        <FlowEditor
          flow={editorData}
          bots={bots}
          onBack={() => setEditingId(null)}
          onSave={saveFlow}
          onPublish={publishFlow}
          showToast={showToast}
        />
      </>
    )
  }

  // ── Listagem ───────────────────────────────────────────────────────────────
  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {showTemplates && (
        <TemplatesModal
          onSelect={createFlow}
          onClose={() => setShowTemplates(false)}
        />
      )}

      <PageHeader
        title="Fluxos de venda"
        subtitle="Automatize conversas e converta leads em clientes."
        actions={
          <button
            onClick={() => setShowTemplates(true)}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--primary)', color: 'var(--accent-fg)', opacity: creating ? 0.6 : 1 }}
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : null}
            {creating ? 'Criando...' : 'Novo fluxo'}
          </button>
        }
      />

      <FlowsList
        flows={flows}
        onCreate={() => createFlow()}
        onOpenTemplates={() => setShowTemplates(true)}
        onOpen={(id) => setEditingId(id)}
        onDuplicate={duplicateFlow}
        onDelete={deleteFlow}
      />
    </>
  )
}
