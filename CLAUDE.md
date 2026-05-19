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
│   │   │   └── route.ts          # POST: solicita saque (auth + zod + rate limit 3/dia + IP + Sentry)
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
│   │   ├── finance/
│   │   │   ├── balance/route.ts  # GET: saldo fresco via RPC finance_summary (usado pelo WithdrawModal)
│   │   │   └── transactions/route.ts # GET: paginação "carregar mais" (?offset=N, limit 500)
│   │   ├── checkout/
│   │   │   └── track/route.ts    # POST: registra eventos de funil (visited/cart_added/payment_initiated)
│   │   │                         # Público (sem auth), CORS *, rate-limit 60/min por IP
│   │   │                         # Usa RPC track_checkout_event (security definer, migração 041)
│   │   └── migrations/route.ts   # Protegida por ADMIN_EMAIL
│   └── dashboard/
│       ├── page.tsx              # Server Component async — busca KPIs 30d no servidor, passa initialData ao DashboardClient
│       ├── _components/
│       │   └── DashboardClient.tsx  # Client Component — KPIs reais + deltas + gráfico + top produtos
│       ├── bots/                 # Gerenciar bots (mock)
│       ├── finance/              # Financeiro — Server Component + módulo finance/
│       ├── activity/             # Feed de eventos (mock)
│       ├── customers/            # Clientes + CSV export com analytics (mock)
│       ├── analytics/            # Análises — dados reais do Supabase (arquitetura modular)
│       │   ├── page.tsx          # Server Component: filtros SQL, bots/flows no Promise.all principal, paralelismo total
│       │   ├── AnalyticsClient.tsx # Client Component fino (~130 linhas): useTransition + router.replace + PostHog
│       │   ├── _types.ts         # Tipos compartilhados: Period, Filters, AnalyticsSummary, etc.
│       │   ├── _utils.ts         # Formatadores (fmtBRL, fmtNum, fmtPct) + getDateRange + PERIOD_LABELS
│       │   ├── _actions.ts       # Server Action: getExportRows(filters) — CSV export sob demanda
│       │   ├── _server.ts        # Funções de computação Node.js-only: computeFunnel, computeByBot, etc.
│       │   └── _components/      # 5 componentes isolados
│       │       ├── FilterBar.tsx     # Barra com 5 selects + toggle Comparar + Limpar
│       │       ├── FunnelChart.tsx   # Funil 4 etapas + conv. total + deltas de período
│       │       ├── BarListCard.tsx   # Genérico <T>: bot | produto | fluxo | UTM
│       │       ├── StatusCard.tsx    # Pizza Recharts — distribuição por status
│       │       └── CohortTable.tsx   # Coorte semanal S0–S5 com heatmap color-mix
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
│           ├── types.ts          # Transaction, Withdrawal, Invoice, BankAccount, RawTransaction,
│           │                     # RawWithdrawal, RawFinanceBot, RawFinanceFlow, RawInvoice, RawFinanceSummary
│           ├── formatters.ts     # fmtBRL, fmtBRLdec, fmtDate, fmtDateTime, fmtTime, fmtPct
│           │                     # — todos com timeZone: 'America/Sao_Paulo'
│           ├── constants.ts      # txTypeMap, txStatusMap, wdStatusMap, invStatusMap, filtros
│           ├── mock-data.ts      # financeMock (faturas mock fallback; contas bancárias são reais)
│           ├── atoms.tsx         # Icon, Badge, Card, Tabs, Modal, Dropdown, Btn, Spinner, etc.
│           ├── FinanceDashboard.tsx  # Componente raiz (client) — seletor de período 7d/30d/90d/Tudo
│           │                         # buildLiveData: deltas reais, TxDetail real, invoices reais/mock
│           ├── TransactionsSection.tsx # Tabela com filtros, paginação e detalhe expandível real
│           ├── WithdrawalsSection.tsx  # Tabela de saques (filtrada pelo período selecionado)
│           ├── InvoicesSection.tsx     # Tabela de faturas (reais quando billing ativo)
│           └── WithdrawModal.tsx       # Modal multi-step: self-fetch de bank_accounts, add/delete inline
│                                       # maskPixKey: oculta meio da chave PIX para privacidade
├── hooks/
│   ├── use-analytics.ts          # PostHog events tipados (19 eventos: inclui finance + analytics events)
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
├── supabase/migrations/          # 46 migrações SQL (000 a 045)
├── vercel.json                   # Cron job: /api/cron/process-withdrawals todo dia às 06:00 UTC (Hobby: 1x/dia)
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
  ├── Supabase (PostgreSQL + RLS)  ← banco real, 30 tabelas
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
| Análises — módulo modular: filtros SQL server-side, coorte via RPC, cliente fino | ✅ Funcional |
| Análises — checkout_events populado (cart_added via PIX, paid via MP, conversation_started via TG) | ✅ Implementado |
| Análises — transactions gravando UTM + flow_id (aceitos no POST /api/payments/pix) | ✅ Implementado |
| Análises — flows com user_id + RLS correta (migração 021 + 040) | ✅ Implementado |
| Análises — endpoint público POST /api/checkout/track para evento visited (migração 041) | ✅ Implementado |
| Análises — monitoramento: analytics_filter_changed + analytics_cohort_error + csv_exported com period | ✅ Implementado |
| Análises — flows RLS urgente corrigida (migração 040) + upsert flows/page.tsx inclui user_id | ✅ Implementado |
| Análises — contacts: SELECT count(*) head:true (zero rows transferidas) | ✅ Implementado |
| Análises — exportRows via Server Action getExportRows() — removido do AnalyticsSummary (zero KB no RSC) | ✅ Implementado |
| Análises — dropdowns: RPC analytics_filter_options SELECT DISTINCT (migração 042) | ✅ Implementado |
| Análises — bots e flows: queries no Promise.all principal (sem cache — incompatível com cookies()) | ✅ Implementado |
| Análises — todas as queries disparam em paralelo (prev criadas antes do await do main) | ✅ Implementado |
| Financeiro com dados reais do banco (Server Component) | ✅ Funcional |
| Financeiro — módulo componentizado (10 arquivos) | ✅ Completo |
| Financeiro — seletor de período (7d/30d/90d/Tudo) | ✅ Funcional |
| Financeiro — filtros, paginação, exportação CSV (filtrada por período) | ✅ Funcional |
| Modal de saque com API real (/api/withdrawals) | ✅ Funcional |
| Contas bancárias reais no modal de saque (bank_accounts) | ✅ Funcional |
| CRUD de contas bancárias (GET/POST/DELETE /api/bank-accounts) | ✅ Implementado |
| Financeiro — formatadores com fuso horário America/Sao_Paulo | ✅ Implementado |
| Financeiro — saldo correto (aprovadas − saques pending+completed) | ✅ Implementado |
| Financeiro — deltas reais (período atual vs anterior, calculado client-side) | ✅ Implementado |
| Financeiro — detalhe expansível com dados reais (customer, gateway, bot, flow, UTM) | ✅ Implementado |
| Financeiro — tabela invoices real + fallback mock enquanto billing não existe (migração 043) | ✅ Implementado |
| Financeiro — 5 eventos PostHog: withdrawal_requested, bank_account_added/deleted, finance_tab/period_changed | ✅ Implementado |
| Financeiro — maskPixKey: oculta meio da chave PIX no modal de saque | ✅ Implementado |
| Financeiro — tratamento de erro ao deletar conta bancária (deleteError state) | ✅ Implementado |
| Financeiro — router.refresh() após saque aprovado (dados atualizados sem reload) | ✅ Implementado |
| Financeiro — queries paralelas: 6 em Promise.all (tx + wd + bots + flows + invoices + RPC summary) | ✅ Implementado |
| Financeiro — RPC finance_summary: KPI cards sempre precisos via profiles.balance (migration 045) | ✅ Implementado |
| Financeiro — transactions.type ('sale'|'fee'|'commission'|'refund') — migration 044 | ✅ Implementado |
| Financeiro — withdrawals.notes: motivo de falha exibido abaixo do badge — migration 044 | ✅ Implementado |
| Financeiro — withdrawals/route.ts usa profiles.balance (trigger atômico) em vez de full scan | ✅ Implementado |
| Financeiro — auditoria P1: split memo mapRawRows (sem period) + buildPeriodSummary (com period) | ✅ Implementado |
| Financeiro — paginação P2: botão "Carregar mais" via GET /api/finance/transactions?offset=N | ✅ Implementado |
| Financeiro — status corretos P3: expired→Expirado, cancelled→Cancelado, refunded→Falhou | ✅ Implementado |
| Financeiro — payment_method P5: coluna no banco (mig 047) + METHOD_LABEL no front | ✅ Implementado |
| Financeiro — cron P6: filtra payout_tx_id IS NULL + salva processed_by='cron' (mig 048) | ✅ Implementado |
| Financeiro — rate limit P7: saques 3/dia (era 5/hora) + captura requester_ip | ✅ Implementado |
| Financeiro — saldo fresco P8: WithdrawModal busca GET /api/finance/balance ao abrir | ✅ Implementado |
| Financeiro — transactions.net corrigido de GENERATED→coluna normal (mig 046) | ✅ Implementado |
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
| PostHog (19 eventos rastreados) | ✅ Configurado |
| Vercel Analytics + Speed Insights | ✅ Ativo |
| Schema do banco (28 tabelas — inclui invoices, migration 043) | ✅ Migrações SQL criadas e aplicadas no Supabase |
| RLS em todas as tabelas | ✅ Configurado (flows corrigida na migração 040) |
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
| `csv_exported` | `FinanceDashboard`, `customers/page.tsx` e `AnalyticsClient.tsx` — inclui campo `period` |
| `avatar_updated` | `dashboard/profile/page.tsx` |
| `broadcast_sent` | disponível no EventMap |
| `flow_created` | disponível no EventMap |
| `plan_upgraded` | disponível no EventMap |
| `analytics_filter_changed` | `AnalyticsClient.tsx` — toda mudança de filtro ou Limpar (period, compare, bot, produto, fluxo, UTM) |
| `analytics_cohort_error` | `analytics/page.tsx` (server-side via `captureEvent`) — erro na RPC de coorte |
| `withdrawal_requested` | `WithdrawModal.tsx` — ao confirmar saque (inclui amount + account_kind) |
| `bank_account_added` | `WithdrawModal.tsx` — ao adicionar nova conta bancária (inclui kind) |
| `bank_account_deleted` | `WithdrawModal.tsx` — ao remover conta bancária |
| `finance_tab_changed` | `FinanceDashboard.tsx` — ao trocar entre Transações / Saques / Faturas |
| `finance_period_changed` | `FinanceDashboard.tsx` — ao mudar período (7d / 30d / 90d / Tudo) |

