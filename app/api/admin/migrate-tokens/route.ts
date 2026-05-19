import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptToken } from '@/lib/crypto'

// POST /api/admin/migrate-tokens
// Protegido por ADMIN_EMAIL — re-encrypta tokens legados (plain text) para AES-256-GCM.
// Executar uma única vez após configurar BOT_TOKEN_ENCRYPTION_KEY em produção.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const adminEmail = process.env.ADMIN_EMAIL

  if (!adminEmail || authHeader !== `Bearer ${process.env.ADMIN_MIGRATION_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data: bots, error } = await supabase
    .from('bots')
    .select('id, token')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const plain = (bots ?? []).filter((b) => b.token && !b.token.startsWith('enc:'))

  if (plain.length === 0) {
    return NextResponse.json({ migrated: 0, message: 'Nenhum token legado encontrado.' })
  }

  let migrated = 0
  const errors: string[] = []

  for (const bot of plain) {
    try {
      const encrypted = encryptToken(bot.token)
      const { error: updateError } = await supabase
        .from('bots')
        .update({ token: encrypted })
        .eq('id', bot.id)
      if (updateError) throw new Error(updateError.message)
      migrated++
    } catch (err) {
      errors.push(`bot ${bot.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    migrated,
    total: plain.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
