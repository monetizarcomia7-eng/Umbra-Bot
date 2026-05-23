import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GuideClient from './GuideClient'

export const revalidate = 3600

export interface RawGuideArticle {
  id: string
  slug: string | null
  category: string
  icon: string
  icon_color: string
  title: string
  excerpt: string
  read_min: number
  views: number
  featured: boolean
  helpful_yes: number
  helpful_no: number
  tags: string[]
  order_in_category: number
  updated_at: string
}

export interface RawGuideFaq {
  id: string
  question: string
  answer: string
  order_num: number
}

export default async function GuidePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [articlesRes, faqsRes] = await Promise.all([
    supabase
      .from('guide_articles')
      .select('id, slug, category, icon, icon_color, title, excerpt, read_min, views, featured, helpful_yes, helpful_no, tags, order_in_category, updated_at')
      .eq('status', 'published')
      .order('category')
      .order('order_in_category'),
    supabase
      .from('guide_faqs')
      .select('id, question, answer, order_num')
      .order('order_num'),
  ])

  return (
    <Suspense fallback={null}>
      <GuideClient
        initialArticles={(articlesRes.data ?? []) as RawGuideArticle[]}
        initialFaqs={(faqsRes.data ?? []) as RawGuideFaq[]}
      />
    </Suspense>
  )
}
