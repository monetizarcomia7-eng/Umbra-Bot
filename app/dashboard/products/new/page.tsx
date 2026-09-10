import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductEditor from '../ProductEditor'

export default async function NewProductPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <ProductEditor userId={user.id} />
}
