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
│   ├── layout.tsx                # Root layout (ThemeProvider + PostHog + Analytics + ServiceWorkerRegistrar)
│   ├── ServiceWorkerRegistrar.tsx # Registra SW uma única vez no root (não no Layout)
│   ├── page.tsx                  # Redirect para /dashboard
│   ├── globals.css               # Design tokens (light/dark), Tailwind v4
│   ├── actions/
│   │   └── bots.ts               # Server Action: salva bot com token criptografado (AES-256-GCM)
│   │                             # userId lido do servidor via supabase.auth.getUser() — sem IDOR
│   ├── (auth)/
│   │   ├── login/page.tsx        # Login com email + Google OAuth
│   │   ├── register/page.tsx     # Registro com email + Google OAuth
│   │   └── forgot-password/page.tsx  # Recuperação de senha
│   ├── auth/
│   │   ├── callback/route.ts     # Callback OAuth + dispara user_registered
│   │   └── reset-password/page.tsx   # Redefinição de senha (via link do e-mail)
│   ├── api/
│   │   ├── telegram/
│   │   │   ├── webhook/route.ts  # Recebe updates do Telegram (descriptografa token)
│   │   │   └── register/route.ts # Registra webhook no Telegram
│   │   ├── payments/
│   │   │   ├── pix/route.ts      # Cria pagamento PIX (Mercado Pago) + Sentry + analytics
│   │   │   └── mercadopago-webhook/route.ts # Confirma pagamento (valida secret em prod)
│   │   ├── withdrawals/
│   │   │   └── route.ts          # POST: solicita saque (auth + zod + rate limit 5/h + Sentry)
│   │   ├── bank-accounts/
│   │   │   ├── route.ts          # GET: lista contas; POST: cria conta (zod + Sentry)
│   │   │   └── [id]/route.ts     # DELETE: remove conta (verifica user_id)
│   │   ├── admin/
│   │   │   └── migrate-tokens/route.ts  # POST: re-encripta tokens legados (ADMIN_MIGRATION_SECRET)
│   │   ├── cron/
│   │   │   └── process-withdrawals/route.ts  # GET: processa saques pendentes (CRON_SECRET, horário)
│   │   ├── push/
│   │   │   ├── subscribe/route.ts
│   │   │   └── notify/route.ts
│   │   ├── broadcasts/send/route.ts
│   │   └── migrations/route.ts   # Protegida por ADMIN_EMAIL
│   └── dashboard/
│       ├── page.tsx              # Overview — KPIs reais + deltas vs período anterior + gráfico + top produtos
│       ├── bots/                 # Gerenciar bots (mock)
│       ├── finance/              # Financeiro — Server Component + módulo finance/
│       ├── activity/             # Feed de eventos (mock)
│       ├── customers/            # Clientes + CSV export com analytics (mock)
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
│       ├── profile/              # Perfil + avatar upload (funcional + analytics)
│       ├── notifications/        # Notificações (mock)
│       ├── guide/                # Guia da plataforma (mock)
│       └── academy/              # Academia (mock)
├── components/
│   └── dashboard/
│       ├── Layout.tsx            # Shell: DashboardProvider → LayoutShell (Sidebar + Topbar)
│       ├── Sidebar.tsx           # Navegação colapsável (260px / 80px) + badge via DashboardProvider
│       ├── Topbar.tsx            # Busca global (14 tabelas, race-condition safe) + notif + user
│       ├── OnboardingWizard.tsx  # Modal 4 passos (welcome→bot→gateway→done) — aparece 1x
│       ├── PageHeader.tsx
│       ├── Button.tsx
│       └── finance/              # Módulo completo do Financeiro (10 arquivos)
│           ├── types.ts          # Transaction, Withdrawal, Invoice, BankAccount, RawTransaction, RawWithdrawal
│           ├── formatters.ts     # fmtBRL, fmtBRLdec, fmtDate, fmtDateTime, fmtTime, fmtPct
│           ├── constants.ts      # txTypeMap, txStatusMap, wdStatusMap, invStatusMap, filtros
│           ├── mock-data.ts      # financeMock (faturas mock; contas bancárias agora são reais)
│           ├── atoms.tsx         # Icon, Badge, Card, Tabs, Modal, Dropdown, Btn, Spinner, etc.
│           ├── FinanceDashboard.tsx  # Componente raiz (client) — seletor de período 7d/30d/90d/Tudo
│           ├── TransactionsSection.tsx # Tabela com filtros, paginação e detalhe expandível
│           ├── WithdrawalsSection.tsx  # Tabela de saques (filtrada pelo período selecionado)
│           ├── InvoicesSection.tsx     # Tabela de faturas
│           └── WithdrawModal.tsx       # Modal multi-step: self-fetch de bank_accounts, add/delete inline
├── hooks/
│   ├── use-analytics.ts          # PostHog events tipados (14 eventos)
│   ├── use-keyboard-shortcuts.ts # ⌘K, b, f, c, a, ?
│   └── use-mobile.ts
├── lib/
│   ├── utils.ts                  # cn()
│   ├── crypto.ts                 # encryptToken / decryptToken — AES-256-GCM para tokens de bot
│   ├── telegram.ts               # sendTelegramMessage() — centralizado (usado em 2 webhooks)
│   ├── rate-limit.ts             # Redis (Upstash) + fallback memória
│   ├── analytics-server.ts       # PostHog server-side capture
│   ├── csv.ts                    # exportCSV()
│   └── supabase/
│       ├── server.ts             # createClient() para Server Components / API Routes
│       └── client.ts             # createClient() para Client Components
├── providers/
│   ├── PostHogProvider.tsx       # PostHog init + pageview tracking
│   └── DashboardProvider.tsx     # Contexto global: user, alerts, botsCount, logout — 1 fetch
├── public/
│   └── sw.js                     # Service Worker para Web Push
├── supabase/migrations/          # 27 migrações SQL (000 a 026)
├── vercel.json                   # Cron job: /api/cron/process-withdrawals a cada hora
├── sentry.*.config.ts            # Sentry (client com Replay / server com tracePropagation)
├── instrumentation.ts            # Next.js hook para Sentry server
├── middleware.ts                 # Auth guard + security headers + CSP (unsafe-eval só em dev)
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
| Validação | Zod v4 | 4.x |
| Rate limit | @upstash/redis (prod) / Map in-memory (dev) | — |
| Monitoring | Sentry + PostHog + Vercel Analytics | — |
| Pagamentos | Mercado Pago (PIX) | — |
| Push | web-push (VAPID) | — |

