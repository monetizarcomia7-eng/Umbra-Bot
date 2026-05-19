import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

const withdrawalSchema = z.object({
  amount:        z.number({ error: 'Valor deve ser um número.' }).positive('Valor deve ser maior que zero.'),
  account_id:    z.string().min(1, 'Conta de destino obrigatória.').max(100),
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

  // Calcula saldo disponível: soma do net de transações aprovadas
  const { data: balanceRows, error: balanceError } = await supabase
    .from('transactions')
    .select('net, amount')
    .eq('user_id', user.id)
    .eq('status', 'approved')

  if (balanceError) {
    Sentry.captureException(balanceError, { extra: { userId: user.id, context: 'withdrawals_balance_check' } })
    return NextResponse.json({ error: 'Erro ao verificar saldo.' }, { status: 500 })
  }

  const available = (balanceRows ?? []).reduce((sum, r) => sum + Number(r.net ?? r.amount), 0)

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
