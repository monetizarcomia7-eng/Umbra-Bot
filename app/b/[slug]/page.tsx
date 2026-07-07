import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { BioPublicClient } from './BioPublicClient'

export const revalidate = 60

type Params = Promise<{ slug: string }>

export interface PublicBiolink {
  id:           string
  slug:         string
  name:         string
  bio:          string
  avatar:       string
  avatar_color: string
  theme_id:     string
  background:   'solid' | 'gradient' | 'dots'
  button_style: 'rounded' | 'sharp' | 'pill'
  links:        unknown
  views:        number
  clicks:       number
  status:       'published' | 'draft'
  bg_image:     string | null
  font_family:  string
  social_icons: unknown
  verified:     boolean
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const admin = createAdminClient()
  const { data } = await admin
    .from('biolinks')
    .select('name, bio, avatar')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!data) return { title: 'Umbra Bot' }

  const displayTitle = data.name || `@${slug}`
  return {
    title: `${displayTitle} | Umbra Bot`,
    description: data.bio || 'Minha página de links',
    ...(data.avatar?.startsWith('http') && {
      openGraph: {
        title: `${displayTitle} | Umbra Bot`,
        description: data.bio || 'Minha página de links',
        images: [{ url: data.avatar }],
      },
      twitter: {
        card: 'summary',
        title: `${displayTitle} | Umbra Bot`,
        images: [data.avatar],
      },
    }),
  }
}

export default async function BioPublicPage({ params }: { params: Params }) {
  const { slug } = await params
  const admin = createAdminClient()
  const { data } = await admin
    .from('biolinks')
    .select('id, slug, name, bio, avatar, avatar_color, theme_id, background, button_style, links, views, clicks, status, bg_image, font_family, social_icons, verified')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!data) notFound()

  return <BioPublicClient biolink={data as PublicBiolink} slug={slug} />
}
