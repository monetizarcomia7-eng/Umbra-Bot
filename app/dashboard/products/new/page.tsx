import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductEditor from '../ProductEditor'

export default async function NewProductPage(){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');const{data:checkouts}=await supabase.from('checkouts').select('id,name,product_id').eq('user_id',user.id).order('name');return <ProductEditor userId={user.id} checkouts={checkouts??[]}/>}
