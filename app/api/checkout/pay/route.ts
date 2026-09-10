import { NextResponse, type NextRequest } from 'next/server'
import { z }                  from 'zod'
import { createAdminClient }  from '@/lib/supabase/admin'
import { decryptToken }       from '@/lib/crypto'
import { rateLimit }          from '@/lib/rate-limit'
import { fireCapiPurchase }   from '@/lib/capi'
import { verifyRecaptchaToken } from '@/lib/recaptcha'
import * as Sentry            from '@sentry/nextjs'
import { dispatchProductTransactionEvent } from '@/lib/product-webhooks'

/* ─── Validation ─────────────────────────────────────────── */

function detectDevice(ua: string | null): 'mobile' | 'desktop' | 'tablet' | 'unknown' {
  if (!ua) return 'unknown'
  const u = ua.toLowerCase()
  if (/tablet|ipad|playbook|silk/.test(u)) return 'tablet'
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/.test(u)) return 'mobile'
  if (/mozilla|chrome|safari|firefox|msie|trident/.test(u)) return 'desktop'
  return 'unknown'
}

function validateCPF(digits: string): boolean {
  if (/^(\d)\1{10}$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i)
  let rem = (sum * 10) % 11
  if (rem >= 10) rem = 0
  if (rem !== parseInt(digits[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i)
  rem = (sum * 10) % 11
  if (rem >= 10) rem = 0
  return rem === parseInt(digits[10])
}

function validateCNPJ(digits: string): boolean {
  if (/^(\d)\1{13}$/.test(digits)) return false
  const calc = (n: string, w: number[]) => {
    const rem = w.reduce((s, v, i) => s + parseInt(n[i]) * v, 0) % 11
    return rem < 2 ? 0 : 11 - rem
  }
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2]
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2]
  return calc(digits, w1) === parseInt(digits[12]) && calc(digits, w2) === parseInt(digits[13])
}

const paySchema = z.object({
  checkout_id:    z.string().uuid('checkout_id inválido.'),
  customer_name:  z.string().min(2,  'Nome deve ter ao menos 2 caracteres.').max(150),
  customer_email: z.string().email('E-mail inválido.'),
  // Aceita CPF (11 dígitos) ou CNPJ (14 dígitos) com validação de dígito verificador
  customer_cpf:   z.string()
                   .transform((v) => v.replace(/\D/g, ''))
                   .pipe(
                     z.string().refine(
                       (v) => {
                         if (v.length === 11) return validateCPF(v)
                         if (v.length === 14) return validateCNPJ(v)
                         return false
                       },
                       'CPF ou CNPJ inválido.',
                     ),
                   ),
  customer_phone: z.string().max(20).nullish(),
  method:         z.enum(['pix', 'card', 'boleto']),
  utm_source:     z.string().max(100).nullish(),
  utm_medium:     z.string().max(100).nullish(),
  utm_campaign:   z.string().max(100).nullish(),
  coupon_code:    z.string().max(50).nullish(),
  order_bump:     z.boolean().nullish(),
  recaptcha_token: z.string().nullish(),
})

/* ─── POST /api/checkout/pay ─────────────────────────────── */
// Endpoint público (sem auth de usuário) — usa admin client para buscar
// as credenciais do dono do checkout e criar um pagamento PIX via MP.

