import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RawFinanceSummary } from '@/components/dashboard/finance/types'

// GET /api/finance/balance
// Retorna o saldo disponível atual via RPC finance_summary.
// Usado pelo WithdrawModal para exibir saldo fresco ao abrir o modal,
// evitando que dados stale do carregamento da página sejam exibidos.
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const { data, error } = await supabase.rpc('finance_summary', { p_user_id: user.id })

  if (error || !data) {
    // Fallback: lê profiles.balance diretamente
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Erro ao buscar saldo.' }, { status: 500 })
    }

    return NextResponse.json({ saldo_disponivel: Number(profile.balance) })
  }

  const summary = data as RawFinanceSummary
  return NextResponse.json({ saldo_disponivel: Number(summary.saldo_disponivel) })
}
