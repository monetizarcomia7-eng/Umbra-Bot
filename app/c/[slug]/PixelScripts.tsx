'use client'

import { useEffect, useRef } from 'react'

export interface PublicPixelConfig {
  provider:  'meta' | 'tiktok' | 'google'
  pixelId:   string
  pixelCode: string | null // TikTok Pixel Code (distinto do Advertiser ID)
}

interface PixelScriptsProps {
  pixels:      PublicPixelConfig[]
  step:        'form' | 'payment' | 'success' | 'upsell' | 'error'
  price:       number
  productName: string
}

/* ─── Helpers ──────────────────────────────────────────────── */

// Injeta um <script src="..."> no head de forma idempotente
function loadScript(src: string, id: string, onLoad?: () => void) {
  if (document.getElementById(id)) { onLoad?.(); return }
  const s   = document.createElement('script')
  s.id      = id
  s.src     = src
  s.async   = true
  if (onLoad) s.onload = onLoad
  document.head.appendChild(s)
}

// ── Meta Pixel ──────────────────────────────────────────────
function initMeta(pixelId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  if (!w.fbq) {
    // Base code do Meta Pixel (minificado)
    w.fbq = function (...a: unknown[]) {
      w.fbq.callMethod ? w.fbq.callMethod(...a) : w.fbq.queue.push(a)
    }
    if (!w._fbq) w._fbq = w.fbq
    w.fbq.push = w.fbq; w.fbq.loaded = true; w.fbq.version = '2.0'; w.fbq.queue = []
    loadScript('https://connect.facebook.net/en_US/fbevents.js', 'meta-fbevents')
  }
  w.fbq('init', pixelId)
  w.fbq('track', 'PageView')
}

function trackMeta(event: string, params?: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fbq = (window as any).fbq
  if (typeof fbq === 'function') fbq('track', event, params)
}

// ── TikTok Pixel ────────────────────────────────────────────
// Injeta o base code do TikTok como script inline para evitar
// incompatibilidade de tipos com o SDK dinâmico do TikTok
function initTikTok(pixelCode: string) {
  if (document.getElementById('tiktok-base')) {
    // Já inicializado — apenas registra o pixel code
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ttq = (window as any).ttq
    if (ttq) { ttq.load(pixelCode); ttq.page() }
    return
  }
  const s    = document.createElement('script')
  s.id       = 'tiktok-base'
  s.innerHTML = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(n,a)};ttq.load("${pixelCode}");ttq.page()}(window,document,"ttq");`
  document.head.appendChild(s)
}

function trackTikTok(event: string, params?: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ttq = (window as any).ttq
  if (ttq && typeof ttq.track === 'function') ttq.track(event, params)
}

// ── Google (GA4) ────────────────────────────────────────────
function initGoogle(measurementId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  if (!w.gtag) {
    w.dataLayer = w.dataLayer ?? []
    w.gtag = function (...args: unknown[]) { w.dataLayer.push(args) }
    w.gtag('js', new Date())
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${measurementId}`, `gtag-${measurementId}`)
  }
  w.gtag('config', measurementId)
}

function trackGoogle(event: string, params?: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gtag = (window as any).gtag
  if (typeof gtag === 'function') gtag('event', event, params)
}

/* ─── Component ────────────────────────────────────────────── */

export default function PixelScripts({ pixels, step, price, productName }: PixelScriptsProps) {
  const initializedRef = useRef(false)
  const prevStepRef    = useRef<string>('')

  // Inicializa todos os pixels na montagem (PageView)
  useEffect(() => {
    if (initializedRef.current || pixels.length === 0) return
    initializedRef.current = true

    for (const px of pixels) {
      try {
        if (px.provider === 'meta')   initMeta(px.pixelId)
        if (px.provider === 'tiktok') initTikTok(px.pixelCode ?? px.pixelId)
        if (px.provider === 'google') initGoogle(px.pixelId)
      } catch { /* não bloqueia o checkout em caso de erro */ }
    }
  }, [pixels])

  // Rastreia mudanças de etapa
  useEffect(() => {
    if (prevStepRef.current === step) return
    const prev = prevStepRef.current
    prevStepRef.current = step

    if (!initializedRef.current || pixels.length === 0) return

    if (step === 'payment' && prev === 'form') {
      // Comprador iniciou o checkout (clicou em Pagar)
      for (const px of pixels) {
        try {
          if (px.provider === 'meta')
            trackMeta('InitiateCheckout', { value: price, currency: 'BRL', content_name: productName })
          if (px.provider === 'tiktok')
            trackTikTok('InitiateCheckout', { value: price, currency: 'BRL', content_name: productName })
          if (px.provider === 'google')
            trackGoogle('begin_checkout', { value: price, currency: 'BRL', items: [{ item_name: productName }] })
        } catch { /* silencioso */ }
      }
    }

    if (step === 'success' || step === 'upsell') {
      // Pagamento confirmado
      for (const px of pixels) {
        try {
          if (px.provider === 'meta')
            trackMeta('Purchase', { value: price, currency: 'BRL', content_name: productName })
          if (px.provider === 'tiktok')
            trackTikTok('CompletePayment', { value: price, currency: 'BRL', content_name: productName })
          if (px.provider === 'google')
            trackGoogle('purchase', { value: price, currency: 'BRL', transaction_id: Date.now().toString(), items: [{ item_name: productName, price }] })
        } catch { /* silencioso */ }
      }
    }
  }, [step, pixels, price, productName])

  return null // componente puramente imperativo
}