---

## 4. ARQUITETURA ATUAL

```
Browser
  └─► Next.js (App Router, Vercel)
        ├── app/(auth)/          ← login, registro, forgot-password (Supabase Auth + Google OAuth)
        ├── app/auth/            ← callback OAuth, reset-password
        ├── app/dashboard/       ← 24 páginas (várias com dados reais)
        ├── app/api/             ← 12 route handlers implementados
        └── middleware.ts        ← auth guard + security headers + CSP

Next.js API Routes
  ├── Supabase (PostgreSQL + RLS)  ← banco real, 27 tabelas
  ├── Upstash Redis                ← rate limiting distribuído
  ├── Mercado Pago                 ← PIX payments
  ├── Telegram Bot API             ← webhooks
  └── web-push (VAPID)            ← notificações push
```

### DashboardProvider — estado compartilhado

```
app/layout.tsx
  └── DashboardProvider (providers/DashboardProvider.tsx)
        ├── user: { id, name, email, initials, plan }
        ├── alerts: AlertRow[]            ← tabela alerts
        ├── botsCount: number | null      ← tabela bots
        ├── markAllAlertsRead()           ← update DB + limpa estado local
        ├── refreshBotsCount()            ← re-fetch após onboarding
        └── logout()                      ← signOut + reset PostHog + redirect /login

DashboardLayout (components/dashboard/Layout.tsx)
  └── LayoutShell
        ├── Sidebar   ← usa alertCount do provider (sem fetch próprio)
        ├── Topbar    ← usa user, alerts, logout do provider (sem fetch próprio)
        └── {children}
```

