import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { publishPost, MetaAPIError, getMetaErrorMessage } from '@/lib/instagram/publish'
import * as Sentry from '@sentry/nextjs'

// Códigos da Meta que NÃO devem ser retentados (erro permanente)
const NON_RETRYABLE_CODES = new Set<number>([
  190,  // Token inválido/expirado
  200,  // Permissão negada
  368,  // Conta bloqueada
  100,  // Parâmetro inválido
])

const BATCH_LIMIT = 20

interface PostRow {
  id:           string
  user_id:      string
  account_id:   string
  media_type:   'IMAGE' | 'REELS' | 'CAROUSEL'
  media_urls:   string[]
  caption:      string
  retry_count:  number
  max_retries:  number
  instagram_accounts: {
    ig_user_id:   string
    access_token: string
    is_active:    boolean
  } | null
}

// GET /api/cron/publish-instagram
// Worker que publica posts agendados. Chamado por cron-job.org a cada 1 min.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const t0 = Date.now()

  const { data: posts, error: fetchErr } = await supabase
    .from('instagram_posts')
    .select(`
      id, user_id, account_id, media_type, media_urls, caption, retry_count, max_retries,
      instagram_accounts ( ig_user_id, access_token, is_active )
    `)
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(BATCH_LIMIT)

  if (fetchErr) {
    Sentry.captureException(new Error(fetchErr.message), {
      extra: { context: 'cron_publish_instagram_fetch' },
    })
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!posts || posts.length === 0) {
    Sentry.captureCheckIn({ monitorSlug: 'publish-instagram', status: 'ok' })
    return NextResponse.json({ processed: 0, duration_ms: Date.now() - t0 })
  }

  let published = 0
  let failed    = 0

  for (const post of posts as unknown as PostRow[]) {
    const account = post.instagram_accounts
    if (!account || !account.is_active) {
      await supabase
        .from('instagram_posts')
        .update({ status: 'failed', error_msg: 'Conta Instagram desconectada ou desativada' })
        .eq('id', post.id)
      failed++
      continue
    }

    // CAS para evitar duplo-processamento (se outro worker pegar antes)
    const { data: locked } = await supabase
      .from('instagram_posts')
      .update({ status: 'publishing' })
      .eq('id', post.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle()
    if (!locked) continue

    const attemptStart = Date.now()
    let success = false
    let responseData: unknown = null
    let errorCode: string | null = null

    try {
      const result = await publishPost({
        ig_user_id:   account.ig_user_id,
        access_token: account.access_token,
        media_type:   post.media_type,
        media_urls:   post.media_urls,
        caption:      post.caption,
      })

      await supabase
        .from('instagram_posts')
        .update({
          status:       'published',
          ig_post_id:   result.ig_post_id,
          published_at: new Date().toISOString(),
        })
        .eq('id', post.id)

      // activity_event de sucesso (fire-and-forget)
      void supabase.from('activity_events').insert({
        user_id:     post.user_id,
        type:        'newBot',  // sem tipo dedicado — reusa 'newBot' até evoluirmos
        title:       'Post Instagram publicado',
        description: `Post #${result.ig_post_id} publicado no Instagram.`,
      }).then(() => {})

      responseData = result
      success      = true
      published++
    } catch (err) {
      const isMetaError      = err instanceof MetaAPIError
      const nonRetryable     = isMetaError && NON_RETRYABLE_CODES.has(err.code)
      const maxRetriesReached = post.retry_count + 1 >= post.max_retries
      const friendlyMsg      = isMetaError ? getMetaErrorMessage(err.code) : (err instanceof Error ? err.message : 'Erro desconhecido')

      errorCode = isMetaError ? String(err.code) : 'UNKNOWN'

      await supabase
        .from('instagram_posts')
        .update({
          status:      nonRetryable || maxRetriesReached ? 'failed' : 'scheduled',
          error_msg:   friendlyMsg,
          retry_count: post.retry_count + 1,
        })
        .eq('id', post.id)

      responseData = { error: friendlyMsg, code: errorCode }
      failed++

      // Token expirado: desativa a conta para o user reconectar
      if (isMetaError && err.code === 190) {
        await supabase
          .from('instagram_accounts')
          .update({ is_active: false })
          .eq('id', post.account_id)

        // Cria alerta
        void supabase.from('alerts').insert({
          user_id:     post.user_id,
          type:        'system',
          severity:    'critical',
          title:       'Conta Instagram desconectada',
          description: 'O token expirou. Reconecte a conta em /dashboard/instagram para retomar as publicações.',
          source:      'cron',
        }).then(() => {})
      }

      Sentry.captureException(err, {
        extra: { postId: post.id, igUserId: account.ig_user_id, context: 'publish_instagram' },
      })
    }

    void supabase.from('instagram_publish_logs').insert({
      post_id:     post.id,
      success,
      response:    responseData as Record<string, unknown>,
      error_code:  errorCode,
      duration_ms: Date.now() - attemptStart,
    }).then(() => {})
  }

  Sentry.captureCheckIn({ monitorSlug: 'publish-instagram', status: 'ok' })

  return NextResponse.json({
    processed:    posts.length,
    published,
    failed,
    duration_ms:  Date.now() - t0,
  })
}
