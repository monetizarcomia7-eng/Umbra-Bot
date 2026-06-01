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

export default function InstagramPage() {
  // Aba padrão = Posts (visão geral). Settings é a única que não envolve dado por padrão.
  redirect('/dashboard/instagram/posts')
}
