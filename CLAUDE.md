# CLAUDE.md — Umbra Bot

Contexto automático para sessões de desenvolvimento. Atualizar sempre que o projeto evoluir.

---

## 1. REGRAS ABSOLUTAS

- **NUNCA** renomear para "Pulso", "Pulso.bot" ou qualquer outro nome — sempre **"Umbra Bot"** / **"umbra.bot"**
- Todo texto visível ao usuário em **Português (Brasil)**
- Só fazer o que foi explicitamente pedido — sem features extras, sem refactor não solicitado

---

## 2. ESTRUTURA ATUAL

```
umbra-bot/
├── app/
│   ├── layout.tsx                # Root layout (ThemeProvider + PostHog + Analytics)
│   ├── page.tsx                  # Redirect para /dashboard
│   ├── globals.css               # Design tokens (light/dark), Tailwind v4
│   ├── (auth)/
│   │   ├── login/page.tsx        # Login com Supabase Auth
│   │   └── register/page.tsx     # Registro com email + senha
│   ├── auth/callback/route.ts    # Callback de confirmação de email
│   ├── api/
│   │   ├── telegram/
│   │   │   ├── webhook/route.ts  # Recebe updates do Telegram
│   │   │   └── register/route.ts # Registra webhook no Telegram
│   │   ├── payments/
│   │   │   ├── pix/route.ts      # Cria pagamento PIX (Mercado Pago)
│   │   │   └── mercadopago-webhook/route.ts # Confirma pagamento
│   │   ├── push/
│   │   │   ├── subscribe/route.ts
│   │   │   └── notify/route.ts
│   │   ├── broadcasts/send/route.ts
│   │   └── migrations/route.ts   # Protegida por ADMIN_EMAIL
│   └── dashboard/
│       ├── page.tsx              # Overview (KPIs + gráfico — dados mock)
│       ├── bots/                 # Gerenciar bots (mock)
│       ├── finance/              # Financeiro + CSV export (mock)
│       ├── activity/             # Feed de eventos (mock)
│       ├── customers/            # Clientes + CSV export (mock)
│       ├── analytics/            # Análises (mock)
│       ├── alerts/               # Alertas (mock)
│       ├── affiliates/           # Afiliados (mock)
│       ├── flows/                # Fluxos de venda (placeholder)
│       ├── redirects/            # Redirecionadores (mock)
│       ├── remarketing/          # Remarketing (mock)
│       ├── broadcasts/           # Disparador (mock)
│       ├── tools/                # Ferramentas (mock)
│       ├── gateways/             # Gateways (mock)
│       ├── tracking/             # Trackeamento (mock)
│       ├── checkout/             # Checkout (mock)
│       ├── biolink/              # Bio Link (mock)
│       ├── webhooks/             # Webhooks (mock)
│       ├── profile/              # Perfil + avatar upload (funcional)
│       ├── notifications/        # Notificações (mock)
│       ├── guide/                # Guia da plataforma (mock)
│       └── academy/              # Academia (mock)
├── components/
│   └── dashboard/
│       ├── Layout.tsx            # Shell (Sidebar + Topbar + service worker)
│       ├── Sidebar.tsx           # Navegação colapsável (260px / 80px)
│       ├── Topbar.tsx            # Busca + notificações + usuário real
│       ├── PageHeader.tsx
│       └── Button.tsx
├── hooks/
│   ├── use-analytics.ts          # PostHog events tipados
│   ├── use-keyboard-shortcuts.ts # ⌘K, b, f, c, a, ?
│   └── use-mobile.ts
├── lib/
│   ├── utils.ts                  # cn()
│   ├── rate-limit.ts             # Redis (Upstash) + fallback memória
│   ├── analytics-server.ts       # PostHog server-side capture
│   ├── csv.ts                    # exportCSV()
│   └── supabase/
│       ├── server.ts             # createClient() para Server Components / API Routes
│       └── client.ts             # createClient() para Client Components
├── providers/
│   └── PostHogProvider.tsx       # PostHog init + pageview tracking
├── public/
│   └── sw.js                     # Service Worker para Web Push
├── supabase/migrations/          # 23 migrações SQL (000 a 023)
├── sentry.*.config.ts            # Sentry (client / server / edge)
├── instrumentation.ts            # Next.js hook para Sentry server
├── middleware.ts                 # Auth guard + security headers
└── .env.example                  # Todas as variáveis documentadas
```

