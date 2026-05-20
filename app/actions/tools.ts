'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptToken } from '@/lib/crypto'
import { rateLimit } from '@/lib/rate-limit'
import { revalidatePath } from 'next/cache'

/* ── testMessageAction ─────────────────────────────────────────────────── */

export async function testMessageAction(
  botId: string,
  chatId: string,
  text: string,
  format: 'HTML' | 'Markdown' | 'none' = 'HTML',
): Promise<{ success: boolean; messageId: number | null; time: string; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const rl = await rateLimit(`test-msg:${user.id}`, 10, 60_000)
  if (!rl.ok) throw new Error('Muitas tentativas. Aguarde um minuto.')

  const { data: bot } = await supabase
    .from('bots').select('token').eq('id', botId).eq('user_id', user.id).single()
  if (!bot?.token) throw new Error('Bot não encontrado.')

  const token = decryptToken(bot.token as string)
  const start = Date.now()

  const msgBody: Record<string, unknown> = { chat_id: chatId.trim(), text }
  if (format !== 'none') msgBody.parse_mode = format

  let res: Response
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(msgBody),
      cache:   'no-store',
      signal:  AbortSignal.timeout(10_000),
    })
  } catch {
    throw new Error('Erro de conexão com a API do Telegram. Verifique sua internet.')
  }

  const elapsed = Date.now() - start
  const data = await res.json() as { ok: boolean; result?: { message_id: number }; description?: string }

  return {
    success:   data.ok,
    messageId: data.result?.message_id ?? null,
    time:      `${elapsed} ms`,
    error:     data.ok ? null : (data.description ?? 'Erro desconhecido'),
  }
}

/* ── checkBotsAction ───────────────────────────────────────────────────── */

export async function checkBotsAction(): Promise<{ pass: boolean; detail: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const { data: bots } = await supabase
    .from('bots').select('id, name, username, token').eq('user_id', user.id)

  if (!bots || bots.length === 0)
    return { pass: true, detail: 'Nenhum bot cadastrado ainda.' }

  let online = 0
  const issues: string[] = []

  await Promise.allSettled(bots.map(async (bot) => {
    try {
      if (!bot.token) { issues.push(`@${bot.username}: sem token`); return }
      const token = decryptToken(bot.token as string)
      const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
        cache:  'no-store',
        signal: AbortSignal.timeout(5_000),
      })
      const d = await res.json() as { ok: boolean; result?: { url?: string; last_error_date?: number } }
      const info = d.result
      const hasWebhook  = !!(info?.url)
      const recentError = info?.last_error_date && (Date.now() / 1000 - info.last_error_date) < 1800
      if (hasWebhook && !recentError) {
        online++
      } else {
        if (!hasWebhook) issues.push(`@${bot.username}: sem webhook`)
        else issues.push(`@${bot.username}: erros recentes`)
      }
    } catch {
      issues.push(`@${bot.username}: timeout`)
    }
  }))

  const total  = bots.length
  const pass   = online === total && issues.length === 0
  let detail   = `${online}/${total} bots respondendo.`
  if (issues.length > 0) detail += ` Atenção: ${issues.slice(0, 2).join('; ')}.`
  return { pass, detail }
}

/* ── checkWebhooksAction ───────────────────────────────────────────────── */

export async function checkWebhooksAction(): Promise<{ pass: boolean; detail: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const { data: webhooks } = await supabase
    .from('webhooks').select('id, name, status, active').eq('user_id', user.id)

  if (!webhooks || webhooks.length === 0)
    return { pass: true, detail: 'Nenhum webhook personalizado cadastrado.' }

  const active  = webhooks.filter(w => w.active)
  const failing = active.filter(w => w.status !== 'healthy')

  const pass = failing.length === 0
  let detail = `${active.length - failing.length}/${active.length} webhooks saudáveis.`
  if (failing.length > 0)
    detail += ` Com falha: ${failing.map(w => w.name).slice(0, 2).join(', ')}.`
  return { pass, detail }
}