**Regra:** `useDashboard()` só pode ser chamado em componentes que são **filhos** de `DashboardLayout`. Nunca no mesmo componente que renderiza o `DashboardLayout`.

---

## 5. ESTADO DO PROJETO

| Área | Estado |
|---|---|
| UI Shell (sidebar, topbar, layout, tema) | ✅ Completo |
| Dark mode (light/dark/system) | ✅ Completo |
| Autenticação email (login, registro, sessão, logout) | ✅ Funcional |
| Login com Google (OAuth) | ✅ Funcional |
| Recuperação de senha (/forgot-password + /reset-password) | ✅ Funcional |
| Middleware (auth guard + security headers + CSP) | ✅ Funcional |
| Callback OAuth + evento user_registered | ✅ Funcional |
| Upload de avatar + evento avatar_updated | ✅ Funcional (Supabase Storage) |
| Onboarding wizard (4 passos, aparece só 1x por usuário) | ✅ Funcional |
| Dashboard KPIs reais (receita, vendas, bots ativos) | ✅ Funcional |
| Dashboard KPI deltas (variação % vs período anterior) | ✅ Funcional |
| Dashboard gráfico real (receita por dia do banco) | ✅ Funcional |
| Dashboard top produtos reais (agrupado por product_name) | ✅ Funcional |
| Seletor de período no Dashboard (7d/30d/90d) + cache useRef | ✅ Funcional |
| DashboardProvider (contexto global, 1 fetch para user+alerts+bots) | ✅ Funcional |
| Financeiro com dados reais do banco (Server Component) | ✅ Funcional |
| Financeiro — módulo componentizado (10 arquivos) | ✅ Completo |
| Financeiro — seletor de período (7d/30d/90d/Tudo) | ✅ Funcional |
| Financeiro — filtros, paginação, exportação CSV (filtrada por período) | ✅ Funcional |
| Modal de saque com API real (/api/withdrawals) | ✅ Funcional |
| Contas bancárias reais no modal de saque (bank_accounts) | ✅ Funcional |
| CRUD de contas bancárias (GET/POST/DELETE /api/bank-accounts) | ✅ Implementado |
| CSV export (Financeiro + Clientes) + evento csv_exported | ✅ Funcional |
| Atalhos de teclado | ✅ Funcional |
| Busca global (14 tabelas, race-condition safe, sem any) | ✅ Funcional |
| Notificações reais (tabela alerts) | ✅ Funcional |
| Plano real (tabela profiles) na topbar | ✅ Funcional |
| Badge de alertas dinâmico na sidebar | ✅ Funcional |
| Links do dropdown do usuário (Perfil, Configurações, Suporte) | ✅ Funcional |
| Logout funcional (via DashboardProvider) | ✅ Funcional |
| Criptografia AES-256-GCM de tokens de bot (lib/crypto.ts) | ✅ Implementado |
| Webhook Telegram (descriptografa token) | ✅ Implementado (não testado em prod) |
| PIX via Mercado Pago + Sentry + analytics | ✅ Implementado |
| Webhook MP (valida secret em prod, descriptografa token) | ✅ Implementado |
| Tabela withdrawals + API /api/withdrawals (zod + Sentry) | ✅ Implementado |
| Cron job para processar saques pendentes (vercel.json, horário) | ✅ Implementado |
| Broadcasts (disparador em massa) | ✅ Implementado |
| Web Push (VAPID) | ✅ Implementado |
| Rate limiting (Upstash Redis + fallback) | ✅ Funcional |
| Sentry (client Replay + server tracePropagation + captureException) | ✅ Configurado |
| PostHog (14 eventos rastreados) | ✅ Configurado |
| Vercel Analytics + Speed Insights | ✅ Ativo |
| Schema do banco (27 tabelas) | ✅ Migrações SQL criadas e aplicadas |
| RLS em todas as tabelas | ✅ Configurado |
| Content-Security-Policy (CSP sem unsafe-eval em produção) | ✅ Configurado no middleware |
| Sistema de planos/billing | ❌ Não iniciado |
| Editor de fluxos de venda | ❌ Não iniciado |
| Afiliados (funcional) | ❌ Não iniciado |
| Bots — CRUD real | ❌ Ainda mock |
| Gateways — configuração real de credenciais | ❌ Ainda mock |
| Clientes — dados reais do banco | ❌ Ainda mock |
| Testes (unit/e2e) | ❌ Não iniciado |
| CI/CD | ❌ Não iniciado |