---

## 7. ONBOARDING WIZARD

- Aparece **apenas uma vez** para novos usuários (0 bots cadastrados)
- Controle via `localStorage`: chave `umbra_onboarding_seen_${userId}`
- Passos: `welcome → bot → gateway → done`
- Bot salvo via **Server Action** `app/actions/bots.ts` (token criptografado antes de persistir)
- Gateway salvo na tabela `gateways`
- Ao fechar ou completar, seta a flag no localStorage e chama `refreshBotsCount()`

### Step Gateway — credenciais reais

- Mapa `GATEWAY_CREDENTIAL` no componente: define `label`, `placeholder` e `help` por gateway
- Ao selecionar um gateway, exibe campo `<input type="password">` para o token/access key
- Se preenchido: salva `credentials: { token }` + `status: 'active'`
- Se pulado/vazio: salva `credentials: {}` + `status: 'pending'`
- Trocar de gateway limpa o campo de credencial
- Gateways suportados: `pushinpay`, `mercadopago`, `pagarme`, `stripe`

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

### Flows RLS (migração 040)

- **Vulnerabilidade corrigida:** tabela `flows` criada com `using (true)` → qualquer usuário autenticado via Supabase SDK direto podia ler fluxos de outros
- **Fix:** migração 040 adiciona `user_id uuid references auth.users(id)` + policy `flows_owner (auth.uid() = user_id)` — reforça migração 021
- **Código:** `saveFlow()` em `app/dashboard/flows/page.tsx` inclui `user_id: user.id` no upsert (sem isso o INSERT seria bloqueado pelo `with check` pós-migração)
- **SQL consolidado:** `supabase/migrations/_pending_analytics_037_to_041.sql` — contém migrações 037–045 prontas para rodar no Supabase SQL Editor