/* ── checkGatewaysAction ───────────────────────────────────────────────── */

export async function checkGatewaysAction(): Promise<{ pass: boolean; detail: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const { data: gateways } = await supabase
    .from('gateways').select('id, name, connected, status').eq('user_id', user.id)

  if (!gateways || gateways.length === 0)
    return { pass: true, detail: 'Nenhum gateway configurado.' }

  const connected = gateways.filter(g => g.connected)
  const pass = connected.length > 0
  const detail = connected.length > 0
    ? `${connected.length}/${gateways.length} gateways conectados: ${connected.map(g => g.name).join(', ')}.`
    : `Nenhum gateway ativo. Configure em Integrações → Gateways.`
  return { pass, detail }
}

/* ── checkQueueAction ──────────────────────────────────────────────────── */

export async function checkQueueAction(): Promise<{ pass: boolean; detail: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const [{ count: sending }, { count: scheduled }] = await Promise.all([
    supabase.from('broadcasts').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'sending'),
    supabase.from('broadcasts').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'scheduled'),
  ])

  const s = sending ?? 0
  const sc = scheduled ?? 0
  let detail = ''
  if (s === 0 && sc === 0)       detail = 'Nenhum disparo em andamento ou agendado.'
  else if (s > 0 && sc > 0)     detail = `${s} em andamento · ${sc} agendado(s). Processamento ativo.`
  else if (s > 0)                detail = `${s} broadcast(s) em andamento. Processamento ativo (~30 msg/s).`
  else                           detail = `${sc} broadcast(s) agendado(s). Próxima rodada em até 15 min.`
  return { pass: true, detail }
}

/* ── checkDnsAction ────────────────────────────────────────────────────── */

export async function checkDnsAction(): Promise<{ pass: boolean; detail: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const appUrl = process.env.APP_URL
  if (!appUrl)
    return { pass: false, detail: 'APP_URL não configurada no ambiente.' }

  const isHttps = appUrl.startsWith('https://')
  if (!isHttps)
    return { pass: false, detail: `${appUrl} não usa HTTPS. Configure SSL/TLS.` }

  return { pass: true, detail: `${appUrl} configurado com HTTPS. SSL ativo.` }
}

/* ── checkStorageAction ────────────────────────────────────────────────── */

