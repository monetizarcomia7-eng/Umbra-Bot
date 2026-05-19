import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PAGE_LIMIT = 500

// GET /api/finance/transactions?offset=N
// Retorna a próxima página de transações para o botão "Carregar mais"
// no FinanceDashboard. Mesma seleção de campos que o Server Component.
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset') ?? 0))

  const { data, error } = await supabase
    .from('transactions')
    .select('id, amount, net, fee, status, type, payment_method, product_name, customer_name, customer_email, gateway, bot_id, flow_id, utm_source, utm_campaign, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_LIMIT - 1)

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar transações.' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