---

## 10. MÓDULO FINANCEIRO

### Fluxo de dados

```
FinancePage (Server Component)
  └── Promise.all com 6 queries em paralelo:
        ├── transactions (limit 500): id, amount, net, fee, status, type, product_name,
        │   customer_name, customer_email, gateway, bot_id, flow_id, utm_source, utm_campaign, created_at
        ├── withdrawals  (limit 200): id, amount, account_id, account_label, status, created_at, concluded_at, notes
        ├── bots: id, name, username
        ├── flows: id, name (limit 100)
        ├── invoices: id, period, value, due_date, status, created_at (limit 24)
        └── RPC finance_summary(uid): saldo_disponivel, a_liberar, total_recebido, comissoes_plataforma
  └── passa como 6 props: initialTransactions / initialWithdrawals / initialBots / initialFlows
                           / initialInvoices / initialSummary

FinanceDashboard (Client Component)
  ├── period state: '7d' | '30d' | '90d' | 'all'  (default: '30d')
  ├── allRawTxs state: acumula rows iniciais + carregamentos adicionais
  ├── hasMore state: true enquanto houver mais rows a carregar
  ├── Memo A — mapRawRows (SEM dependência de period — roda só quando rows/bots/flows mudam):
  │     ├── botMap / flowMap para lookup O(1) de nomes por id
  │     ├── transaction.type lido do banco (mig 044); fallback: heurística por status
  │     │     'fee' | 'commission' → tipos diretos; isRefund → 'refund'; default → 'sale'
  │     ├── status mapping correto: approved→available, pending→pending, expired→expired,
  │     │     cancelled→cancelled, refunded/cancelled→failed
  │     ├── TxDetail: method via payment_method (mig 047) + METHOD_LABEL; fallback 'Pix'
  │     │     customer_name, customer_email, gateway (GATEWAY_LABEL), bot_id→nome, flow_id→nome,
  │     │     utm_source, utm_campaign
  │     └── invoices: rawInvoices.length > 0 → dados reais; senão financeMock.invoices (fallback)
  ├── Memo B — buildPeriodSummary (COM dependência de period — só roda ao trocar período):
  │     ├── summary cards — usa dbSummary (RPC) quando disponível:
  │     │     saldoDisponivel = profiles.balance (trigger atômico, sempre preciso)
  │     │     aLiberar / totalRecebido / comissoesPlataforma = SUM() no banco (sem limite de rows)
  │     │     Fallback se RPC falhar: computa dos rows carregados
  │     └── deltas reais: compara período atual vs anterior
  │           pct(cur, prev) = prev > 0 ? round(((cur-prev)/prev)*1000)/10 : 0
  ├── filteredTxs = txRows filtradas por period (useMemo)
  ├── filteredWds = wdRows filtradas por period (useMemo)
  ├── banner hasMore: mostra quantidade carregada + botão "Carregar mais →"
  │     → GET /api/finance/transactions?offset=N → acumula em allRawTxs
  ├── CSV export usa dados filtrados pelo período ativo (inclui campo period no evento PostHog)
  │     — saques incluem coluna "Observação" (withdrawal.notes)
  ├── handleTabChange → track('finance_tab_changed', { tab })
  ├── handlePeriodChange → track('finance_period_changed', { period })
  └── handleWithdrawalSuccess → setModalOpen(false) + router.refresh()

WithdrawModal (Client Component — sem props de contas)
  ├── self-fetch de GET /api/bank-accounts ao abrir
  ├── self-fetch de GET /api/finance/balance ao abrir → saldo sempre fresco
  │     displayBalance = liveBalance ?? saldoDisponivel (fallback para prop stale)
  │     subtitle exibe "Verificando saldo…" enquanto carrega
  ├── maskPixKey(key): exibe primeiros 4 + '•••' + últimos 4 para privacidade
  ├── permite adicionar nova conta inline (label + tipo + chave)
  │     → track('bank_account_added', { kind })
  ├── permite deletar conta com botão hover (DELETE /api/bank-accounts/[id])
  │     → verifica res.ok antes de remover do state; deleteError state para feedback
  │     → track('bank_account_deleted', {})
  ├── POST /api/withdrawals com account_id e account_label reais
  │     → track('withdrawal_requested', { amount, account_kind })
  └── step 'success': botão "Fechar" chama onSuccess (→ router.refresh()) não onClose
```