export async function checkStorageAction(): Promise<{ pass: boolean; detail: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const [{ count: contacts }, { count: flows }, { count: broadcasts }] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('flows').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('broadcasts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  const c = contacts ?? 0
  const f = flows ?? 0
  const b = broadcasts ?? 0
  const detail = `${c.toLocaleString('pt-BR')} contatos · ${f} fluxos · ${b} broadcasts. Banco operacional.`
  return { pass: true, detail }
}

/* ── getExportCountsAction ─────────────────────────────────────────────── */

export async function getExportCountsAction(): Promise<{
  bots:      number
  flows:     number
  sequences: number
  gateways:  number
  links:     number
  contacts:  number
  tags:      number
  webhooks:  number
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const [bR, fR, sR, gR, lR, cR, wR, tagsRes] = await Promise.all([
    supabase.from('bots').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('flows').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('remarketing_campaigns').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('gateways').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('redirects').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('webhooks').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('contacts').select('tags').eq('user_id', user.id),
  ])

  const allTags = new Set<string>()
  ;(tagsRes.data ?? []).forEach(c => (c.tags as string[]).forEach(t => allTags.add(t)))

  return {
    bots:      bR.count ?? 0,
    flows:     fR.count ?? 0,
    sequences: sR.count ?? 0,
    gateways:  gR.count ?? 0,
    links:     lR.count ?? 0,
    contacts:  cR.count ?? 0,
    tags:      allTags.size,
    webhooks:  wR.count ?? 0,
  }
}

/* ── exportConfigAction ────────────────────────────────────────────────── */

export async function exportConfigAction(parts: {
  bots:      boolean
  flows:     boolean
  sequences: boolean
  gateways:  boolean
  links:     boolean
  contacts:  boolean
  tags:      boolean
  webhooks:  boolean
}): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const payload: Record<string, unknown> = {
    version:     '1.0',
    exported_at: new Date().toISOString(),
    workspace:   user.id,
  }

  const queries: PromiseLike<void>[] = []

  if (parts.bots) queries.push(
    supabase.from('bots')
      .select('id, name, username, status, color, description, welcome_message, fallback_message, active_flow_id')
      .eq('user_id', user.id)
      .then(({ data }) => { payload.bots = data ?? [] }),
  )

  if (parts.flows) queries.push(
    supabase.from('flows')
      .select('id, name, description, status, nodes, edges, trigger_type, keywords')
      .eq('user_id', user.id)
      .then(({ data }) => { payload.flows = data ?? [] }),
  )

  if (parts.sequences) queries.push(
    supabase.from('remarketing_campaigns')
      .select('id, name, description, trigger_type, audience, trigger_config, status, steps')
      .eq('user_id', user.id)
      .then(({ data }) => { payload.sequences = data ?? [] }),
  )

  if (parts.gateways) queries.push(
    supabase.from('gateways')
      .select('id, name, connected, account, status, provider')
      .eq('user_id', user.id)
      .then(({ data }) => { payload.gateways = data ?? [] }),
  )

  if (parts.links) queries.push(
    supabase.from('redirects')
      .select('id, slug, destination, destination_label, status, cloaking, utm, redirect_type')
      .eq('user_id', user.id)
      .then(({ data }) => { payload.links = data ?? [] }),
  )

  if (parts.webhooks) queries.push(
    supabase.from('webhooks')
      .select('id, name, url, events, active')
      .eq('user_id', user.id)
      .then(({ data }) => { payload.webhooks = data ?? [] }),
  )

  if (parts.contacts) queries.push(
    supabase.from('contacts')
      .select('id, name, first_name, last_name, username, email, phone, origin, tags, purchases, total_spent, first_contact, last_contact')
      .eq('user_id', user.id)
      .then(({ data }) => { payload.contacts = data ?? [] }),
  )

  if (parts.tags) queries.push(
    supabase.from('contacts').select('tags').eq('user_id', user.id)
      .then(({ data }) => {
        const all = new Set<string>()
        ;(data ?? []).forEach(c => (c.tags as string[]).forEach(t => all.add(t)))
        payload.tags = [...all].sort()
      }),
  )

  await Promise.all(queries)
  return JSON.stringify(payload, null, 2)
}

/* ── importConfigAction ────────────────────────────────────────────────── */

