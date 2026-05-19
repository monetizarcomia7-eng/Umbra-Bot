'use server'

import { createClient } from '@/lib/supabase/server'
import { encryptToken } from '@/lib/crypto'

export async function saveBotAction(userId: string, name: string, token: string) {
  const encrypted = encryptToken(token)
  const supabase = await createClient()
  const { error } = await supabase.from('bots').insert({
    user_id: userId,
    name,
    token: encrypted,
    status: 'offline',
    username: '',
  })
  if (error) throw new Error(error.message)
}