### GATEWAY_LABEL — mapeamento de IDs para nomes legíveis

```typescript
const GATEWAY_LABEL: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  pushinpay:   'Pushinpay',
  pagarme:     'Pagar.me',
  stripe:      'Stripe',
}
```

### Tabela bank_accounts

```sql
-- migration 026
id, user_id, label, pix_key, kind ('pix'|'conta'|'ted'), created_at
RLS: usuário vê/gerencia apenas as próprias contas
```

### Novas colunas — migration 044

```sql
-- transactions.type: distingue a natureza da transação
alter table public.transactions
  add column if not exists type text not null default 'sale'
    check (type in ('sale', 'fee', 'commission', 'refund'));
-- Persistido pelo pix/route.ts com type='sale' em toda nova transação PIX
-- Futuro: cron pode inserir type='fee' ou 'commission' para lançamentos internos

-- withdrawals.notes: motivo de falha ou observação do admin
alter table public.withdrawals
  add column if not exists notes text;
-- Exibido abaixo do badge de status em saques falhos no WithdrawalsSection
-- O cron (process-withdrawals) pode preencher ao marcar status='failed'
```

### Função finance_summary — migration 045

```sql
create or replace function public.finance_summary(p_user_id uuid)
returns json language sql stable security invoker set search_path = public
-- Retorna: { saldo_disponivel, a_liberar, total_recebido, comissoes_plataforma }
-- saldo_disponivel = profiles.balance (mantido por triggers da mig 029, atômico)
-- Demais = SUM() de transactions aprovadas/pending — sem limite de rows
-- grant execute to authenticated
```

