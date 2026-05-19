'use server'

import { createClient } from '@/lib/supabase/server'
import { encryptToken } from '@/lib/crypto'

export async function saveBotAction(name: string, token: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Não autorizado.')

  const encrypted = encryptToken(token)
  const { error } = await supabase.from('bots').insert({
    user_id: user.id,
    name,
    token: encrypted,
    status: 'offline',
    username: '',
  })
  if (error) throw new Error(error.message)
}
