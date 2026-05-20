import { createClient } from '@supabase/supabase-js'

// Cliente com service role — bypassa RLS.
// Usar APENAS em route handlers server-side que não possuem sessão de usuário:
// webhooks externos (Telegram), cron jobs (Vercel Cron).
// NUNCA expor para o cliente browser nem passar para Server Actions.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.')
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