- Chamada via `supabase.rpc('finance_summary', { p_user_id: uid })` no `FinancePage`
- Resolve o problema dos KPI cards ficarem errados quando usuário tem >500 transações
- `profiles.balance` é atualizado por triggers `sync_balance_on_transaction` e
  `sync_balance_on_withdrawal` a cada INSERT/UPDATE/DELETE — nunca desatualizado

### /api/withdrawals — uso de profiles.balance

```typescript
// ANTES (2 queries sem limite → lento; problema se >500 txs no client)
const [balanceResult, wdResult] = await Promise.all([
  supabase.from('transactions').select('net, amount, fee').eq('user_id', user.id).eq('status', 'approved'),
  supabase.from('withdrawals').select('amount').eq('user_id', user.id).in('status', [...]),
])
const available = totalApproved - totalWithdrawn

// DEPOIS (1 leitura de profiles.balance — trigger garante precisão)
const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
const available = Math.max(0, Number(profile?.balance ?? 0))
```

### Tabela invoices (migração 043)

```sql
-- Rodar no Supabase SQL Editor (inclusa em _pending_analytics_037_to_041.sql)
create table public.invoices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  period       text not null,          -- ex: 'Mai 2026'
  period_start date not null,
  period_end   date not null,
  value        numeric(10,2) not null default 0,
  due_date     date not null,
  status       text not null default 'pending'  -- 'paid' | 'pending' | 'overdue'
    check (status in ('paid', 'pending', 'overdue')),
  paid_at      timestamptz,
  notes        text,
  created_at   timestamptz not null default now()
);
-- Índices: invoices_user_id_idx, invoices_status_idx, invoices_period_start_idx
-- RLS: policy "invoices_owner" → auth.uid() = user_id
```

**Nota:** enquanto o sistema de billing não existe, a tabela estará vazia → `buildLiveData` retorna `financeMock.invoices` como fallback. Quando o billing for ativado, inserir linhas reais na tabela `invoices` e o fallback deixa de ser usado automaticamente.

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

## 12. MÓDULO DE ANÁLISES

### Arquivos

```
app/dashboard/analytics/
  ├── page.tsx            # Server Component — filtros SQL, bots/flows no Promise.all principal,
  │                       # paralelismo total (prev queries kickoff antes do await main)
  ├── AnalyticsClient.tsx # Client Component fino (~130 linhas) — useTransition + router.replace
  │                       # + PostHog tracking (filter_changed, csv_exported)
  ├── _types.ts           # Period, Filters, AnalyticsSummary, BotStat, FlowStat, CohortRow, etc.
  ├── _utils.ts           # fmtBRL, fmtNum, fmtPct, getDateRange, PERIOD_LABELS
  ├── _actions.ts         # 'use server' — getExportRows(filters): busca aprovadas sob demanda (CSV)
  ├── _server.ts          # computeFunnel(curTxs, curContactCount, ...) | computeByBot |
  │                       # computeByProduct | computeByFlow | computeByUtm |
  │                       # computeStatusBreakdown | computeExportRows | transformCohortRpc
  └── _components/
      ├── FilterBar.tsx   # 5 selects + toggle Comparar + Limpar — desabilita ao navegar (isPending)
      ├── FunnelChart.tsx # 4 etapas + % entre etapas + conv. total + deltas vs. anterior
      ├── BarListCard.tsx # Genérico <T> — bot | produto | fluxo | UTM (barra horizontal)
      ├── StatusCard.tsx  # PieChart Recharts (donut) — status dos pagamentos
      └── CohortTable.tsx # Tabela semanal S0–S5 com heatmap color-mix(oklab)
```

### Fluxo de dados

