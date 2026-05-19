import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'

const createSchema = z.object({
  label:   z.string().min(1, 'Apelido obrigatório.').max(200),
  pix_key: z.string().min(1, 'Chave/dados obrigatórios.').max(200),
  kind:    z.enum(['pix', 'conta', 'ted']).default('pix'),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data, error } = await supabase
    .from('bank_accounts')
    .select('id, label, pix_key, kind, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    Sentry.captureException(error, { extra: { userId: user.id, context: 'bank_accounts_list' } })
    return NextResponse.json({ error: 'Erro ao buscar contas.' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  let rawBody: unknown
  try { rawBody = await request.json() } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  }

  const { label, pix_key, kind } = parsed.data

  const { data, error } = await supabase
    .from('bank_accounts')
    .insert({ user_id: user.id, label, pix_key, kind })
    .select('id, label, pix_key, kind, created_at')
    .single()

  if (error) {
    Sentry.captureException(error, { extra: { userId: user.id, context: 'bank_accounts_create' } })
    return NextResponse.json({ error: 'Erro ao salvar conta.' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