export async function POST(request: NextRequest) {
  // Rate limit por IP: 20 req/min — previne abuso sem bloquear compradores legítimos
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = await rateLimit(`checkout_pay:${ip}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde um momento e tente novamente.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  let rawBody: unknown
  try { rawBody = await request.json() } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const parsed = paySchema.safeParse(rawBody)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Dados inválidos.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const {
    checkout_id, customer_name, customer_email, customer_cpf,
    customer_phone, method, utm_source, utm_medium, utm_campaign,
    coupon_code, order_bump, recaptcha_token,
  } = parsed.data

  /* ── 0. Verifica reCAPTCHA ─────────────────────────────── */
  if (recaptcha_token) {
    const captchaOk = await verifyRecaptchaToken(recaptcha_token)
    if (!captchaOk) {
      return NextResponse.json(
        { error: 'Verificação de segurança falhou. Recarregue a página e tente novamente.' },
        { status: 400 },
      )
    }
  }

  // Apenas PIX está implementado; cartão e boleto requerem integração adicional
  if (method !== 'pix') {
    return NextResponse.json(
      { error: 'Pagamento por cartão e boleto ainda não disponível neste checkout. Use o Pix.' },
      { status: 400 },
    )
  }

  const customerPhone  = customer_phone ?? null
  const docType        = customer_cpf.length === 14 ? 'CNPJ' : 'CPF'
  const customerDevice = detectDevice(request.headers.get('user-agent'))

  const admin = createAdminClient()

  /* ── 1. Busca checkout + dono ──────────────────────────── */
  const { data: checkout } = await admin
    .from('checkouts')
    .select('id, user_id, product_id, offer_id, product_name, price, installments, gateway, methods, order_bump')
    .eq('id', checkout_id)
    .eq('status', 'published')
    .maybeSingle()

  if (!checkout) {
    return NextResponse.json({ error: 'Checkout não encontrado ou não publicado.' }, { status: 404 })
  }

  const methods = (checkout.methods ?? {}) as Record<string, boolean>
  if (!methods[method]) {
    return NextResponse.json({ error: `Método "${method}" não disponível neste checkout.` }, { status: 400 })
  }

  /* ── 1b. Valida cupom e aplica desconto (incrementa uses) ── */
  let discountAmount = 0

  const couponCodeClean = coupon_code?.trim().toUpperCase() ?? null
  if (couponCodeClean) {
    const { data: couponResult, error: couponError } = await admin
      .rpc('validate_and_apply_coupon', {
        p_user_id: checkout.user_id,
        p_code:    couponCodeClean,
        p_price:   Number(checkout.price),
      })

    if (couponError) {
      Sentry.captureException(couponError, { extra: { checkout_id, context: 'validate_and_apply_coupon' } })
    } else if (couponResult?.valid) {
      discountAmount = Number(couponResult.discount ?? 0)
    }
    // Cupom inválido/expirado: ignora silenciosamente (preview já exibiu o erro)
  }

  /* ── 1c. Calcula preço efetivo (cupom + order bump) ─────── */
  const basePrice  = Math.max(0, Number(checkout.price) - discountAmount)
  const bumpData   = order_bump
    ? (checkout.order_bump as { price: number } | null)
    : null
  const bumpPrice  = bumpData ? Number(bumpData.price ?? 0) : 0
  const totalPrice = basePrice + bumpPrice

  /* ── 2. Busca gateway do dono ──────────────────────────── */
  const { data: gateway } = await admin
    .from('gateways')
    .select('credentials')
    .eq('user_id', checkout.user_id)
    .eq('provider', checkout.gateway)
    .eq('connected', true)
    .maybeSingle()

  let accessToken: string | null = null

  if (gateway?.credentials) {
    const rawToken = (gateway.credentials as Record<string, unknown>).token
    if (rawToken && typeof rawToken === 'string') {
      accessToken = decryptToken(rawToken)
    }
  }

  // Fallback para variável de ambiente global (ambiente de desenvolvimento/demo)
  if (!accessToken) {
    accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN ?? null
  }

  if (!accessToken) {
    return NextResponse.json({ error: 'Gateway de pagamento não configurado.' }, { status: 503 })
  }

  /* ── 3. Cria pagamento PIX no Mercado Pago ─────────────── */
  const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'Authorization':   `Bearer ${accessToken}`,
      'X-Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      transaction_amount: totalPrice,
      description:        checkout.product_name,
      payment_method_id:  'pix',
      payer: {
        email:      customer_email,
        first_name: customer_name.split(' ')[0],
        last_name:  customer_name.split(' ').slice(1).join(' ') || '',
        identification: { type: docType, number: customer_cpf },
      },
    }),
  })

  if (!mpRes.ok) {
    const mpErr = await mpRes.json().catch(() => ({}))
    Sentry.captureException(
      new Error(`checkout_pay MP error: ${mpErr.message ?? mpRes.status}`),
      { extra: { checkout_id, status: mpRes.status, body: mpErr } },
    )
    return NextResponse.json(
      { error: mpErr.message ?? 'Erro no gateway de pagamento. Tente novamente.' },
      { status: 502 },
    )
  }

  const mpData  = await mpRes.json()
  const pixInfo = mpData.point_of_interaction?.transaction_data
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  const fee = totalPrice * 0.0099
  const net = totalPrice - fee

  /* ── 4. Persiste transação ─────────────────────────────── */
  const { data: transaction, error: txError } = await admin
    .from('transactions')
    .insert({
      user_id:            checkout.user_id,
      checkout_id:        checkout.id,
      product_id:         checkout.product_id ?? null,
      offer_id:           checkout.offer_id ?? null,
      gateway:            checkout.gateway,
      gateway_payment_id: String(mpData.id),
      amount:             totalPrice,
      fee,
      net,
      type:               'sale',
      payment_method:     method,
      status:             'pending',
      pix_qr_code:        pixInfo?.qr_code_base64 ?? null,
      pix_copy_paste:     pixInfo?.qr_code ?? null,
      pix_expires_at:     expiresAt,
      product_name:       checkout.product_name,
      customer_name,
      customer_email,
      customer_cpf,
      customer_phone:     customerPhone,
      customer_device:    customerDevice,
      utm_source:         utm_source ?? null,
      utm_medium:         utm_medium ?? null,
      utm_campaign:       utm_campaign ?? null,
    })
    .select('id')
    .single()

  if (txError) {
    Sentry.captureException(txError, { extra: { checkout_id, context: 'checkout_pay_tx_insert' } })
    return NextResponse.json({ error: 'Erro ao registrar transação.' }, { status: 500 })
  }

  if (transaction?.id) await dispatchProductTransactionEvent(transaction.id, 'pix_generated')

  /* ── 5. Registra evento 'cart_added' no funil (fire-and-forget) ─ */
  admin.from('checkout_events').insert({
    user_id:     checkout.user_id,
    checkout_id: checkout.id,
    event_type:  'cart_added',
    product_name: checkout.product_name,
    utm_source:   utm_source ?? null,
    utm_medium:   utm_medium ?? null,
    utm_campaign: utm_campaign ?? null,
  }).then(({ error }) => {
    if (error) Sentry.captureException(error, { extra: { checkout_id, txId: transaction?.id, context: 'checkout_pay_event' } })
  })

  /* ── 6. CAPI fire-and-forget (se aprovado via webhook) ─── */
  // O CAPI real é disparado no webhook do MP ao confirmar status='approved'.

  return NextResponse.json({
    transaction_id: transaction?.id,
    pix_qr_code:    pixInfo?.qr_code_base64,
    pix_copy_paste: pixInfo?.qr_code,
    expires_at:     expiresAt,
    amount:         totalPrice,
  })
}