```
URL: /dashboard/analytics?period=30d&botId=xxx&compare=1

AnalyticsPage (Server Component)
  ├── Lê searchParams: period | botId | productName | flowId | utmSource | compare
  ├── Aplica filtros SQL diretamente nas queries (gte/lte data, eq por bot/produto/fluxo/UTM)
  ├── Kick off prev queries ANTES do primeiro await (paralelismo total com main):
  │     prevTxP / prevCntP / prevEvtP — promises HTTP já no ar antes de qualquer await
  ├── Promise.all principal (dispara em paralelo):
  │     ├── transactions  → bot_id, flow_id, status, amount, net, fee,
  │     │                   product_name, utm_source, utm_campaign, created_at
  │     ├── contacts      → SELECT count(*) head:true — ZERO rows, apenas o número
  │     ├── checkout_events → event_type, bot_id, flow_id (filtrado)
  │     ├── RPC analytics_cohort_weekly(p_user_id, p_cohorts=6, p_weeks=6)  ← migração 039
  │     ├── RPC analytics_filter_options(p_user_id)  ← migração 042 — SELECT DISTINCT produtos+UTMs
  │     ├── bots   → id, name, username (diretamente no batch)
  │     └── flows  → id, name, executions, conversion (diretamente no batch)
  ├── prevBatch (só se compare=true && period!='all' — já rodando em paralelo):
  │     ├── transactions  (período anterior, mesmos filtros)
  │     ├── contacts      (período anterior, count-only)
  │     └── checkout_events (período anterior)
  ├── Computa server-side via _server.ts:
  │     computeFunnel(curTxs, curContactCount, ...) | computeByBot | computeByProduct |
  │     computeByFlow | computeByUtm | computeStatusBreakdown | transformCohortRpc
  └── Passa AnalyticsSummary (objeto serializado) para <AnalyticsClient summary={...} />

AnalyticsClient (Client Component — ~130 linhas)
  ├── Recebe summary: AnalyticsSummary — nenhuma computação client-side
  ├── useTransition + router.replace → atualiza URL ao mudar filtro (sem reload)
  ├── PostHog: track('analytics_filter_changed') a cada mudança de filtro ou Limpar
  ├── handleExport → chama Server Action getExportRows(filters) sob demanda → exportCSV()
  │     track('csv_exported', { section: 'analytics', rows, period })
  ├── FilterBar: isPending=true desabilita interação durante navegação
  └── Renderiza: FunnelChart | BarListCard×4 | StatusCard | CohortTable
```

### AnalyticsSummary — contrato Server → Client

```ts
interface AnalyticsSummary {
  filters: Filters               // estado atual dos filtros (lido da URL)
  funnel: FunnelStage[]          // 4 etapas do funil
  byBot: BotStat[]               // top 5 bots por receita
  byProduct: ProductStat[]       // top 5 produtos por receita
  byFlow: FlowStat[]             // top 5 fluxos (isReal=true: dados reais; false: executions estático)
  byUtm: UtmStat[]               // top 6 origens UTM por receita
  statusBreakdown: StatusData[]  // distribuição por status (approved/pending/etc.)
  cohortRows: CohortRow[]        // resultado da RPC analytics_cohort_weekly
  botOptions: BotOption[]        // opções para o dropdown de bots
  productOptions: string[]       // opções para o dropdown de produtos (via analytics_filter_options)
  flowOptions: FlowOption[]      // opções para o dropdown de fluxos
  utmOptions: string[]           // opções para o dropdown de origens (via analytics_filter_options)
  // exportRows REMOVIDO — fetched on-demand via getExportRows() Server Action (_actions.ts)
  error: string | null
  limitReached: boolean
  queryLimit: number             // 5000
}
```

### Funil de conversão — fontes de dados

| Etapa | Fonte | Populado por |
|---|---|---|
| Visitou | `checkout_events` where `event_type = 'visited'` | Páginas de checkout (a implementar) |
| Iniciou conversa | tabela `contacts` (created_at no período) | Webhook Telegram `/start` (já existe) |
| Adicionou ao carrinho | `checkout_events` where `event_type = 'cart_added'` | **✅ Rota PIX** (`app/api/payments/pix/route.ts`) — inserido após criar transação |
| Comprou | `transactions` where `status = 'approved'` | **✅ Webhook MP** — inserido ao aprovar pagamento |

**Evento `conversation_started` no funil:** o webhook Telegram (`app/api/telegram/webhook/route.ts`) insere em `checkout_events` a cada `/start` recebido. É fire-and-forget (não bloqueia o 200).

