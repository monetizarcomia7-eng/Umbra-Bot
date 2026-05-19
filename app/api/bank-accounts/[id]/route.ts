import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { error } = await supabase
    .from('bank_accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    Sentry.captureException(error, { extra: { id, userId: user.id, context: 'bank_accounts_delete' } })
    return NextResponse.json({ error: 'Erro ao remover conta.' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
