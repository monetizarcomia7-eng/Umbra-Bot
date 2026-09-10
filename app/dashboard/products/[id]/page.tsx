import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductEditor from '../ProductEditor'

export default async function EditProductPage({params}:{params:Promise<{id:string}>}){const{id}=await params;const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');const[product,checkouts,partners]=await Promise.all([supabase.from('products').select('*').eq('id',id).eq('user_id',user.id).maybeSingle(),supabase.from('checkouts').select('id,name,product_id').eq('user_id',user.id).order('name'),supabase.from('product_partnerships').select('id,partner_email,role,commission_pct,status,expires_at').eq('product_id',id).eq('producer_id',user.id)]);if(!product.data)notFound();return <ProductEditor userId={user.id} initial={product.data} checkouts={checkouts.data??[]} partners={partners.data??[]}/>}