**Evento `visited` no funil:** páginas de checkout públicas devem chamar `POST /api/checkout/track` com `event_type: 'visited'`. O endpoint usa RPC com security definer (migração 041) para bypassar RLS sem expor user_id ao caller. Exemplo de uso:
```js
fetch('/api/checkout/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bot_id: '<uuid do bot>',
    event_type: 'visited',
    product_name: 'Meu Produto',
    utm_source: 'instagram',
    utm_campaign: 'lancamento-junho',
  }),
})
```

### Coorte semanal (S0–S5) — migração 039

- Função SQL `analytics_cohort_weekly(p_user_id, p_cohorts=6, p_weeks=6)` em `supabase/migrations/..._analytics_cohort_fn.sql`
- Algoritmo: CTEs no PostgreSQL — approved → first_week → cohort_sizes (array_agg) → cross join generate_series → LEFT JOIN por semana target
- Retorna ≤36 linhas (6 coortes × 6 semanas) em vez de enviar milhares de registros ao browser
- `retention_pct = NULL` → célula vazia (semana ainda não decorrida)
- `transformCohortRpc(rows, nWeeks)` em `_server.ts` converte as linhas da RPC em `CohortRow[]`
- Células renderizadas com `color-mix(in oklab, var(--primary) %, transparent)` para heatmap

### "Por fluxo de venda" — lógica de fallback

1. Agrupa `curTxs` aprovadas com `flow_id !== null` → `isReal: true`, exibe receita em BRL
2. Se nenhuma transaction tem `flow_id` (dados pré-migração 037) → usa `flows.executions`, `isReal: false`, exibe contagem
3. O subtítulo e o formato (BRL vs número) mudam automaticamente via prop `format` do `BarListCard`

### Novas colunas em `transactions` (migração 037)

```sql
utm_source   text  -- ex: 'instagram', 'google', 'whatsapp'
utm_medium   text  -- ex: 'cpc', 'social', 'email'
utm_campaign text  -- ex: 'lancamento-junho'
utm_content  text  -- ex: 'banner-topo'
flow_id      uuid  -- FK → flows(id) on delete set null
```

### Tabela `checkout_events` (migração 038)

```sql
id, user_id, bot_id, flow_id, contact_id, transaction_id,
event_type  check in ('visited','conversation_started','cart_added','payment_initiated','paid'),
product_name, utm_source, utm_medium, utm_campaign, metadata jsonb, created_at
RLS: auth.uid() = user_id
Índice composto: (user_id, event_type, created_at desc)
```

### Função SQL `analytics_cohort_weekly` (migração 039)

```sql
create or replace function public.analytics_cohort_weekly(
  p_user_id uuid, p_cohorts int default 6, p_weeks int default 6
)
returns table (cohort_date date, cohort_label text, cohort_size bigint, week_index int, retention_pct int)
language plpgsql stable security invoker
-- CTEs: approved → first_week → cohort_sizes → all_purchase_weeks → cohort_week_offsets
-- Identifica cliente por coalesce(customer_telegram_id, customer_email)
-- Usa generate_series(0, p_weeks-1) para gerar offsets de semana
-- LEFT JOIN + array_agg para checar se cliente voltou na semana target
```

### Tabela `flows` — migração 040

- Adicionada coluna `user_id uuid references auth.users(id) on delete cascade`
- RLS corrigida: policy `flows_open` (using true) substituída por `flows_owner` (auth.uid() = user_id)
- Índice criado: `flows_user_id_idx on flows(user_id)`
- A query de analytics usa `.eq('user_id', uid)` — agora funciona corretamente
- Flows sem `user_id` (registros anteriores à migração) ficam inacessíveis — aceitável pois flows é feature mock

### Limites e proteções

- `QUERY_LIMIT = 5000` — aplicado em transactions e checkout_events
- `limitReached = true` quando transactions **ou** checkout_events atingem 5000 → banner de aviso
  - contacts não entra no check pois usa `count(*)` — o número real é sempre preciso
- `error` propagado do servidor → banner de erro vermelho no cliente (inclui erro de cohort)
- `checkoutEvents` falha silenciosamente se migração 038 não aplicada (`data ?? []`)
- `cohortRes` error → propagado no banner de erro principal (usuário sabe que a função SQL está faltando)
  - Também capturado server-side via `captureEvent(uid, 'analytics_cohort_error', { error })`
- Casts `as unknown as Tipo[]` necessários porque novas colunas não estão nos tipos gerados pelo Supabase

### Função SQL `track_checkout_event` (migração 041)

