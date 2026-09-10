import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { dispatchProductSubscriptionEvent, type ProductWebhookEvent } from '@/lib/product-webhooks'

const schema=z.object({action:z.enum(['created','canceled','renewed','renewal','paused','reactivated','overdue','recovered']),next_billing_at:z.string().datetime().optional()})
const eventMap:Record<string,ProductWebhookEvent>={created:'subscription_created',canceled:'subscription_canceled',renewed:'subscription_renewed',renewal:'subscription_renewal',paused:'subscription_paused',reactivated:'subscription_reactivated',overdue:'subscription_overdue',recovered:'subscription_recovered'}
const statusMap:Record<string,string>={created:'active',canceled:'canceled',paused:'paused',reactivated:'active',overdue:'unpaid',recovered:'active'}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const{id}=await params,supabase=await createClient(),{data:{user}}=await supabase.auth.getUser()
 if(!user)return NextResponse.json({error:'Não autorizado.'},{status:401})
 const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Evento inválido.'},{status:400})
 const patch:Record<string,unknown>={updated_at:new Date().toISOString()};const status=statusMap[parsed.data.action];if(status)patch.status=status;if(parsed.data.next_billing_at)patch.next_billing_at=parsed.data.next_billing_at;if(parsed.data.action==='canceled')patch.canceled_at=new Date().toISOString()
 const{data,error}=await supabase.from('product_subscriptions').update(patch).eq('id',id).eq('producer_id',user.id).select('id').maybeSingle()
 if(error)return NextResponse.json({error:error.message},{status:500});if(!data)return NextResponse.json({error:'Assinatura não encontrada.'},{status:404})
 await dispatchProductSubscriptionEvent(id,eventMap[parsed.data.action]);return NextResponse.json({ok:true,event:eventMap[parsed.data.action]})
}
