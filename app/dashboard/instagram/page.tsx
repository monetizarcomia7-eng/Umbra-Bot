import { redirect } from 'next/navigation'

// Tipos compartilhados pelas sub-rotas
export interface RawIgAccount {
  id:               string
  ig_user_id:       string
  username:         string | null
  profile_picture:  string | null
  token_expires_at: string | null
  is_active:        boolean
  created_at:       string
}

export interface RawIgPost {
  id:           string
  account_id:   string
  media_type:   'IMAGE' | 'REELS' | 'CAROUSEL'
  media_urls:   string[]
  caption:      string
  scheduled_at: string
  status:       string
  ig_post_id:   string | null
  published_at: string | null
  error_msg:    string | null
  retry_count:  number
  created_at:   string
  updated_at:   string
}

export interface IgStats {
  accounts_count:  number
  scheduled_count: number
  published_30d:   number
  failed_30d:      number
}

export default async function InstagramPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams

  // Retorno do OAuth (?success / ?error / ?code) precisa chegar na aba Contas.
  // Antes o redirect() descartava a query string e o usuário nunca via sucesso nem erro.
  if (sp.success || sp.error) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === 'string') qs.set(k, v)
    }
    redirect(`/dashboard/instagram/accounts?${qs.toString()}`)
  }

  // Aba padrão = Posts (visão geral).
  redirect('/dashboard/instagram/posts')
}
