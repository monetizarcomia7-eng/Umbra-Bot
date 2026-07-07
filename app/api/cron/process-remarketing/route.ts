import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptToken } from '@/lib/crypto'
import { sendTelegramMessage } from '@/lib/telegram'
import * as Sentry from '@sentry/nextjs'
import {
  type ContactState,
  buildEdgeMap,
  loadFlow,
  executeFlowNode,
  sendTelegramPhoto,
  sendTelegramVideo,
  sendTelegramWithKeyboard,
} from '@/lib/flow-engine'

// Constrói o inline_keyboard (1 botão por linha) a partir dos botões da etapa.
// Só inclui botões com texto e URL http(s) válida — evita rejeição do Telegram.
function buildStepKeyboard(step: CampaignStep): Array<Array<{ text: string; url: string }>> {
  return (step.buttons ?? [])
    .filter((b) => b.label.trim() && /^https?:\/\//i.test(b.url.trim()))
    .slice(0, 3)
    .map((b) => [{ text: b.label.trim(), url: b.url.trim() }])
}

// GET /api/cron/process-remarketing
// Deve ser chamado a cada hora via cron-job.org (com Authorization: Bearer CRON_SECRET).
// Faz duas coisas por execução:
//   1. Enfileira novos contatos elegíveis nas campanhas ativas (step 0)
//   2. Envia as mensagens pendentes cujo scheduled_at já passou

const ENQUEUE_LIMIT = 50   // novos contatos por campanha por rodada
const SEND_LIMIT    = 100  // execuções a enviar por rodada

/* ── Tipos internos ──────────────────────────────────────────────────────── */

interface CampaignStep {
  id: string
  delay:   { amount: number; unit: string }
  message: string
  offer:   { product: string; price: number; cta: string } | null
  buttons?: { label: string; url: string }[]
}

interface RawCampaign {
  id:             string
  user_id:        string
  bot_id:         string
  trigger_type:   string
  audience:       string
  trigger_config: Record<string, unknown>
  steps:          CampaignStep[]
  status:         string
}

interface RawExec {
  id:          string
  campaign_id: string
  contact_id:  string
  bot_id:      string
  step_index:  number
  user_id:     string
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function delayMs(amount: number, unit: string): number {
  if (unit === 'minutos') return amount * 60_000
  if (unit === 'horas')   return amount * 3_600_000
  if (unit === 'dias')    return amount * 86_400_000
  return 0
}

function buildMessage(step: CampaignStep, firstName: string, botName: string): string {
  const nome = firstName.trim() || 'você'
  const data = new Date().toLocaleDateString('pt-BR')

  let text = step.message
    .replace(/\{nome\}/g,    nome)
    .replace(/\{bot\}/g,     botName)
    .replace(/\{produto\}/g, step.offer?.product ?? '')
    .replace(/\{valor\}/g,   step.offer?.price
      ? `R$ ${step.offer.price.toFixed(2).replace('.', ',')}`
      : '')
    .replace(/\{data\}/g, data)

  if (step.offer) {
    text += `\n\n💰 <b>${step.offer.product}</b>`
    if (step.offer.price > 0)
      text += ` — R$ ${step.offer.price.toFixed(2).replace('.', ',')}`
    if (step.offer.cta)
      text += `\n👉 ${step.offer.cta}`
  }

  return text
}

/* ── Busca contatos elegíveis para uma campanha ──────────────────────────── */

async function findEligibleContactIds(
  supabase:  ReturnType<typeof createAdminClient>,
  campaign:  RawCampaign,
  limit:     number,
): Promise<string[]> {
  let query: any = supabase
    .from('contacts')
    .select('id')
    .eq('user_id', campaign.user_id)
    .not('telegram_id', 'is', null)
    .neq('telegram_id', '')

  // Filtra pelo bot da campanha
  if (campaign.bot_id) query = query.eq('bot_id', campaign.bot_id)

  // Filtro de audiência
  const cfg = campaign.trigger_config
  switch (campaign.audience) {
    case 'leads':   query = query.eq('purchases', 0);  break
    case 'buyers':  query = query.gt('purchases', 0);  break
    case 'recent':  query = query.gte('first_contact',
      new Date(Date.now() - 30 * 86_400_000).toISOString()); break
    case 'with_tag':
      if (cfg.tag) query = query.contains('tags', [cfg.tag]); break
  }

  // Filtro por tipo de gatilho
  switch (campaign.trigger_type) {
    case 'nao_comprou_72h': {
      const hours   = Number(cfg.hours ?? 72)
      const cutoff  = new Date(Date.now() - hours * 3_600_000).toISOString()
      const oldest  = new Date(Date.now() - (hours + 168) * 3_600_000).toISOString()
      query = query.eq('purchases', 0).lte('first_contact', cutoff).gte('first_contact', oldest)
      break
    }
    case 'inatividade': {
      const days   = Number(cfg.days ?? 30)
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
      query = query.lte('last_contact', cutoff)
      break
    }
    case 'tag_adicionada':
      if (cfg.tag) query = query.contains('tags', [cfg.tag]); break

    case 'compra_concluida': {
      const cutoff = new Date(Date.now() - 24 * 3_600_000).toISOString()
      query = query.gt('purchases', 0).gte('last_purchase', cutoff)
      break
    }
    case 'carrinho_abandonado':
    case 'abandonou_funil':
      query = query.eq('purchases', 0); break

    case 'aniversario':
      return []  // sem campo de aniversário na tabela
  }

  const { data: contacts } = await query.limit(limit * 3)
  if (!contacts?.length) return []

  const allIds = contacts.map((c: { id: string }) => c.id)

  // Exclui quem já recebeu qualquer etapa desta campanha
  const { data: existing } = await supabase
    .from('remarketing_executions')
    .select('contact_id')
    .eq('campaign_id', campaign.id)
    .in('contact_id', allIds)

  const existingSet = new Set((existing ?? []).map((e: { contact_id: string }) => e.contact_id))
  return allIds.filter((id: string) => !existingSet.has(id)).slice(0, limit)
}

/* ── Handler principal ───────────────────────────────────────────────────── */

const FSS_LIMIT = 100  // flow_scheduled_sends a processar por rodada

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const supabase = createAdminClient()
  let enqueued  = 0
  let sent      = 0
  let failed    = 0
  let fssSent   = 0
  let fssFailed = 0

  /* ── 0. Processar envios agendados pelos nós Remarketing/Delay dos fluxos ─ */

  const { data: fssRows } = await supabase
    .from('flow_scheduled_sends')
    .select('id, bot_id, contact_id, chat_id, message, media_type, media_ref, flow_id')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(FSS_LIMIT)

  if (fssRows && fssRows.length > 0) {
    const fssBotIds = [...new Set(fssRows.map((r: { bot_id: string }) => r.bot_id))]
    const { data: fssBots } = await supabase
      .from('bots')
      .select('id, token, status, name, user_id, anti_clone')
      .in('id', fssBotIds)

    const fssBotMap = new Map(
      (fssBots ?? []).map((b: { id: string; token: string; status: string; name: string; user_id: string }) => [b.id, b])
    )

    for (const row of fssRows as {
      id: string; bot_id: string; contact_id: string; chat_id: number;
      message: string; flow_id: string | null
    }[]) {
      const bot = fssBotMap.get(row.bot_id)
      const protect = Boolean((bot as { anti_clone?: boolean } | undefined)?.anti_clone)
      try {
        if (!bot?.token || bot.status === 'paused') {
          await supabase
            .from('flow_scheduled_sends')
            .update({ status: 'failed', error: 'bot indisponível', sent_at: new Date().toISOString() })
            .eq('id', row.id)
          fssFailed++
          continue
        }

        const token = decryptToken(bot.token as string)

        // FIX P1: Sentinel __delay__:<nodeId> AGORA EXECUTA o próximo nó (era stub).
        // O engine extraído (lib/flow-engine.ts) é importado e roda inline aqui.
        if (row.message.startsWith('__delay__:') && row.flow_id) {
          const nextNodeId = row.message.slice('__delay__:'.length)

          // Carrega contato (com flow_version para usar snapshot correto)
          const { data: cont } = await supabase
            .from('contacts')
            .select('id, first_name, tags, flow_id, flow_node_id, flow_vars, flow_version')
            .eq('id', row.contact_id).maybeSingle()

          const contFlowVersion =
            cont ? ((cont as Record<string, unknown>).flow_version as number | null) : null

          // Carrega o fluxo na versão em que o contato está executando (snapshot imutável)
          const flow = cont ? await loadFlow(row.flow_id, supabase, contFlowVersion) : null

          if (cont && flow) {
            // Limpa wait state e marca delay como cumprido (idempotência)
            await supabase.from('contacts').update({ flow_node_id: null }).eq('id', cont.id)
            await supabase
              .from('flow_scheduled_sends')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('id', row.id)

            const contactState: ContactState = {
              id:           cont.id as string,
              first_name:   (cont.first_name as string) ?? '',
              tags:         (cont.tags as string[] | null) ?? null,
              flow_id:      row.flow_id,
              flow_node_id: null,
              flow_vars:    (cont.flow_vars as Record<string, string>) ?? null,
            }

            const edgeMap = buildEdgeMap(flow.edges)
            await executeFlowNode({
              nodeId:      nextNodeId,
              nodes:       flow.nodes,
              edgeMap,
              contact:     contactState,
              firstName:   contactState.first_name,
              botName:     (bot as { name: string }).name,
              plainToken:  token,
              chatId:      row.chat_id,
              flowId:      flow.id,
              flowVersion: flow.version,
              userId:      (bot as { user_id: string }).user_id,
              supabase,
              protectContent: protect,
            })

            fssSent++
            continue
          }

          // Sem contato/fluxo: marca como failed e continua o loop
          await supabase
            .from('flow_scheduled_sends')
            .update({ status: 'failed', error: 'contato ou fluxo não encontrado', sent_at: new Date().toISOString() })
            .eq('id', row.id)
          fssFailed++
          continue
        }

        // Com mídia anexada (imagem/vídeo) → envia como foto/vídeo com legenda;
        // sem mídia → mensagem de texto simples.
        const rowMedia = row as { media_type?: string | null; media_ref?: string | null }
        if (rowMedia.media_type && rowMedia.media_ref) {
          if (rowMedia.media_type === 'video') {
            await sendTelegramVideo(token, row.chat_id, rowMedia.media_ref, row.message, protect)
          } else {
            await sendTelegramPhoto(token, row.chat_id, rowMedia.media_ref, row.message, protect)
          }
        } else {
          await sendTelegramMessage(token, row.chat_id, row.message, 'HTML', protect)
        }

        await supabase
          .from('flow_scheduled_sends')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', row.id)

        fssSent++
      } catch (err) {
        fssFailed++
        const errMsg = err instanceof Error ? err.message : 'Erro desconhecido'
        await supabase
          .from('flow_scheduled_sends')
          .update({ status: 'failed', error: errMsg, sent_at: new Date().toISOString() })
          .eq('id', row.id)
          .then(() => {}, () => {})

        Sentry.captureException(err, {
          extra: { fssId: row.id, context: 'flow_scheduled_sends_send' },
        })
      }
    }
  }

  /* ── 1. Enfileirar novos contatos nas campanhas ativas ─────────────────── */

  const { data: campaigns } = await supabase
    .from('remarketing_campaigns')
    .select('id, user_id, bot_id, trigger_type, audience, trigger_config, steps, status')
    .eq('status', 'active')
    .not('bot_id',   'is', null)
    .not('user_id',  'is', null)

  for (const campaign of (campaigns ?? []) as RawCampaign[]) {
    try {
      const steps = campaign.steps as CampaignStep[]
      if (!steps?.length) continue

      const contactIds = await findEligibleContactIds(supabase, campaign, ENQUEUE_LIMIT)
      if (!contactIds.length) continue

      const firstStep   = steps[0]
      const scheduledAt = new Date(
        Date.now() + delayMs(firstStep.delay.amount, firstStep.delay.unit)
      ).toISOString()

      const rows = contactIds.map(contactId => ({
        campaign_id:  campaign.id,
        user_id:      campaign.user_id,
        contact_id:   contactId,
        bot_id:       campaign.bot_id,
        step_index:   0,
        status:       'pending',
        scheduled_at: scheduledAt,
      }))

      const { error } = await supabase.from('remarketing_executions').insert(rows)
      if (!error) enqueued += rows.length

    } catch (err) {
      Sentry.captureException(err, {
        extra: { campaignId: campaign.id, context: 'remarketing_enqueue' },
      })
    }
  }

  /* ── 2. Enviar execuções pendentes que já venceram ─────────────────────── */

  const { data: pending } = await supabase
    .from('remarketing_executions')
    .select('id, campaign_id, contact_id, bot_id, step_index, user_id')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(SEND_LIMIT)

  if (!pending?.length) {
    return NextResponse.json({
      enqueued, sent, failed, fssSent, fssFailed,
      message: `${enqueued} enfileirados, ${sent} enviados, ${failed} falhas. Fluxos: ${fssSent} enviados, ${fssFailed} falhas.`,
    })
  }

  // Carrega campanhas, contatos e bots em paralelo (sem N+1)
  const campaignIds = [...new Set(pending.map((p: RawExec) => p.campaign_id))]
  const contactIds  = [...new Set(pending.map((p: RawExec) => p.contact_id).filter(Boolean))]
  const botIds      = [...new Set(pending.map((p: RawExec) => p.bot_id).filter(Boolean))]

  const [campRes, contRes, botRes] = await Promise.all([
    supabase.from('remarketing_campaigns').select('id, steps, status').in('id', campaignIds),
    supabase.from('contacts').select('id, first_name, name, telegram_id').in('id', contactIds),
    supabase.from('bots').select('id, token, name, anti_clone').in('id', botIds),
  ])

  const campMap = new Map((campRes.data ?? []).map(c => [c.id, c]))
  const contMap = new Map((contRes.data ?? []).map(c => [c.id, c]))
  const botMap  = new Map((botRes.data  ?? []).map(b => [b.id, b]))

  const sentCampaignIds    = new Set<string>()
  const sentCountPerCampaign = new Map<string, number>()

  for (const exec of pending as RawExec[]) {
    try {
      const campaign = campMap.get(exec.campaign_id)
      const contact  = contMap.get(exec.contact_id)
      const bot      = botMap.get(exec.bot_id)
      const now      = new Date().toISOString()

      // Pula se campanha pausada ou dados faltando
      if (!campaign || campaign.status !== 'active' || !contact?.telegram_id || !bot?.token) {
        await supabase
          .from('remarketing_executions')
          .update({ status: 'skipped', executed_at: now })
          .eq('id', exec.id)
        continue
      }

      const steps = campaign.steps as CampaignStep[]
      const step  = steps[exec.step_index]
      if (!step) {
        await supabase
          .from('remarketing_executions')
          .update({ status: 'skipped', executed_at: now })
          .eq('id', exec.id)
        continue
      }

      const token     = decryptToken(bot.token as string)
      const firstName = ((contact.first_name || contact.name) as string) || ''
      const text      = buildMessage(step, firstName, bot.name as string)
      const keyboard  = buildStepKeyboard(step)

      const protect = Boolean((bot as { anti_clone?: boolean }).anti_clone)
      if (keyboard.length > 0) {
        await sendTelegramWithKeyboard(token, Number(contact.telegram_id), text, keyboard, protect)
      } else {
        await sendTelegramMessage(token, contact.telegram_id as string, text, 'HTML', protect)
      }

      await supabase
        .from('remarketing_executions')
        .update({ status: 'sent', message_sent: text, executed_at: now })
        .eq('id', exec.id)

      sent++
      sentCampaignIds.add(exec.campaign_id)
      sentCountPerCampaign.set(exec.campaign_id, (sentCountPerCampaign.get(exec.campaign_id) ?? 0) + 1)

      // Agenda próxima etapa se existir
      const nextStep = steps[exec.step_index + 1]
      if (nextStep) {
        await supabase.from('remarketing_executions').insert({
          campaign_id:  exec.campaign_id,
          user_id:      exec.user_id,
          contact_id:   exec.contact_id,
          bot_id:       exec.bot_id,
          step_index:   exec.step_index + 1,
          status:       'pending',
          scheduled_at: new Date(
            Date.now() + delayMs(nextStep.delay.amount, nextStep.delay.unit)
          ).toISOString(),
        })
      }

    } catch (err) {
      failed++
      const errMsg = err instanceof Error ? err.message : 'Erro desconhecido'
      await supabase
        .from('remarketing_executions')
        .update({ status: 'failed', error_message: errMsg, executed_at: new Date().toISOString() })
        .eq('id', exec.id)
        .then(() => {}, () => {})

      Sentry.captureException(err, {
        extra: { execId: exec.id, context: 'remarketing_send' },
      })
    }
  }

  // Incrementa total_sent atomicamente por campanha (sem race condition)
  if (sentCountPerCampaign.size > 0) {
    await Promise.all(
      [...sentCountPerCampaign.entries()].map(([campaignId, count]) =>
        supabase.rpc('increment_campaign_sent', {
          p_campaign_id: campaignId,
          p_count:       count,
        })
      )
    )
  }

  return NextResponse.json({
    enqueued,
    sent,
    failed,
    fssSent,
    fssFailed,
    message: `${enqueued} enfileirados, ${sent} enviados, ${failed} falhas. Fluxos: ${fssSent} enviados, ${fssFailed} falhas.`,
  })
}
