import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BioLinkClient } from './BioLinkClient'

export const dynamic = 'force-dynamic'

export interface RawBiolink {
  id: string
  slug: string
  name: string
  bio: string
  avatar: string
  avatar_color: string
  theme_id: string
  background: string
  button_style: string
  links: unknown
  views: number
  clicks: number
  status: 'published' | 'draft'
  user_id: string
  created_at: string
  updated_at: string
  bg_image: string | null
  bg_position: string | null
  font_family: string | null
  social_icons: unknown
  verified: boolean | null
}

export default async function BioLinkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: biolinks } = await supabase
    .from('biolinks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <BioLinkClient
      userId={user.id}
      initialBiolinks={(biolinks as RawBiolink[]) ?? []}
      appUrl={process.env.APP_URL ?? 'https://www.umbrabot.com.br'}
    />
  )
}
