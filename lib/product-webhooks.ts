import { createHmac } from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'

type ProductRow={id:string;short_id:string;name:string;support_email:string;payment_type:string;invoice_description:string;subscription_period:number;webhook_url:string|null;webhook_secret:string}

/** Envia o contrato público de integração SaaS de um produto. Nunca lança erro. */
export async function dispatchProductPurchaseApproved(transactionId:string):Promise<void>{
 try{
  const admin=createAdminClient()
  const{data:tx}=await admin.from('transactions').select('id,product_id,checkout_id,customer_name,customer_email,customer_phone,customer_cpf,product_name,amount,net,fee,status,gateway,created_at,updated_at,utm_source,utm_medium,utm_campaign').eq('id',transactionId).maybeSingle()
  if(!tx?.product_id)return
  const{data:product}=await admin.from('products').select('id,short_id,name,support_email,payment_type,invoice_description,subscription_period,webhook_url,webhook_secret').eq('id',tx.product_id).maybeSingle() as {data:ProductRow|null}
  if(!product?.webhook_url)return
  const paidAt=new Date().toISOString()
  const payload={
   secret:product.webhook_secret,event:'purchase_approved',data:{
    id:tx.id,refId:tx.id.slice(0,7),customer:{name:tx.customer_name,email:tx.customer_email,phone:tx.customer_phone??null,docNumber:tx.customer_cpf??null,birthDate:null,docType:(tx.customer_cpf?.replace(/\D/g,'').length===14?'cnpj':'cpf')},
    address:null,shipping:null,affiliate:null,offer:{id:product.short_id,name:product.name,price:Number(tx.amount),image:null},offer_type:'main',
    product:{name:product.name,id:product.id,short_id:product.short_id,supportEmail:product.support_email,type:product.payment_type,invoiceDescription:product.invoice_description},
    checkout:tx.checkout_id,subscription:null,subscription_period:product.subscription_period,parent_order:null,checkoutUrl:null,status:'paid',baseAmount:Number(tx.amount),discount:0,amount:Number(tx.amount),
    commissions:[{user:null,totalAmount:Number(tx.net),type:'producer',percentage:Number(tx.amount)>0?Math.round(Number(tx.net)/Number(tx.amount)*10000)/100:100}],fees:Number(tx.fee),couponCode:null,reason:null,refund_reason:null,installments:1,paymentMethod:tx.gateway,paymentMethodName:tx.gateway,paidAt,createdAt:tx.created_at,due_date:null,refundedAt:null,chargedbackAt:null,canceledAt:null,utm_source:tx.utm_source,utm_medium:tx.utm_medium,utm_campaign:tx.utm_campaign,utm_term:null,utm_content:null,sck:null,fbc:null,fbp:null,card:null,
   }
  }
  const body=JSON.stringify(payload),signature='sha256='+createHmac('sha256',product.webhook_secret).update(body).digest('hex')
  const response=await fetch(product.webhook_url,{method:'POST',headers:{'Content-Type':'application/json','X-Umbra-Event':'purchase_approved','X-Umbra-Signature-256':signature,'User-Agent':'Umbra-Bot-Product-Webhook/1.0'},body,signal:AbortSignal.timeout(10000)})
  if(!response.ok)throw new Error(`Product webhook returned ${response.status}`)
 }catch(error){Sentry.captureException(error,{extra:{transactionId,context:'product_purchase_webhook'}})}
}