---

## 3. STACK

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 15.x |
| UI | React | 19.x |
| Linguagem | TypeScript (strict) | 5.x |
| Banco | Supabase (PostgreSQL + Auth + Storage) | — |
| Estilo | Tailwind CSS v4 | 4.x |
| Animações | Motion (Framer) | 12.x |
| Gráficos | Recharts | 3.x |
| Ícones | Lucide React | — |
| Tema | next-themes | — |
| Rate limit | @upstash/redis (prod) / Map in-memory (dev) | — |
| Monitoring | Sentry + PostHog + Vercel Analytics | — |
| Pagamentos | Mercado Pago (PIX) | — |
| Push | web-push (VAPID) | — |

---

## 4. ARQUITETURA ATUAL

```
Browser
  └─► Next.js (App Router, Vercel)
        ├── app/(auth)/          ← login, registro (Supabase Auth)
        ├── app/dashboard/       ← 24 páginas (maioria com dados mock)
        ├── app/api/             ← 8 route handlers implementados
        └── middleware.ts        ← auth guard + security headers

Next.js API Routes
  ├── Supabase (PostgreSQL + RLS)  ← banco real, 23 tabelas
  ├── Upstash Redis                ← rate limiting distribuído
  ├── Mercado Pago                 ← PIX payments
  ├── Telegram Bot API             ← webhooks
  └── web-push (VAPID)            ← notificações push
```

---

## 5. ESTADO DO PROJETO

| Área | Estado |
|---|---|
| UI Shell (sidebar, topbar, layout, tema) | ✅ Completo |
| Dark mode (light/dark/system) | ✅ Completo |
| Autenticação (login, registro, sessão, logout) | ✅ Funcional |
| Middleware (auth guard + security headers) | ✅ Funcional |
| Callback de email | ✅ Funcional |
| Upload de avatar | ✅ Funcional (Supabase Storage) |
| Seletor de período no Dashboard | ✅ Funcional |
| CSV export (Financeiro + Clientes) | ✅ Funcional |
| Atalhos de teclado | ✅ Funcional |
| Webhook Telegram | ✅ Implementado (não testado em prod) |
| PIX via Mercado Pago | ✅ Implementado |
| Webhook MP (confirmação de pagamento) | ✅ Implementado |
| Broadcasts (disparador em massa) | ✅ Implementado |
| Web Push (VAPID) | ✅ Implementado |
| Rate limiting (Upstash Redis + fallback) | ✅ Funcional |
| Sentry (error monitoring) | ✅ Configurado (requer DSN) |
| PostHog (product analytics) | ✅ Configurado (requer chave) |
| Vercel Analytics + Speed Insights | ✅ Ativo |
| Schema do banco (23 tabelas) | ✅ Migrações SQL criadas |
| RLS em todas as tabelas | ✅ Configurado |
| Dashboard com dados reais | ❌ Ainda mock |
| Onboarding wizard | ❌ Não iniciado |
| Sistema de planos/billing | ❌ Não iniciado |
| Editor de fluxos de venda | ❌ Não iniciado |
| Afiliados (funcional) | ❌ Não iniciado |
| Reset de senha (/forgot-password) | ❌ Link existe, página não |
| Testes (unit/e2e) | ❌ Não iniciado |
| CI/CD | ❌ Não iniciado |

---

## 6. VARIÁVEIS DE AMBIENTE

Obrigatórias para funcionamento básico:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
APP_URL
```

Para produção completa, ver `.env.example` — todas as variáveis estão documentadas lá.

---

## 7. CONVENÇÕES

- Path alias `@/*` → raiz do projeto
- Tailwind v4 com design tokens via CSS variables em `globals.css`
- Tema: `data-theme` attribute, gerenciado por `next-themes`
- `cn()` em `lib/utils.ts` para class merging
- ESLint habilitado no build (`ignoreDuringBuilds: false`)
- TypeScript strict (`ignoreBuildErrors: false`)
- Rate limit: usar sempre `await rateLimit(key, limit, windowMs)` — função é assíncrona
- Analytics server-side: `await captureEvent(userId, eventName, props)` de `lib/analytics-server`
- Analytics client-side: `const { track } = useAnalytics()` de `hooks/use-analytics`
