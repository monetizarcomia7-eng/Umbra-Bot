import { createHmac } from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'

export type ProductWebhookEvent='boleto_generated'|'pix_generated'|'purchase_approved'|'purchase_rejected'|'refund'|'chargeback'|'subscription_canceled'|'subscription_renewed'|'checkout_abandoned'|'picpay_generated'|'nubank_generated'|'subscription_created'|'subscription_renewal'|'subscription_reactivated'|'subscription_paused'|'subscription_overdue'|'subscription_recovered'
type ProductRow={id:string;user_id:string;short_id:string;name:string;support_email:string;payment_type:string;invoice_description:string;subscription_period:number;webhook_url:string|null;webhook_secret:string;webhook_events:string[]}

/** Envia o contrato público de integração SaaS de um produto. Nunca lança erro. */
export async function dispatchProductPurchaseApproved(transactionId:string):Promise<void>{
 return dispatchProductTransactionEvent(transactionId,'purchase_approved')
}

export async function dispatchProductTransactionEvent(transactionId:string,event:ProductWebhookEvent):Promise<void>{
 try{
  const admin=createAdminClient()
  const{data:tx}=await admin.from('transactions').select('id,product_id,offer_id,checkout_id,customer_name,customer_email,customer_phone,customer_cpf,product_name,amount,net,fee,status,gateway,created_at,updated_at,utm_source,utm_medium,utm_campaign').eq('id',transactionId).maybeSingle()
  if(!tx?.product_id)return
  const{data:product}=await admin.from('products').select('id,user_id,short_id,name,support_email,payment_type,invoice_description,subscription_period,webhook_url,webhook_secret,webhook_events').eq('id',tx.product_id).maybeSingle() as {data:ProductRow|null}
  if(!product?.webhook_url||!product.webhook_events.includes(event))return
  const {data:delivered}=await admin.from('product_webhook_deliveries').select('id').eq('product_id',product.id).eq('event_type',event).eq('resource_id',tx.id).eq('success',true).limit(1).maybeSingle()
  if(delivered)return
  const {data:offer}=tx.offer_id?await admin.from('product_offers').select('id,name,price,payment_type,subscription_period').eq('id',tx.offer_id).maybeSingle():{data:null}
  const paidAt=new Date().toISOString(),paymentType=offer?.payment_type??product.payment_type,period=offer?.subscription_period??product.subscription_period
  const payload={
   secret:product.webhook_secret,event,data:{
    id:tx.id,refId:tx.id.slice(0,7),customer:{name:tx.customer_name,email:tx.customer_email,phone:tx.customer_phone??null,docNumber:tx.customer_cpf??null,birthDate:null,docType:(tx.customer_cpf?.replace(/\D/g,'').length===14?'cnpj':'cpf')},
    address:null,shipping:null,affiliate:null,offer:{id:offer?.id??product.short_id,name:offer?.name??product.name,price:Number(tx.amount),image:null},offer_type:'main',
    product:{name:product.name,id:product.id,short_id:product.short_id,supportEmail:product.support_email,type:paymentType,invoiceDescription:product.invoice_description},
    checkout:tx.checkout_id,subscription:null,subscription_period:period,parent_order:null,checkoutUrl:null,status:'paid',baseAmount:Number(tx.amount),discount:0,amount:Number(tx.amount),
    commissions:[{user:null,totalAmount:Number(tx.net),type:'producer',percentage:Number(tx.amount)>0?Math.round(Number(tx.net)/Number(tx.amount)*10000)/100:100}],fees:Number(tx.fee),couponCode:null,reason:null,refund_reason:null,installments:1,paymentMethod:tx.gateway,paymentMethodName:tx.gateway,paidAt,createdAt:tx.created_at,due_date:null,refundedAt:null,chargedbackAt:null,canceledAt:null,utm_source:tx.utm_source,utm_medium:tx.utm_medium,utm_campaign:tx.utm_campaign,utm_term:null,utm_content:null,sck:null,fbc:null,fbp:null,card:null,
   }
  }
  const body=JSON.stringify(payload),signature='sha256='+createHmac('sha256',product.webhook_secret).update(body).digest('hex')
  for(let attempt=1;attempt<=3;attempt++){
   let responseStatus:number|null=null,responseBody='',success=false
   try{const response=await fetch(product.webhook_url,{method:'POST',headers:{'Content-Type':'application/json','X-Umbra-Event':event,'X-Umbra-Signature-256':signature,'X-Umbra-Retry':String(attempt-1),'User-Agent':'Umbra-Bot-Product-Webhook/1.0'},body,signal:AbortSignal.timeout(10000)});responseStatus=response.status;responseBody=(await response.text()).slice(0,2000);success=response.ok}catch(error){responseBody=error instanceof Error?error.message:'Erro de conexão'}
   await admin.from('product_webhook_deliveries').insert({product_id:product.id,user_id:product.user_id,event_type:event,resource_id:tx.id,payload,response_status:responseStatus,response_body:responseBody,attempt,success})
   if(success)return
   if(attempt<3)await new Promise(resolve=>setTimeout(resolve,attempt*1000))
  }
  throw new Error(`Product webhook failed after 3 attempts: ${event}`)
 }catch(error){Sentry.captureException(error,{extra:{transactionId,context:'product_purchase_webhook'}})}
}

