import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchProductTransactionEvent } from '@/lib/product-webhooks'

export async function GET(request:Request){
 if(request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:'Não autorizado.'},{status:401})
 const admin=createAdminClient(),cutoff=new Date(Date.now()-30*60*1000).toISOString()
 const{data,error}=await admin.from('transactions').select('id').eq('status','pending').not('product_id','is',null).lt('created_at',cutoff).limit(200)
 if(error)return NextResponse.json({error:error.message},{status:500})
 await Promise.allSettled((data??[]).map(row=>dispatchProductTransactionEvent(row.id,'checkout_abandoned')))
 return NextResponse.json({processed:data?.length??0})
}