---

## 6. ANALYTICS — EVENTOS RASTREADOS

| Evento | Onde é disparado |
|---|---|
| `user_registered` | `app/auth/callback/route.ts` (primeiro login) |
| `bot_connected` | disponível no EventMap |
| `gateway_connected` | `OnboardingWizard` — GatewayStep |
| `onboarding_step_completed` | `OnboardingWizard` — cada transição de passo |
| `onboarding_completed` | `OnboardingWizard` — ao finalizar |
| `pix_payment_created` | `app/api/payments/pix/route.ts` |
| `csv_exported` | `FinanceDashboard` e `customers/page.tsx` |
| `avatar_updated` | `dashboard/profile/page.tsx` |
| `broadcast_sent` | disponível no EventMap |
| `flow_created` | disponível no EventMap |
| `plan_upgraded` | disponível no EventMap |

---

## 7. ONBOARDING WIZARD

- Aparece **apenas uma vez** para novos usuários (0 bots cadastrados)
- Controle via `localStorage`: chave `umbra_onboarding_seen_${userId}`
- Passos: `welcome → bot → gateway → done`
- Bot salvo via **Server Action** `app/actions/bots.ts` (token criptografado antes de persistir)
- Gateway salvo na tabela `gateways`
- Ao fechar ou completar, seta a flag no localStorage e chama `refreshBotsCount()`

---

## 8. BUSCA GLOBAL (Topbar)

- Mínimo 2 caracteres para disparar
- Debounce de 300ms
- 14 tabelas consultadas em paralelo via `Promise.allSettled`
- **Race condition protegida:** `searchVersionRef` (contador incremental) — resposta descartada se versão não corresponde
- **Sem `any`:** 14 interfaces tipadas por tabela (BotRow, ContactRow, TxRow, etc.) + helper genérico `ok<T>()`
- Máximo 2 resultados por categoria (3 para artigos)
- Tabelas: bots, contacts, transactions, flows, broadcasts, redirects, remarketing_campaigns, affiliates, gateways, biolinks, webhooks, guide_articles, courses, alerts
- Fecha ao clicar fora ou pressionar Escape

---

## 9. SEGURANÇA

### Criptografia de tokens de bot

- **`lib/crypto.ts`**: `encryptToken(plain)` / `decryptToken(value)`
- Algoritmo: AES-256-GCM, chave 32 bytes via `BOT_TOKEN_ENCRYPTION_KEY` (64-char hex)
- Formato no banco: `enc:<iv_hex>:<tag_hex>:<ciphertext_hex>`
- Backward compatible: se o valor não começa com `enc:`, retorna como está (tokens legados)
- Gerar chave: `openssl rand -hex 32`
- Migração de tokens legados: `POST /api/admin/migrate-tokens` (protegida por `ADMIN_MIGRATION_SECRET`)

### Webhook Mercado Pago

- Sem `MERCADOPAGO_WEBHOOK_SECRET` em **produção** → retorna 401 (bloqueia tudo)
- Sem `MERCADOPAGO_WEBHOOK_SECRET` em **dev** → permite (skip verificação)

### CSP (Content-Security-Policy)

- Configurado em `middleware.ts` via `buildCsp()`
- `unsafe-eval` incluído **apenas em dev** (Next.js HMR) — removido em produção
- Cobre: `default-src 'self'`, scripts, styles, imagens, fontes, conexões (Supabase, PostHog, Mercado Pago, Telegram, Vercel)

### IDOR prevention

