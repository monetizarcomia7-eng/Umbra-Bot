'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { useAnalytics } from '@/hooks/use-analytics'
import {
  createFlowAction,
  duplicateFlowAction,
  deleteFlowAction,
  saveFlowAction,
  publishFlowAction,
} from '@/app/actions/flows'
import type { RawFlowRow, RawBotOption, FlowMeta, FlowEditorData, FlowTemplate } from './_shared/types'
import { mapRawMeta, mapRawFull } from './_shared/mappers'
import { Toast } from './_shared/ui'
import { TOAST_MS } from './_shared/constants'
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
    setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  // Realtime — sincroniza listagem entre dispositivos
  // FIX 1.1: preserva revenue/sales/leads (não estão na row do banco, vêm da RPC)
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('flows-realtime')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'flows', filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as RawFlowRow
          setFlows(arr => arr.map(f => {
            if (f.id !== updated.id) return f
            const mapped = mapRawMeta(updated)
            return { ...mapped, revenue: f.revenue, sales: f.sales, leads: f.leads }
          }))
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'flows', filter: `user_id=eq.${userId}` },
        (payload) => {
          const inserted = payload.new as RawFlowRow
          setFlows(arr => arr.some(f => f.id === inserted.id) ? arr : [mapRawMeta(inserted), ...arr])
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'flows', filter: `user_id=eq.${userId}` },
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
      .select('id, name, bot, bot_id, bot_color, status, executions, conversion, description, updated_at, nodes, edges, trigger_type, keywords')
      .eq('id', editingId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          // Preserve stats already known
          const existing = flows.find(f => f.id === editingId)
          const full = mapRawFull(data as unknown as Record<string, unknown>)
          if (existing) {
            full.revenue = existing.revenue
            full.sales = existing.sales
            full.leads = existing.leads
          }
          setEditorData(full)
        } else {
          showToast('Erro ao carregar o fluxo.', 'error')
          setEditingId(null)
        }
        setEditorLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  // ─── createFlow ─────────────────────────────────────────────────────────────
  async function createFlow(template?: FlowTemplate) {
    if (creating) return
    setCreating(true)
    try {
      const name = template && template.id !== 'blank' ? template.name : 'Novo fluxo'
      const { id } = await createFlowAction({
        name,
        description: '',
        nodes: (template?.nodes ?? []).map(n => ({
          id: n.id, type: n.type, position: n.position,
          data: n.data as unknown as Record<string, unknown>,
        })),
        edges: template?.edges ?? [],
      })

      const newMeta: FlowMeta = {
        id, name, bot: '', botId: null, botColor: '#6366f1', status: 'draft',
        executions: 0, conversion: 0, revenue: 0, sales: 0, leads: 0,
        updatedAt: Date.now(), description: '',
      }
      setFlows(arr => [newMeta, ...arr])
      setShowTemplates(false)
      setEditingId(id)
      track('flow_created', { flow_name: name })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar fluxo.', 'error')
    } finally {
      setCreating(false)
    }
  }

  // ─── duplicateFlow ──────────────────────────────────────────────────────────
  async function duplicateFlow(id: string) {
    try {
      const { id: newId } = await duplicateFlowAction(id)
      const original = flows.find(f => f.id === id)
      const newMeta: FlowMeta = {
        id: newId,
        name: `${original?.name ?? 'Fluxo'} (cópia)`,
        bot: original?.bot ?? '',
        botId: original?.botId ?? null,
        botColor: original?.botColor ?? '#6366f1',
        status: 'draft', executions: 0, conversion: 0, revenue: 0, sales: 0, leads: 0,
        updatedAt: Date.now(), description: original?.description ?? '',
      }
      setFlows(arr => [newMeta, ...arr])
      showToast('Fluxo duplicado com sucesso.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao duplicar fluxo.', 'error')
    }
  }

  // ─── saveFlow ───────────────────────────────────────────────────────────────
  async function saveFlow(updated: FlowEditorData): Promise<boolean> {
    try {
      await saveFlowAction({
        id: updated.id,
        name: updated.name,
        description: updated.description,
        botId: updated.botId,
        botColor: updated.botColor,
        status: updated.status,
        nodes: updated.nodes.map(n => ({
          id: n.id, type: n.type, position: n.position,
          data: n.data as unknown as Record<string, unknown>,
        })),
        edges: updated.edges,
        triggerType: updated.triggerType,
        keywords: updated.keywords,
      })

      // Optimistic local update (preserva stats)
      setFlows(arr => arr.map(f => f.id === updated.id
        ? { ...f,
            name: updated.name,
            bot: updated.bot,
            botId: updated.botId,
            botColor: updated.botColor,
            status: updated.status,
            description: updated.description,
            updatedAt: Date.now(),
          }
        : f
      ))
      return true
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error')
      return false
    }
  }

  // ─── publishFlow ────────────────────────────────────────────────────────────
  async function publishFlow(updated: FlowEditorData): Promise<void> {
    try {
      const { version } = await publishFlowAction({
        id: updated.id,
        name: updated.name,
        description: updated.description,
        botId: updated.botId,
        botColor: updated.botColor,
        status: 'published',
        nodes: updated.nodes.map(n => ({
          id: n.id, type: n.type, position: n.position,
          data: n.data as unknown as Record<string, unknown>,
        })),
        edges: updated.edges,
        triggerType: updated.triggerType,
        keywords: updated.keywords,
      })

      // Local sync (preserva stats)
      setFlows(arr => arr.map(f => f.id === updated.id
        ? { ...f,
            name: updated.name,
            bot: updated.bot,
            botId: updated.botId,
            botColor: updated.botColor,
            status: 'published',
            description: updated.description,
            updatedAt: Date.now(),
          }
        : f
      ))

      track('flow_published', { flow_name: updated.name, node_count: updated.nodes.length })
      showToast(
        `Fluxo "${updated.name}" publicado${version != null ? ` (v${version})` : ''}!`,
        'success',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao publicar.', 'error')
    }
  }

  // ─── deleteFlow ─────────────────────────────────────────────────────────────
  async function deleteFlow(id: string) {
    try {
      await deleteFlowAction(id)
      setFlows(arr => arr.filter(f => f.id !== id))
      track('flow_deleted', {})
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao apagar fluxo.', 'error')
    }
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
