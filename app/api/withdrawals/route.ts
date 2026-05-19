import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

const withdrawalSchema = z.object({
  amount:        z.number({ error: 'Valor deve ser um número.' }).positive('Valor deve ser maior que zero.'),
  account_id:    z.string().uuid(),
  account_label: z.string().min(1, 'Rótulo da conta obrigatório.').max(200),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  // 3 saques por dia por usuário (padrão financeiro conservador)
  const limited = await rateLimit(`withdrawals:${user.id}`, 3, 24 * 60 * 60 * 1000)
  if (!limited.ok) {
    return NextResponse.json({ error: 'Limite de saques atingido. Você pode solicitar no máximo 3 saques por dia.' }, { status: 429 })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const parsed = withdrawalSchema.safeParse(rawBody)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Dados inválidos.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { amount, account_id, account_label } = parsed.data

  // Valida que a conta bancária pertence ao usuário autenticado
  const { data: account, error: accountError } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('id', account_id)
    .eq('user_id', user.id)
    .single()

  if (accountError || !account) {
    return NextResponse.json({ error: 'Conta bancária inválida.' }, { status: 422 })
  }

  // Usa profiles.balance — mantido atomicamente por triggers (migration 029).
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('balance')
    .eq('id', user.id)
    .single()

  if (profileError) {
    Sentry.captureException(profileError, { extra: { userId: user.id, context: 'withdrawals_balance_check' } })
    return NextResponse.json({ error: 'Erro ao verificar saldo.' }, { status: 500 })
  }

  const available = Math.max(0, Number(profile?.balance ?? 0))

  if (amount > available) {
    return NextResponse.json({ error: `Saldo insuficiente. Disponível: R$ ${available.toFixed(2)}.` }, { status: 422 })
  }

  // Captura IP para auditoria e detecção de fraude
  const requesterIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null

  const { error: insertError } = await supabase.from('withdrawals').insert({
    user_id:       user.id,
    amount,
    account_id,
    account_label,
    status:        'pending',
    requester_ip:  requesterIp,
  })

  if (insertError) {
    Sentry.captureException(insertError, { extra: { userId: user.id, context: 'withdrawals_insert' } })
    return NextResponse.json({ error: 'Erro ao registrar saque.' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
