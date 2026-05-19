import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  // 5 withdrawal requests per hour per user
  const limited = await rateLimit(`withdrawals:${user.id}`, 5, 60 * 60 * 1000)
  if (!limited.ok) {
    return NextResponse.json({ error: 'Limite de saques atingido. Tente novamente em 1 hora.' }, { status: 429 })
  }

  let body: { amount?: unknown; account_id?: unknown; account_label?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const amount = Number(body.amount)
  const accountId    = String(body.account_id ?? '').trim()
  const accountLabel = String(body.account_label ?? '').trim()

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 })
  }
  if (!accountId || !accountLabel) {
    return NextResponse.json({ error: 'Conta de destino inválida.' }, { status: 400 })
  }

  // Compute available balance: sum of net for approved transactions
  const { data: balanceRows, error: balanceError } = await supabase
    .from('transactions')
    .select('net, amount')
    .eq('user_id', user.id)
    .eq('status', 'approved')

  if (balanceError) {
    return NextResponse.json({ error: 'Erro ao verificar saldo.' }, { status: 500 })
  }

  const available = (balanceRows ?? []).reduce((sum, r) => sum + Number(r.net ?? r.amount), 0)

  if (amount > available) {
    return NextResponse.json({ error: `Saldo insuficiente. Disponível: R$ ${available.toFixed(2)}.` }, { status: 422 })
  }

  const { error: insertError } = await supabase.from('withdrawals').insert({
    user_id:       user.id,
    amount,
    account_id:    accountId,
    account_label: accountLabel,
    status:        'pending',
  })

  if (insertError) {
    return NextResponse.json({ error: 'Erro ao registrar saque.' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
