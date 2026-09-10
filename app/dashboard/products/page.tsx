import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductsClient from './ProductsClient'

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [products, partnerships, subscriptions] = await Promise.all([
    supabase.from('products').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
    supabase.from('product_partnerships').select('*, products(name)').or(`producer_id.eq.${user.id},partner_id.eq.${user.id}`).order('created_at', { ascending: false }),
    supabase.from('product_subscriptions').select('*, products(name)').eq('producer_id', user.id).order('started_at', { ascending: false }),
  ])

  return <ProductsClient userId={user.id} initialProducts={products.data ?? []} partnerships={partnerships.data ?? []} subscriptions={subscriptions.data ?? []} />
}