```sql
create or replace function public.track_checkout_event(
  p_bot_id uuid, p_event_type text,
  p_product_name text default '', p_flow_id uuid default null,
  p_utm_source text default null, p_utm_medium text default null, p_utm_campaign text default null
)
returns void language plpgsql security definer set search_path = public
-- Resolve user_id via bots (não aceita user_id externo)
-- Allowlist: visited | cart_added | payment_initiated (conversation_started e paid são server-side)
-- Bot inexistente → return silencioso
-- grant execute to anon, authenticated
```

- Chamada via `POST /api/checkout/track` (sem auth, CORS *, rate-limit 60/min por IP)
- Permite que qualquer página de checkout popule o evento **"Visitou"** do funil
- `security definer` + postgres owner → BYPASSRLS → INSERT direto em `checkout_events`

### Função SQL `analytics_filter_options` (migração 042)

```sql
create or replace function public.analytics_filter_options(p_user_id uuid)
returns json language sql stable security invoker set search_path = public
-- Retorna: { products: string[], utm_sources: string[] }
-- SELECT DISTINCT product_name + SELECT DISTINCT utm_source em uma única query
-- Substitui 2 queries de 500 linhas + dedup em JavaScript nos dropdowns de filtro
-- grant execute to authenticated
```

- Chamada via `supabase.rpc('analytics_filter_options', { p_user_id: uid })` no mainBatch
- Resultado desestruturado: `filterOpts.products` e `filterOpts.utm_sources`

### Export CSV — Server Action (performance)

- **`_actions.ts`** — `export async function getExportRows(filters: Filters): Promise<ExportRow[]>`
- Chamada pelo `AnalyticsClient` apenas no clique de "Exportar CSV" (`handleExport async`)
- Re-executa a query de transactions aprovadas com os filtros ativos (auth verificada no servidor)
- **`exportRows` removido do `AnalyticsSummary`** — elimina centenas de KB do payload RSC por render

### Paralelismo total — prev queries kickoff

```typescript
// Prev queries criadas ANTES do primeiro await → HTTP requests já no ar
const prevTxP  = canCompare ? buildTx(prevStart, prevEnd, true)  : null
const prevCntP = canCompare ? buildCnt(prevStart, prevEnd, true) : null
const prevEvtP = canCompare ? buildEvt(prevStart, prevEnd, true) : null

// Main await — prev já rodando em paralelo
const [...] = await Promise.all([buildTx(...), buildCnt(...), ..., botsQuery, flowsQuery])

// Coleta resultados (já prontos ou quase)
const prevRes = canCompare ? await Promise.all([prevTxP!, prevCntP!, prevEvtP!]) : null
```

### Contagem de contatos — COUNT sem fetch de linhas

```typescript
// Zero rows transferidas do PostgreSQL para o Node.js
supabase.from('contacts').select('*', { count: 'exact', head: true })
// Resposta: { data: null, count: number, error }
// Uso: cntRes.count ?? 0  (em vez de cntRes.data?.length ?? 0)
```

- `computeFunnel` atualizado para aceitar `curContactCount: number` (não mais `RawContact[]`)

### PIX route — campos UTM e flow_id (migração 037)

O `POST /api/payments/pix` aceita os campos abaixo no body (todos opcionais):
```
flow_id      uuid    — vincula a transação a um fluxo de venda
utm_source   string  — ex: 'instagram', 'google', 'whatsapp'
utm_medium   string  — ex: 'cpc', 'social', 'email'
utm_campaign string  — ex: 'lancamento-junho'
utm_content  string  — ex: 'banner-topo'
```
Todos são persistidos em `transactions` e o evento `cart_added` é inserido em `checkout_events`.

### Navegação por URL (filtros)

```
/dashboard/analytics                    ← filtros padrão (30d, tudo)
/dashboard/analytics?period=7d          ← últimos 7 dias
/dashboard/analytics?botId=abc&compare=1 ← bot específico + comparar anterior
```
- `handleFilterChange(patch)` monta `URLSearchParams` e chama `router.replace(..., { scroll: false })`
- `useTransition` → `isPending=true` durante a navegação → `FilterBar` fica `opacity-60 pointer-events-none`
- Parâmetros omitidos na URL = valor padrão (period=30d, botId=all, etc.)

### CSV exportado (campos)

`Data | Produto | Valor bruto (R$) | Taxa (R$) | Valor líquido (R$) | Bot | Fluxo | Origem (UTM) | Campanha (UTM)`

---

## 13. VARIÁVEIS DE AMBIENTE

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

## 14. CONVENÇÕES

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
