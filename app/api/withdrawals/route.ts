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

  // 5 saques por hora por usuário
  const limited = await rateLimit(`withdrawals:${user.id}`, 5, 60 * 60 * 1000)
  if (!limited.ok) {
    return NextResponse.json({ error: 'Limite de saques atingido. Tente novamente em 1 hora.' }, { status: 429 })
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

  // Calcula saldo disponível em paralelo:
  // totalApproved = soma do net das transações aprovadas
  // totalWithdrawn = soma dos saques pendentes e completados (evita double-spend)
  const [balanceResult, wdResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('net, amount, fee')
      .eq('user_id', user.id)
      .eq('status', 'approved'),
    supabase
      .from('withdrawals')
      .select('amount')
      .eq('user_id', user.id)
      .in('status', ['pending', 'completed']),
  ])

  if (balanceResult.error) {
    Sentry.captureException(balanceResult.error, { extra: { userId: user.id, context: 'withdrawals_balance_check' } })
    return NextResponse.json({ error: 'Erro ao verificar saldo.' }, { status: 500 })
  }
  if (wdResult.error) {
    Sentry.captureException(wdResult.error, { extra: { userId: user.id, context: 'withdrawals_wdcheck' } })
    return NextResponse.json({ error: 'Erro ao verificar saques anteriores.' }, { status: 500 })
  }

  const totalApproved = (balanceResult.data ?? []).reduce(
    (sum, r) => sum + Number(r.net ?? (Number(r.amount) - Number(r.fee ?? 0))), 0,
  )
  const totalWithdrawn = (wdResult.data ?? []).reduce((sum, w) => sum + Number(w.amount), 0)
  const available = Math.max(0, totalApproved - totalWithdrawn)

  if (amount > available) {
    return NextResponse.json({ error: `Saldo insuficiente. Disponível: R$ ${available.toFixed(2)}.` }, { status: 422 })
  }

  const { error: insertError } = await supabase.from('withdrawals').insert({
    user_id:       user.id,
    amount,
    account_id,
    account_label,
    status:        'pending',
  })

  if (insertError) {
    Sentry.captureException(insertError, { extra: { userId: user.id, context: 'withdrawals_insert' } })
    return NextResponse.json({ error: 'Erro ao registrar saque.' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