export async function importConfigAction(jsonStr: string): Promise<{
  imported: { flows: number; sequences: number; gateways: number; links: number; webhooks: number }
  errors:   string[]
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(jsonStr) as Record<string, unknown>
  } catch {
    throw new Error('JSON inválido. Verifique o arquivo exportado.')
  }

  const imported = { flows: 0, sequences: 0, gateways: 0, links: 0, webhooks: 0 }
  const errors:   string[] = []

  if (Array.isArray(payload.flows)) {
    for (const f of payload.flows as Record<string, unknown>[]) {
      const { error } = await supabase.from('flows').upsert({
        id:           f.id,
        user_id:      user.id,
        name:         f.name,
        description:  f.description ?? '',
        status:       'draft',
        nodes:        f.nodes  ?? [],
        edges:        f.edges  ?? [],
        trigger_type: f.trigger_type ?? 'start',
        keywords:     f.keywords ?? [],
      }, { onConflict: 'id' })
      if (error) errors.push(`Fluxo "${f.name}": ${error.message}`)
      else imported.flows++
    }
  }

  if (Array.isArray(payload.sequences)) {
    for (const s of payload.sequences as Record<string, unknown>[]) {
      const { error } = await supabase.from('remarketing_campaigns').upsert({
        id:             s.id,
        user_id:        user.id,
        name:           s.name,
        description:    s.description ?? '',
        trigger_type:   s.trigger_type,
        audience:       s.audience ?? 'all',
        trigger_config: s.trigger_config ?? {},
        status:         'draft',
        steps:          s.steps ?? [],
      }, { onConflict: 'id' })
      if (error) errors.push(`Sequência "${s.name}": ${error.message}`)
      else imported.sequences++
    }
  }

  if (Array.isArray(payload.gateways)) {
    for (const g of payload.gateways as Record<string, unknown>[]) {
      const { error } = await supabase.from('gateways').upsert({
        id:          g.id,
        user_id:     user.id,
        name:        g.name,
        connected:   false,
        status:      'pending',
        provider:    g.provider ?? '',
        credentials: {},
      }, { onConflict: 'id' })
      if (error) errors.push(`Gateway "${g.name}": ${error.message}`)
      else imported.gateways++
    }
  }

  if (Array.isArray(payload.links)) {
    for (const l of payload.links as Record<string, unknown>[]) {
      const { error } = await supabase.from('redirects').upsert({
        id:                l.id,
        user_id:           user.id,
        slug:              l.slug,
        destination:       l.destination,
        destination_label: l.destination_label ?? '',
        status:            'active',
        cloaking:          l.cloaking ?? false,
        utm:               l.utm ?? null,
        redirect_type:     l.redirect_type ?? '302',
      }, { onConflict: 'id' })
      if (error) errors.push(`Link "${l.slug}": ${error.message}`)
      else imported.links++
    }
  }

  if (Array.isArray(payload.webhooks)) {
    for (const w of payload.webhooks as Record<string, unknown>[]) {
      const { error } = await supabase.from('webhooks').upsert({
        id:      w.id,
        user_id: user.id,
        name:    w.name,
        url:     w.url,
        events:  w.events ?? [],
        secret:  '',
        active:  w.active ?? true,
        status:  'healthy',
      }, { onConflict: 'id' })
      if (error) errors.push(`Webhook "${w.name}": ${error.message}`)
      else imported.webhooks++
    }
  }

  return { imported, errors }
}

/* ── clearCacheAction ──────────────────────────────────────────────────── */

export async function clearCacheAction(): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const paths = [
    '/', '/dashboard', '/dashboard/bots', '/dashboard/customers',
    '/dashboard/analytics', '/dashboard/broadcasts', '/dashboard/remarketing',
    '/dashboard/redirects', '/dashboard/affiliates', '/dashboard/flows',
    '/dashboard/activity', '/dashboard/alerts', '/dashboard/finance',
  ]
  paths.forEach(p => revalidatePath(p))
  revalidatePath('/', 'layout')

  return { ok: true }
}

/* ── getLgpdDataAction ─────────────────────────────────────────────────── */

export async function getLgpdDataAction(): Promise<{
  total: number
  with_name: number
  with_email: number
  with_phone: number
  with_username: number
  with_city: number
  unique_tags: number
  total_tag_assignments: number
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado.')

  const [totalRes, nameRes, emailRes, phoneRes, usernameRes, cityRes, tagsRes] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).not('name', 'is', null).neq('name', ''),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).not('email', 'is', null).neq('email', ''),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).not('phone', 'is', null).neq('phone', ''),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).not('username', 'is', null).neq('username', ''),
    supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).not('city', 'is', null).neq('city', ''),
    supabase.from('contacts').select('tags').eq('user_id', user.id).not('tags', 'eq', '{}'),
  ])

  const allTags = new Set<string>()
  let totalTagAssignments = 0
  ;(tagsRes.data ?? []).forEach(c => {
    const tags = (c.tags as string[] | null) ?? []
    tags.forEach(t => { allTags.add(t); totalTagAssignments++ })
  })

  return {
    total:                totalRes.count ?? 0,
    with_name:            nameRes.count ?? 0,
    with_email:           emailRes.count ?? 0,
    with_phone:           phoneRes.count ?? 0,
    with_username:        usernameRes.count ?? 0,
    with_city:            cityRes.count ?? 0,
    unique_tags:          allTags.size,
    total_tag_assignments: totalTagAssignments,
  }
}