- `saveBotAction` lê `userId` do servidor via `supabase.auth.getUser()` — nunca do cliente
- APIs de bank-accounts validam `user_id` em todas as operações (select + delete com `.eq('user_id', user.id)`)

---

## 10. MÓDULO FINANCEIRO

### Fluxo de dados

```
FinancePage (Server Component)
  └── busca transactions (limit 500) + withdrawals (limit 200) em paralelo
  └── passa como initialTransactions / initialWithdrawals

FinanceDashboard (Client Component)
  ├── period state: '7d' | '30d' | '90d' | 'all'  (default: '30d')
  ├── filteredTxs = transactions filtradas por period (client-side)
  ├── filteredWds = withdrawals filtradas por period (client-side)
  ├── summary cards = sempre ALL-TIME (saldo correto independente do período)
  └── CSV export usa dados filtrados pelo período ativo

WithdrawModal (Client Component — sem props de contas)
  ├── self-fetch de GET /api/bank-accounts ao abrir
  ├── permite adicionar nova conta inline (label + tipo + chave)
  ├── permite deletar conta com botão hover (DELETE /api/bank-accounts/[id])
  └── POST /api/withdrawals com account_id e account_label reais
```

### Tabela bank_accounts

```sql
-- migration 026
id, user_id, label, pix_key, kind ('pix'|'conta'|'ted'), created_at
RLS: usuário vê/gerencia apenas as próprias contas
```

---

## 11. DASHBOARD KPIs — DELTAS

O dashboard (`app/dashboard/page.tsx`) faz 3 queries em paralelo ao mudar o período:

1. Transactions aprovadas do **período atual** (ex: últimos 30d)
2. Contagem de bots ativos
3. Transactions aprovadas do **período anterior** (ex: 30–60d atrás)

Delta calculado: `((atual - anterior) / anterior) * 100`, formatado como `+12.4%` ou `-5.2%`.
- Receita e Vendas mostram o badge colorido
- Taxa de conversão e Bots ativos ficam sem delta (dados insuficientes para comparação)
- Resultados cacheados por período via `useRef` — não re-fetcha ao alternar 7d/30d/90d

---

## 12. VARIÁVEIS DE AMBIENTE

Obrigatórias para funcionamento básico:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
APP_URL
BOT_TOKEN_ENCRYPTION_KEY   # 64-char hex — gerar: openssl rand -hex 32
```

Para produção completa, ver `.env.example` — todas as variáveis estão documentadas lá.

Variáveis adicionais documentadas (além do básico):
- `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_WEBHOOK_SECRET`
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET` — protege `GET /api/cron/process-withdrawals`
- `ADMIN_MIGRATION_SECRET` — protege `POST /api/admin/migrate-tokens`
- `ADMIN_EMAIL` — protege `GET /api/migrations`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL`
- `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`
- `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`

---

## 13. CONVENÇÕES

- Path alias `@/*` → raiz do projeto
- Tailwind v4 com design tokens via CSS variables em `globals.css`
- Tema: `data-theme` attribute, gerenciado por `next-themes`
- `cn()` em `lib/utils.ts` para class merging (usa `tailwind-merge` + `clsx`)
- ESLint habilitado no build (`ignoreDuringBuilds: false`)
- TypeScript strict (`ignoreBuildErrors: false`)
- **Zod v4**: usar `error:` (não `invalid_type_error:`) e `.issues` (não `.errors`) em `ZodError`
- Rate limit: usar sempre `await rateLimit(key, limit, windowMs)` — função é assíncrona
- Analytics server-side: `await captureEvent(userId, eventName, props)` de `lib/analytics-server`
- Analytics client-side: `const { track } = useAnalytics()` de `hooks/use-analytics`
- Sentry server: `Sentry.captureException(err, { extra: {...} })` nos paths de erro críticos
- Tokens de bot: sempre usar `encryptToken()` ao salvar e `decryptToken()` ao usar
- `sendTelegramMessage()` centralizado em `lib/telegram.ts` — não duplicar em route handlers
- `useDashboard()` só pode ser chamado dentro de filhos de `DashboardLayout` — nunca no componente que renderiza o próprio `DashboardLayout`