export async function dispatchProductSubscriptionEvent(subscriptionId:string,event:ProductWebhookEvent):Promise<void>{
 try{
  const admin=createAdminClient()
  const{data:subscription}=await admin.from('product_subscriptions').select('id,product_id,producer_id,customer_name,customer_email,status,gross_amount,net_amount,gateway,gateway_subscription_id,started_at,next_billing_at,canceled_at,ended_at').eq('id',subscriptionId).maybeSingle()
  if(!subscription)return
  const{data:product}=await admin.from('products').select('id,user_id,name,short_id,webhook_url,webhook_secret,webhook_events').eq('id',subscription.product_id).maybeSingle()
  if(!product?.webhook_url||!(product.webhook_events as string[]).includes(event))return
  const{data:delivered}=await admin.from('product_webhook_deliveries').select('id').eq('product_id',product.id).eq('event_type',event).eq('resource_id',subscription.id).eq('success',true).limit(1).maybeSingle();if(delivered)return
  const payload={secret:product.webhook_secret,event,data:{id:subscription.id,customer:{name:subscription.customer_name,email:subscription.customer_email},product:{id:product.id,short_id:product.short_id,name:product.name},subscription:{id:subscription.id,gatewayId:subscription.gateway_subscription_id,status:subscription.status,startedAt:subscription.started_at,nextBillingAt:subscription.next_billing_at,canceledAt:subscription.canceled_at,endedAt:subscription.ended_at},status:subscription.status,amount:Number(subscription.gross_amount),netAmount:Number(subscription.net_amount),gateway:subscription.gateway}}
  const body=JSON.stringify(payload),signature='sha256='+createHmac('sha256',product.webhook_secret).update(body).digest('hex')
  for(let attempt=1;attempt<=3;attempt++){let responseStatus:number|null=null,responseBody='',success=false;try{const response=await fetch(product.webhook_url,{method:'POST',headers:{'Content-Type':'application/json','X-Umbra-Event':event,'X-Umbra-Signature-256':signature,'X-Umbra-Retry':String(attempt-1),'User-Agent':'Umbra-Bot-Product-Webhook/1.0'},body,signal:AbortSignal.timeout(10000)});responseStatus=response.status;responseBody=(await response.text()).slice(0,2000);success=response.ok}catch(error){responseBody=error instanceof Error?error.message:'Erro de conexão'}await admin.from('product_webhook_deliveries').insert({product_id:product.id,user_id:product.user_id,event_type:event,resource_id:subscription.id,payload,response_status:responseStatus,response_body:responseBody,attempt,success});if(success)return;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,attempt*1000))}
  throw new Error(`Subscription webhook failed: ${event}`)
 }catch(error){Sentry.captureException(error,{extra:{subscriptionId,event,context:'product_subscription_webhook'}})}
}
