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
│   │   └── bots.ts               # 9 Server Actions: validateBotTokenAction (getMe real), saveBotAction (AES-256-GCM),
│   │                             # registerWebhookAction (decryptToken + status='online'), getBotTokenAction,
│   │                             # updateBotAction, deleteBotAction — userId sempre do servidor (sem IDOR)
│   │                             # getBotTelegramProfileAction (perfil + foto base64), saveBotTelegramProfileAction,
│   │                             # setBotPhotoAction (multipart → setMyPhoto Bot API 7.3)
│   ├── (auth)/
│   │   ├── login/page.tsx        # Login com email + Google OAuth
│   │   ├── register/page.tsx     # Registro com email + Google OAuth
│   │   └── forgot-password/page.tsx  # Recuperação de senha
│   ├── auth/
│   │   ├── callback/route.ts     # Callback OAuth + dispara user_registered
│   │   └── reset-password/page.tsx   # Redefinição de senha (via link do e-mail)
│   ├── api/
│   │   ├── telegram/
│   │   │   ├── webhook/route.ts  # Recebe updates do Telegram — createAdminClient (bypassa RLS)
│   │   │   │                     # Verifica webhook_secret no header X-Telegram-Bot-Api-Secret-Token
│   │   │   │                     # /start: envia welcome_message do banco (substitui {nome}/{bot}/{data})
│   │   │   │                     # Fallback para mensagem padrão quando welcome_message está vazio
│   │   │   │                     # Insere activity_event type='lead' + checkout_event 'conversation_started'
│   │   │   └── register/route.ts # Registra webhook no Telegram (decryptToken + status='online')
│   │   ├── payments/
│   │   │   ├── pix/route.ts      # Cria pagamento PIX (Mercado Pago) + Sentry + analytics
│   │   │   │                     # Lê cookie 'umbra_aff' → valida afiliado (.eq user_id, IDOR-safe) → salva affiliate_id
│   │   │   └── mercadopago-webhook/route.ts # Confirma pagamento (valida secret em prod)
│   │   │                                    # Aprovado: credita comissão via RPC credit_affiliate_sale (mig 058)
│   │   │                                    # Aprovado: insere alert type='sale', source='webhook', context chips
│   │   ├── withdrawals/
│   │   │   └── route.ts          # POST: solicita saque (auth + zod + rate limit 3/dia + IP + Sentry)
│   │   ├── bank-accounts/
│   │   │   ├── route.ts          # GET: lista contas; POST: cria conta (zod + Sentry)
│   │   │   └── [id]/route.ts     # DELETE: remove conta (verifica user_id)
│   │   ├── admin/
│   │   │   └── migrate-tokens/route.ts  # POST: re-encripta tokens legados (ADMIN_MIGRATION_SECRET)
│   │   ├── cron/
│   │   │   ├── process-withdrawals/route.ts  # GET: processa saques pendentes (CRON_SECRET, horário)
│   │   │   ├── cleanup-activity/route.ts     # GET: deleta activity_events com >90 dias (CRON_SECRET)
│   │   │   ├── cleanup-alerts/route.ts       # GET: deleta alertas resolvidos com >30 dias (CRON_SECRET, 04:00 UTC)
│   │   │   │                                 # Lotes de 500, cron_log, Sentry
│   │   │   └── check-bots/route.ts           # GET: verifica conectividade de todos os bots a cada 30 min
│   │   │                                     # createAdminClient (bypassa RLS — cron não tem sessão de usuário)
│   │   │                                     # disconnect → insere activity_event + alert critical (bot_offline, source='cron')
│   │   │                                     # reconnect  → insere activity_event + auto-resolve alert (resolved_by='sistema (auto)')
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
│   │   ├── affiliates/
│   │   │   └── apply/route.ts    # POST: candidatura pública ao programa de afiliados
│   │   │                         # Público (sem auth), rate-limit 10/h por IP
│   │   │                         # Usa RPC submit_affiliate_application (security definer, migração 054)
│   │   └── migrations/route.ts   # Protegida por ADMIN_EMAIL
│   ├── afiliar/
│   │   └── [userId]/
│   │       ├── page.tsx          # Página pública do programa de afiliados (sem auth)
│   │       │                     # Server Component: chama get_public_affiliate_program (RPC anon)
│   │       │                     # found=false → ProgramNotFound | active=false → ProgramClosed
│   │       │                     # Exibe program_name, program_description, benefits[] dinâmicos
│   │       └── ApplicationForm.tsx # Client Component: formulário de candidatura → POST /api/affiliates/apply
│   ├── r/
│   │   └── [slug]/
│   │       └── route.ts          # GET: redirect de link de afiliado — rastreia clique + seta cookie
│   │                             # Chama RPC track_affiliate_click (security definer, migração 057)
│   │                             # Define cookie HTTP-only 'umbra_aff' com affiliate_id (maxAge = cookie_window dias)
│   │                             # Redireciona para redirect_url do programa ou APP_URL como fallback
│   │                             # Não está no matcher do middleware → público por padrão
│   └── dashboard/
│       ├── page.tsx              # Server Component async — busca KPIs 30d no servidor, passa initialData ao DashboardClient
│       ├── _components/
│       │   └── DashboardClient.tsx  # Client Component — KPIs reais + deltas + gráfico + top produtos
│       ├── bots/                 # Gerenciar bots — dados reais (SSR + Realtime)
│       │   ├── page.tsx          # Server Component: SSR bots (sem token) + flows em paralelo
│       │   └── BotsClient.tsx    # Client Component: CRUD, Realtime, AddBotModal, tabs, TokenReveal
│       ├── finance/              # Financeiro — Server Component + módulo finance/
│       ├── activity/             # Feed de eventos — dados reais do Supabase
│       │   ├── page.tsx          # Server Component: busca 25 eventos + bots em paralelo (SSR)
│       │   └── ActivityClient.tsx # Client Component: Realtime, filtros, paginação, CSV export, NoDataState
│       ├── customers/            # Clientes — dados reais do Supabase (SSR + Realtime)
│       │   ├── page.tsx          # Server Component: SSR contacts + bots + summary RPC + filter options
│       │   └── CustomersClient.tsx # Client Component: Realtime, filtros+sort persistidos, paginação server-side,
│       │                           # timeline real (activity_events), add/import modal, bulkAddTag RPC
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
│       ├── alerts/               # Alertas Importantes — dados reais do Supabase (SSR + Realtime)
│       │   ├── page.tsx          # Server Component: SSR 50 alertas + userName do auth — sem mock, sem flash
│       │   └── AlertsClient.tsx  # Client Component: Realtime INSERT+UPDATE filtrado por user_id,
│       │                         # filtros severidade+status+tipo, resolução individual/bulk (1 query),
│       │                         # now=Date.now() real, ações navegam por URL, "..." apaga alerta,
│       │                         # paginação "Carregar mais" (offset 50), 4 eventos PostHog
│       │                         # mount: batch UPDATE viewed_at=now() para alertas não vistos
│       │                         # resolve: salva resolved_by_id=userId; action: salva action_taken
│       ├── affiliates/           # Afiliados — dados reais do Supabase (SSR + Client)
│       │   ├── page.tsx          # Server Component: SSR affiliates (+ notes) + payments + config + bots em paralelo
│       │   │                     # passa appUrl + bots ao Client; DEFAULT_CONFIG inclui active/programName/etc.
│       │   └── AffiliatesClient.tsx # Client Component: CRUD, ApproveAffiliateModal, config v2, comissão, PostHog
│       ├── flows/                # Fluxos de venda — dados reais do Supabase (SSR + Client)
│       │   ├── page.tsx          # Server Component: SSR flows metadata + bots em paralelo (sem nodes/edges)
│       │   └── FlowsClient.tsx   # Client Component: lista, editor visual, CRUD real, PostHog
│       │                         # Templates modal (3 templates), duplicar fluxo, handles dinâmicos,
│       │                         # indicador nó inicial, validação nome, preview com ramificações
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
│       ├── notifications/        # Notificações — Server Component SSR + Client Component
│       │   ├── page.tsx          # Server Component: SSR prefs + firstBot em paralelo; passa userId + userEmail
│       │   └── NotificationsClient.tsx # Client Component: salva via upsert ON CONFLICT user_id;
│       │                               # email e Telegram reais (user.email + bot.username do banco)
│       ├── docs/                 # Documentação para usuários — renderizador de artigos Markdown
│       │   ├── layout.tsx        # Layout com DocsSidebar (sidebar fixa à esquerda)
│       │   ├── page.tsx          # Redireciona para /dashboard/docs/01-comecando/introducao
│       │   ├── _nav.ts           # Definição central da navegação (11 seções, 30 artigos)
│       │   ├── DocsSidebar.tsx   # Client Component: sidebar com toggle dark/light, back link,
│       │   │                     # item ativo destacado, switch visual de tema (useTheme)
│       │   ├── DocPager.tsx      # Client Component: navegação Anterior / Próximo entre artigos
│       │   └── [section]/[article]/page.tsx  # Server Component: lê .md de /docs/ via fs,
│       │                                     # strip frontmatter, marked() → HTML, processHtml()
│       │                                     # TL;DR → callout, screenshots → placeholder visual,
│       │                                     # TODO → removido, blockquotes coloridos por tipo
│       ├── guide/                # Guia da plataforma (mock)
│       └── academy/              # Academia (mock)
├── components/
│   └── dashboard/
│       ├── Layout.tsx            # Shell: DashboardProvider → LayoutShell (Sidebar + Topbar)
│       ├── Sidebar.tsx           # Navegação colapsável (260px / 80px) + badge via DashboardProvider
│       ├── Topbar.tsx            # Busca global (14 tabelas, race-condition safe) + notif + user
│       ├── OnboardingWizard.tsx  # Modal 4 passos (welcome→bot→gateway→done) — aparece 1x
│       │                         # BotStep: validateBotTokenAction → saveBotAction({ name, token, username, telegramId })
│       ├── PageHeader.tsx
│       ├── Button.tsx
│       └── finance/              # Módulo completo do Financeiro (10 arquivos)
│           ├── types.ts          # Transaction, Withdrawal, Invoice, BankAccount, RawTransaction,
│           │                     # RawWithdrawal, RawFinanceBot, RawFinanceFlow, RawInvoice, RawFinanceSummary
│           ├── formatters.ts     # fmtBRL, fmtBRLdec, fmtDate, fmtDateTime, fmtTime, fmtPct
│           │                     # — todos com timeZone: 'America/Sao_Paulo'
│           ├── constants.ts      # txTypeMap, txStatusMap, wdStatusMap, invStatusMap, filtros
│           ├── mock-data.ts      # financeMock (apenas dados de demonstração — não usado em produção)
│           ├── atoms.tsx         # Icon, Badge, Card, Tabs, Modal, Dropdown, Btn, Spinner, etc.
│           ├── FinanceDashboard.tsx  # Componente raiz (client) — seletor de período 7d/30d/90d/Tudo
│           │                         # Memo A: mapRawRows (rows→tipados), Memo B: buildPeriodSummary (period-dep)
│           ├── TransactionsSection.tsx # Tabela com filtros, paginação e detalhe expandível real
│           ├── WithdrawalsSection.tsx  # Tabela de saques (filtrada pelo período selecionado)
│           ├── InvoicesSection.tsx     # Tabela de faturas reais; estado vazio quando tabela está vazia
│           └── WithdrawModal.tsx       # Modal multi-step: self-fetch de bank_accounts, add/delete inline
│                                       # maskPixKey: oculta meio da chave PIX para privacidade
├── hooks/
│   ├── use-analytics.ts          # PostHog events tipados (28 eventos: inclui finance + analytics + affiliates + alerts)
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
│       ├── server.ts             # createClient() para Server Components / API Routes (anon key + cookies)
│       ├── client.ts             # createClient() para Client Components (browser)
│       └── admin.ts              # createAdminClient() — service role, bypassa RLS
│                                 # Usar APENAS em webhooks externos e cron jobs (sem sessão de usuário)
│                                 # Requer SUPABASE_SERVICE_ROLE_KEY no ambiente
├── providers/
│   ├── PostHogProvider.tsx       # PostHog init + pageview tracking
│   └── DashboardProvider.tsx     # Contexto global: user, alerts, botsCount, logout — 1 fetch
├── public/
│   └── sw.js                     # Service Worker para Web Push
├── docs/                         # 30 artigos Markdown de documentação para usuários (não técnica)
│   ├── 01-comecando/             # introducao, criar-conta, primeiro-bot, primeiro-pix
│   ├── 02-bots/                  # como-criar-bot-botfather, conectar-bot-umbra,
│   │                             # gerenciar-multiplos-bots, desconectar-bot
│   ├── 03-financeiro/            # entender-painel-financeiro, transacoes, solicitar-saque,
│   │                             # adicionar-conta-bancaria
│   ├── 04-clientes/              # entender-lista-clientes, filtrar-clientes,
│   │                             # adicionar-cliente-manual, importar-clientes-csv
│   ├── 05-atividade/             # feed-atividade, filtros-atividade, exportar-atividade
│   ├── 06-alertas/               # entender-alertas, resolver-alertas
│   ├── 07-analytics/             # visao-geral-analytics, funil-conversao, relatorios-por-bot
│   ├── 08-afiliados/             # programa-afiliados, aprovar-afiliados, pagar-afiliados
│   ├── 09-notificacoes/          # configurar-notificacoes
│   ├── 10-perfil/                # editar-perfil
│   └── 11-faq/                   # perguntas-frequentes (20 perguntas organizadas por tema)
├── supabase/migrations/          # 62 migrações SQL (000 a 062)
├── vercel.json                   # 4 Cron jobs: process-withdrawals (06:00 UTC) + cleanup-activity (02:00 UTC) + check-bots (a cada 30 min) + cleanup-alerts (04:00 UTC)
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
| Markdown render | marked | — |
| Typography plugin | @tailwindcss/typography | — |

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
| Financeiro — tabela invoices real + estado vazio quando billing não existe (migração 043) | ✅ Implementado |
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
| Atividade — Server Component + Client Component (SSR + Realtime) | ✅ Funcional |
| Atividade — dados reais do banco (activity_events) — sem mock, estado vazio quando vazio | ✅ Funcional |
| Atividade — Supabase Realtime (INSERT em tempo real) | ✅ Funcional |
| Atividade — filtro por categoria + dropdown de bots real | ✅ Funcional |
| Atividade — Export CSV (ActivityClient) + evento csv_exported | ✅ Funcional |
| Atividade — links "Ver X" por tipo de evento (next/link) | ✅ Funcional |
| Atividade — botão "Configurar alertas" (redireciona /dashboard/alerts) | ✅ Funcional |
| Atividade — paginação "Carregar mais" (offset via Supabase) | ✅ Funcional |
| Atividade — TTL: Vercel Cron cleanup-activity (02:00 UTC) + pg_cron opcional (mig 050) | ✅ Implementado |
| Atividade — backfill histórico: mig 051 popula activity_events de transactions + contacts | ✅ Implementado |
| Atividade — webhook Telegram: type='lead' correto + bot.username + contact_id | ✅ Corrigido |
| Atividade — PIX route: insere activity_event type='payment' ao criar cobrança | ✅ Implementado |
| Atividade — migração 049: bot_id FK + contact_id FK + índices + CHECK corrigido | ✅ Aplicado |
| Atividade — filtro de data (7d/30d/90d/Tudo) persistido em localStorage | ✅ Implementado |
| Atividade — busca por texto (title/description) persistida em localStorage | ✅ Implementado |
| Atividade — filtros persistentes via localStorage (category, bot, period, search) | ✅ Implementado |
| Atividade — contador de não-lidos no botão "Ao vivo" (zerado ao rolar para o topo) | ✅ Implementado |
| Atividade — cron check-bots: detecta disconnect/reconnect via getWebhookInfo a cada 30 min | ✅ Implementado |
| Atividade — NoDataState: estado vazio visual quando activity_events está vazio | ✅ Implementado |
| Alertas — Server Component SSR + Client Component (dados reais, sem mock, sem flash) | ✅ Funcional |
| Alertas — Realtime INSERT + UPDATE filtrado por user_id no canal | ✅ Implementado |
| Alertas — now=Date.now() real (corrigido timestamp hardcoded de ontem) | ✅ Corrigido |
| Alertas — resolveAll() com 1 query .in('id', ids) em vez de N paralelas | ✅ Corrigido |
| Alertas — botões de ação navegam pela URL correta por tipo (gateways/bots/webhooks/finance/…) | ✅ Implementado |
| Alertas — "Configurar alertas" navega para /dashboard/notifications | ✅ Corrigido |
| Alertas — "..." apaga alerta (DELETE + remoção do state) | ✅ Implementado |
| Alertas — resolved_by usa nome real do usuário (vindo do auth no servidor) | ✅ Corrigido |
| Alertas — filtro por Tipo (Gateway/Bot/Integração/Plano/Pagamento/Domínio/Venda) | ✅ Implementado |
| Alertas — paginação "Carregar mais" (offset 50, query .range()) | ✅ Implementado |
| Alertas — 4 eventos PostHog: alert_resolved, alert_reopened, all_alerts_resolved, alert_action_clicked | ✅ Implementado |
| Alertas — cron check-bots cria alert critical (bot_offline, source='cron') + auto-resolve ao reconectar | ✅ Implementado |
| Alertas — alertas de venda (type='sale') incluem context chips + source='webhook' (mp-webhook) | ✅ Implementado |
| Alertas — TTL: cron cleanup-alerts (04:00 UTC) deleta resolvidos >30 dias (lotes 500 + cron_log) | ✅ Implementado |
| Alertas — migração 059: resolved_by_id + source + action_taken + viewed_at + trigger resolved_at | ✅ Implementado |
| Alertas — mount: batch UPDATE viewed_at=now() para alertas ainda não vistos | ✅ Implementado |
| Alertas — resolve: salva resolved_by_id=userId (além de resolved_by=userName) | ✅ Implementado |
| Alertas — action click: salva action_taken=actionLabel no banco (fire-and-forget) | ✅ Implementado |
| CSV export (Financeiro + Clientes + Atividade) + evento csv_exported | ✅ Funcional |
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
| PostHog (28 eventos rastreados) | ✅ Configurado |
| Vercel Analytics + Speed Insights | ✅ Ativo |
| Schema do banco (28 tabelas — inclui invoices, migration 043) | ✅ Migrações SQL criadas e aplicadas no Supabase |
| RLS em todas as tabelas | ✅ Configurado (flows corrigida na migração 040) |
| Content-Security-Policy (CSP sem unsafe-eval em produção) | ✅ Configurado no middleware |
| Notificações — Server Component SSR + Client Component (dados reais do banco) | ✅ Funcional |
| Notificações — save() persiste via upsert ON CONFLICT user_id (migração 060 + 061) | ✅ Implementado |
| Notificações — email e bot Telegram reais (user.email + bots.username do banco) | ✅ Implementado |
| Notificações — RLS corrigida: política por usuário em vez de open (migração 060) | ✅ Corrigido |
| Notificações — migração 061: fix CONSTRAINT UNIQUE completo (substitui índice parcial incompatível) | ✅ Corrigido |
| Sistema de planos/billing | ❌ Não iniciado |
| Fluxos — Server Component SSR + FlowsClient (dados reais, sem MOCK_FLOWS) | ✅ Funcional |
| Fluxos — createFlow: INSERT real no banco, UUID real retornado (sem fake ID) | ✅ Implementado |
| Fluxos — saveFlow: .update() com feedback de erro via Toast | ✅ Implementado |
| Fluxos — deleteFlow: DELETE com modal de confirmação + PostHog | ✅ Implementado |
| Fluxos — publishFlow: salva + insere activity_event type='flowPublished' + PostHog | ✅ Implementado |
| Fluxos — lazy load: SSR só busca metadata (sem nodes/edges); editor busca ao abrir | ✅ Implementado |
| Fluxos — BotSelector: dropdown com bots reais do banco (cor + @username) | ✅ Implementado |
| Fluxos — NoDataState: estado vazio visual quando flows.length === 0 | ✅ Implementado |
| Fluxos — auto-save: debounce 30s no editor (useRef estável) | ✅ Implementado |
| Fluxos — 3 eventos PostHog: flow_created, flow_published, flow_deleted | ✅ Implementado |
| Fluxos — Templates modal: 3 templates (branco, captura de lead, vendas simples) | ✅ Implementado |
| Fluxos — duplicateFlow: copia nodes+edges, nome + "(cópia)", status draft | ✅ Implementado |
| Fluxos — handles dinâmicos no nó Botões: outputs = options.length (até 6) | ✅ Implementado |
| Fluxos — indicador de nó inicial: badge "▷ INÍCIO" no nó sem aresta de entrada | ✅ Implementado |
| Fluxos — validação de nome: bloqueia save/publish + toast + destaque visual | ✅ Implementado |
| Fluxos — preview com ramificações: buildPreviewPath recursivo (Botões + Condição) | ✅ Implementado |
| Fluxos — showToast passado ao FlowEditor para feedback interno do editor | ✅ Implementado |
| Fluxos — auto-save pula quando nome está vazio (evita salvar estado inválido) | ✅ Implementado |
| Fluxos — use-analytics: flow_published e flow_deleted adicionados ao EventMap | ✅ Implementado |
| Fluxos — Undo/Redo (Ctrl+Z / Ctrl+Y): stack de histórico com MAX_HISTORY=50, refs para evitar stale closures | ✅ Implementado |
| Fluxos — Realtime na listagem: canal 'flows-realtime' (UPDATE/INSERT/DELETE) filtrado por user_id | ✅ Implementado |
| Fluxos — Seleção múltipla: Shift+click, box select com Shift+drag, multi-drag, Delete remove todos | ✅ Implementado |
| Fluxos — Snap to grid: posições arredondadas para múltiplos de 20px ao arrastar nós | ✅ Implementado |
| Fluxos — Descrição editável no editor: campo textarea em Configurações do fluxo (⚙️), salvo no banco | ✅ Implementado |
| Fluxos — Editar conexão: EdgePanel ao selecionar aresta — "Redirecionar destino" ou "Remover conexão" | ✅ Implementado |
| Fluxos — Nós Imagem e Link: novos tipos em categoria Mídia no editor + inspector + preview | ✅ Implementado |
| Fluxos — Gatilho configurável: trigger_type (start/keyword) + keywords[] em Configurações do fluxo | ✅ Implementado |
| Fluxos — migração 063: colunas trigger_type e keywords na tabela flows | ✅ Implementado |
| Fluxos — migração 064: flow_id, flow_node_id, flow_vars na tabela contacts (estado de execução de fluxo) | ✅ Implementado |
| Fluxos — webhook: executa fluxo ativo ao /start de contato novo (executeFlowNode recursivo, depth ≤ 10) | ✅ Implementado |
| Fluxos — webhook: 9 tipos de nó executados: message, question, buttons, tag, delay, image, link, offer, condition | ✅ Implementado |
| Fluxos — webhook: callback_query → avança nó pelo índice do botão pressionado (sourceHandle matching) | ✅ Implementado |
| Fluxos — webhook: welcome_message enviada apenas para contatos NOVOS (isNewContact check antes do upsert) | ✅ Implementado |
| Fluxos — editor: inspector desaparecia ao soltar nó corrigido (deselect movido de mousedown → onClick + bgPannedRef) | ✅ Corrigido |
| Fluxos — editor: nó Question lê data.text ?? data.question (compatibilidade entre templates e editor) | ✅ Corrigido |
| Afiliados — Server Component SSR + Client Component (dados reais) | ✅ Funcional |
| Afiliados — CRUD real (add/edit/pause/archive/delete) + confirmação modal | ✅ Implementado |
| Afiliados — link de afiliado copiável (slug-based) | ✅ Implementado |
| Afiliados — pagamentos com async/await + feedback de erro | ✅ Implementado |
| Afiliados — configuração do programa persistida em affiliate_config (upsert) | ✅ Implementado |
| Afiliados — RLS corrigida (user_id em affiliates + affiliate_payments + affiliate_config) | ✅ Implementado |
| Afiliados — 5 eventos PostHog: affiliate_added/status_changed/paid/config_saved/link_copied | ✅ Implementado |
| Afiliados — NoDataState quando tabela vazia (sem mock) | ✅ Implementado |
| Afiliados — KPIs reais computados dos dados (sem deltas hardcoded) | ✅ Implementado |
| Afiliados — migração 053: user_id + RLS + affiliate_config | ✅ Aplicada |
| Afiliados — página pública /afiliar/[userId]: info do programa + formulário de candidatura | ✅ Implementado |
| Afiliados — status 'pending' para candidaturas + Aprovar/Recusar no menu | ✅ Implementado |
| Afiliados — botão "Página pública" funcional (link + split-button copiar URL) | ✅ Implementado |
| Afiliados — badge de candidaturas pendentes na PageHeader | ✅ Implementado |
| Afiliados — filtro "Pendentes" na tabela de afiliados | ✅ Implementado |
| Afiliados — migração 054: status pending + RPCs get_public_affiliate_program + submit_affiliate_application | ✅ Aplicada |
| Afiliados — ApproveAffiliateModal: seleção de bots + produtos ao aprovar candidatura (salva JSON em notes) | ✅ Implementado |
| Afiliados — coluna notes em affiliates (migração 055) | ✅ Implementado |
| Afiliados — config v2: ativar/desativar programa (toggle active) | ✅ Implementado |
| Afiliados — config v2: personalização pública (program_name, program_description, benefits list, redirect_url) | ✅ Implementado |
| Afiliados — config v2: minPayout editável quando autoPayment=true | ✅ Implementado |
| Afiliados — migração 056: campos config v2 + RPC get_public_affiliate_program atualizada | ✅ Implementada |
| Afiliados — página /afiliar/[userId]: ProgramClosed quando active=false; renderiza name/description/benefits dinâmicos | ✅ Implementado |
| Afiliados — /r/[slug]: redirect com rastreamento de clique + cookie HTTP-only de atribuição | ✅ Implementado |
| Afiliados — migração 057: RPC track_affiliate_click (incremento atômico clicks, retorna redirect_url) | ✅ Implementada |
| Afiliados — PIX route: lê cookie umbra_aff, valida IDOR, salva affiliate_id na transação | ✅ Implementado |
| Afiliados — Webhook MP: credita sales++ e commission via RPC credit_affiliate_sale ao aprovar pagamento | ✅ Implementado |
| Afiliados — migração 058: transactions.affiliate_id + RPC credit_affiliate_sale (security definer, anon) | ✅ Implementada |
| Afiliados — link de afiliado: BASE_URL removido, url derivada de appUrl (sem https:// duplicado) | ✅ Corrigido |
| Bots — Server Component + BotsClient + 6 server actions (dados reais) | ✅ Funcional |
| Bots — validateBotTokenAction: valida token real via Telegram getMe | ✅ Implementado |
| Bots — saveBotAction: AES-256-GCM + user_id server-side (sem IDOR) | ✅ Implementado |
| Bots — registerWebhookAction: decryptToken + status='online' + bot_connected PostHog | ✅ Implementado |
| Bots — getBotTokenAction: token descriptografado sob demanda (clique "Revelar") | ✅ Implementado |
| Bots — updateBotAction: patch com verificação de propriedade (user_id) | ✅ Implementado |
| Bots — deleteBotAction: DELETE com verificação de propriedade (user_id) | ✅ Implementado |
| Bots — Realtime: canal 'bots-realtime' filtrado por user_id (UPDATE em tempo real) | ✅ Implementado |
| Bots — TokenReveal: token só descriptografado ao clicar "Revelar" (server action) | ✅ Implementado |
| Bots — FlowTab: fluxos reais do banco (sem mock FLOWS) | ✅ Implementado |
| Bots — Otimista: rollback ao falhar update/delete | ✅ Implementado |
| Bots — register/route.ts: bugs corrigidos (decryptToken + status='online') | ✅ Corrigido |
| Bots — webhook/route.ts: createAdminClient (RLS bypass) + welcome_message do banco | ✅ Corrigido |
| Bots — check-bots/route.ts: createAdminClient (RLS bypass para cron sem sessão) | ✅ Corrigido |
| Bots — lib/supabase/admin.ts: cliente service role para rotas sem sessão de usuário | ✅ Implementado |
| Bots — active_flow_id: FK com ON DELETE SET NULL (migração 062) | ✅ Corrigido |
| Bots — OnboardingWizard: adapta BotStep ao novo saveBotAction (params object) | ✅ Corrigido |
| Bots — webhook/route.ts: substitui variáveis {nome}/{bot}/{data} na welcome_message | ✅ Implementado |
| Bots — BotCard: 4 métricas (Leads, Vendas, Conversão, Receita) em grid 2×2 | ✅ Implementado |
| Bots — BotCard: CTA "Compartilhe o link…" quando leads=0 e vendas=0 | ✅ Implementado |
| Bots — BotCard: footer do fluxo clicável → abre config na aba Fluxo; "+ Vincular fluxo" quando vazio | ✅ Implementado |
| Bots — BotCard: ações rápidas no hover (copiar link t.me, abrir no Telegram, reconectar, configurar) | ✅ Implementado |
| Bots — BotsList: dropdown de ordenação (Maior receita / Mais leads / Mais vendas / Alfabético / Status) | ✅ Implementado |
| Bots — BotsList: subtítulo exibe receita total dos bots | ✅ Implementado |
| Bots — BotConfig: prop defaultTab para abrir diretamente em aba específica | ✅ Implementado |
| Bots — webhook/route.ts: welcome_message enviada apenas para contatos NOVOS (isNewContact) | ✅ Implementado |
| Bots — webhook/route.ts: motor de execução de fluxo (executeFlowNode + clearFlowState + loadFlow) | ✅ Implementado |
| Bots — webhook/route.ts: callback_query handler avança fluxo pelo índice do botão (sourceHandle) | ✅ Implementado |
| Bots — perfil no Telegram: TelegramProfileModal na aba Geral (foto, nome, descrição, short desc, comandos) | ✅ Implementado |
| Bots — getBotTelegramProfileAction: getMe + getMyDescription + getMyShortDescription + getMyCommands + foto base64 | ✅ Implementado |
| Bots — saveBotTelegramProfileAction: setMyName/setMyDescription/setMyShortDescription/setMyCommands em paralelo | ✅ Implementado |
| Bots — setBotPhotoAction: upload multipart → setMyPhoto (Bot API 7.3); foto como base64 sem expor token | ✅ Implementado |
| Gateways — configuração real de credenciais | ❌ Ainda mock |
| Clientes — Server Component SSR + dados reais (sem mock) | ✅ Funcional |
| Clientes — colunas origin, first_purchase, last_purchase, avg_ticket (mig 052) | ✅ Implementado |
| Clientes — status buyer/lead derivado de purchases > 0 (sem mismatch DB) | ✅ Corrigido |
| Clientes — timeline real via activity_events.contact_id (lazy load) | ✅ Funcional |
| Clientes — paginação server-side "Carregar mais" + cliente 10/pág | ✅ Funcional |
| Clientes — Realtime INSERT + UPDATE via Supabase channel | ✅ Funcional |
| Clientes — filtros persistidos em localStorage + debounce 300ms | ✅ Funcional |
| Clientes — bulkAddTag via RPC contacts_bulk_add_tag (1 query atômica) | ✅ Implementado |
| Clientes — "Adicionar cliente" modal funcional (POST → contacts) | ✅ Funcional |
| Clientes — "Importar CSV" modal com preview + batch insert (lotes 50) | ✅ Funcional |
| Clientes — NoDataState quando tabela vazia (sem mock) | ✅ Implementado |
| Clientes — relTime usa Date.now() real (frozen timestamp corrigido) | ✅ Corrigido |
| Clientes — trigger trg_sync_contact_stats sincroniza stats ao aprovar transação | ✅ Implementado |
| Clientes — RPCs: contacts_summary, contacts_bulk_add_tag, contacts_filter_options | ✅ Implementado |
| Clientes — 5 eventos PostHog: filter_changed, profile_opened, tag_added, added, imported | ✅ Implementado |
| Clientes — ordenação clicável em todas as colunas (persiste em localStorage) | ✅ Implementado |
| Clientes — apagar cliente com confirmação inline no painel lateral (DELETE → contacts) | ✅ Implementado |
| Documentação para usuários — /docs/ (30 artigos Markdown, 11 seções) | ✅ Completo |
| Documentação — renderizador /dashboard/docs (sidebar + artigo + paginação) | ✅ Funcional |
| Documentação — toggle dark/light na sidebar da docs | ✅ Implementado |
| Documentação — TL;DR callout, screenshots placeholder, blockquotes coloridos | ✅ Implementado |
| Documentação — botão "Documentação" em Gerenciar Bots navega para /dashboard/docs | ✅ Implementado |
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
| `csv_exported` | `FinanceDashboard`, `customers/page.tsx`, `AnalyticsClient.tsx` e `ActivityClient.tsx` — inclui campo `period` ou `section` |
| `avatar_updated` | `dashboard/profile/page.tsx` |
| `broadcast_sent` | disponível no EventMap |
| `flow_created` | `FlowsClient.tsx` — ao criar novo fluxo (inclui flow_name) |
| `flow_published` | `FlowsClient.tsx` — ao publicar fluxo (inclui flow_name + node_count) |
| `flow_deleted` | `FlowsClient.tsx` — ao apagar fluxo (confirmação) |
| `plan_upgraded` | disponível no EventMap |
| `analytics_filter_changed` | `AnalyticsClient.tsx` — toda mudança de filtro ou Limpar (period, compare, bot, produto, fluxo, UTM) |
| `analytics_cohort_error` | `analytics/page.tsx` (server-side via `captureEvent`) — erro na RPC de coorte |
| `withdrawal_requested` | `WithdrawModal.tsx` — ao confirmar saque (inclui amount + account_kind) |
| `bank_account_added` | `WithdrawModal.tsx` — ao adicionar nova conta bancária (inclui kind) |
| `bank_account_deleted` | `WithdrawModal.tsx` — ao remover conta bancária |
| `finance_tab_changed` | `FinanceDashboard.tsx` — ao trocar entre Transações / Saques / Faturas |
| `finance_period_changed` | `FinanceDashboard.tsx` — ao mudar período (7d / 30d / 90d / Tudo) |
| `activity_filter_changed` | `ActivityClient.tsx` — ao mudar categoria, bot, período ou busca (inclui category + bot_filtered + period? + search?) |
| `activity_live_toggled` | `ActivityClient.tsx` — ao ligar/desligar modo ao vivo (inclui live: boolean) |
| `customer_filter_changed` | `CustomersClient.tsx` — ao mudar status, origem, tag ou período (inclui status + origin_filtered + tag_filtered + period) |
| `customer_profile_opened` | `CustomersClient.tsx` — ao abrir painel lateral de cliente (inclui status) |
| `customer_tag_added` | `CustomersClient.tsx` — tag adicionada individualmente ou em bulk (inclui tag + bulk + count?) |
| `customer_added` | `CustomersClient.tsx` — ao criar cliente manualmente via modal |
| `customer_imported` | `CustomersClient.tsx` — ao importar CSV (inclui rows: número de contatos importados) |
| `affiliate_added` | `AffiliatesClient.tsx` — ao adicionar novo afiliado (inclui commission_pct) |
| `affiliate_status_changed` | `AffiliatesClient.tsx` — ao pausar, ativar ou arquivar afiliado (inclui status) |
| `affiliate_paid` | `AffiliatesClient.tsx` — ao marcar pagamentos como pagos (inclui count + total) |
| `affiliate_config_saved` | `AffiliatesClient.tsx` — ao salvar configuração do programa (inclui percentage, attribution, cookie_window) |
| `affiliate_link_copied` | `AffiliatesClient.tsx` — ao copiar link de afiliado |
| `alert_resolved` | `AlertsClient.tsx` — ao marcar alerta individual como resolvido (inclui alert_type + severity) |
| `alert_reopened` | `AlertsClient.tsx` — ao reabrir alerta resolvido (inclui alert_type) |
| `all_alerts_resolved` | `AlertsClient.tsx` — ao resolver todos os ativos de uma vez (inclui count) |
| `alert_action_clicked` | `AlertsClient.tsx` — ao clicar no botão de ação do alerta (inclui alert_type + action) |

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
- **Código:** `createFlow()` em `FlowsClient.tsx` inclui `user_id: userId` no INSERT; `saveFlow()` usa `.update().eq('user_id', userId)` (proteção IDOR no client + RLS no banco)
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
  │     └── invoices: rawInvoices.length > 0 → dados reais; senão [] (estado vazio — sem mock)
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

**Nota:** enquanto o sistema de billing não existe, a tabela estará vazia → `InvoicesSection` exibe estado vazio ("Nenhuma fatura gerada ainda."). Quando o billing for ativado, basta inserir linhas reais na tabela `invoices` e a listagem aparece automaticamente. Não há fallback mock — o `financeMock` não é importado no `FinanceDashboard`.

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
- `SUPABASE_SERVICE_ROLE_KEY` — **obrigatória** para `lib/supabase/admin.ts` (webhook Telegram + cron check-bots)
  Encontrar em: Supabase Dashboard → Project Settings → API → service_role (secret)
  **NUNCA expor ao cliente browser** — usar apenas em server-side routes
- `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_WEBHOOK_SECRET`
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET` — protege `GET /api/cron/process-withdrawals`, `GET /api/cron/cleanup-activity` e `GET /api/cron/check-bots`
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

---

## 15. MÓDULO DE ATIVIDADE

### Arquivos

```
app/dashboard/activity/
  ├── page.tsx            # Server Component — busca initialEvents (25 rows) + bots em paralelo
  └── ActivityClient.tsx  # Client Component — feed Realtime, filtros, paginação, export, NoDataState
```

### Fluxo de dados

```
ActivityPage (Server Component)
  ├── Promise.all em paralelo:
  │     ├── activity_events: id, type, title, description, bot, bot_id, amount, created_at
  │     │   order: created_at desc, limit 25
  │     └── bots: id, name, username  (para resolver bot_id → @username)
  └── passa como props:
        initialEvents: RawActivityEvent[]
        bots: BotOption[]

ActivityClient (Client Component)
  ├── rows state: initialEvents.map(mapRaw) — sempre dados reais, sem fallback mock
  ├── now state: Date.now() — tick a cada 30s (timestamp relativo correto)
  ├── live state: boolean — ativa canal Realtime
  ├── unreadCount state: número de eventos recebidos via Realtime sem ter rolado para o topo
  ├── period state: '7d' | '30d' | '90d' | 'all' (default 'all') — persiste em localStorage
  ├── search state: string — busca por título/descrição, persiste em localStorage
  ├── category state: 'all' | 'sales' | ... — persiste em localStorage
  ├── botId state: 'all' | uuid — persiste em localStorage
  ├── LS helper: thin wrapper sobre localStorage com guard de SSR (typeof window !== 'undefined')
  ├── botMap: Map<uuid, string> — resolve bot_id → '@username' | 'nome' em O(1)
  ├── topSentinelRef + IntersectionObserver:
  │     div invisível (h-px) acima do feed
  │     quando visível (usuário rolou ao topo) → setUnreadCount(0)
  ├── periodRef: useRef espelhando period — evita stale closure em loadMore
  ├── Supabase Realtime:
  │     canal 'activity-feed', event INSERT, tabela activity_events
  │     payload tipado: (payload: { new: Record<string, unknown> })
  │     cast: payload.new as unknown as RawActivityEvent  (required — TypeScript strict)
  │     insere no topo de rows (prepend) + setUnreadCount((c) => c + 1)
  │     só ativo quando live=true
  ├── Botão "Ao vivo":
  │     badge vermelho com contagem quando unreadCount > 0
  │     exibe '99+' quando > 99; desaparece ao rolar para o topo
  │     track('activity_live_toggled', { live })
  ├── Filtros + localStorage:
  │     category, botId, period, search — lidos do localStorage no useState inicial
  │     handlePeriodChange / handleSearchChange salvam em localStorage antes de atualizar state
  │     onClear: limpa os 4 itens do localStorage + reseta states
  │     hasFilters: true se algum dos 4 não for o default
  ├── getPeriodCutoff(period): retorna timestamp (ms) de cutoff ou null para 'all'
  ├── filtered useMemo:
  │     filtra por category, botId, period (cutoff no created_at) e search (title/description)
  ├── Paginação "Carregar mais":
  │     PAGE_SIZE = 25
  │     dbOffset state: avança +25 a cada clique
  │     GET activity_events .range(offset, offset+24) + .gte('created_at', cutoff) se period ativo
  │     periodRef usado para ler period sem re-criar loadMore callback
  │     hasMore: false quando retorna < PAGE_SIZE
  ├── Estados vazios:
  │     allEvents.length === 0 → <NoDataState> ("Aguardando primeiros eventos")
  │     filtered.length === 0 && hasFilters → <EmptyFeed> ("Nenhum evento nos filtros")
  ├── FilterBar (props adicionais):
  │     period, onPeriodChange, search, onSearchChange, unreadCount
  │     search input: X para limpar, ícone Search
  │     period Dropdown: '7d' / '30d' / '90d' / 'Tudo'
  ├── Export CSV:
  │     campos: Data | Tipo | Título | Descrição | Bot | Valor (R$)
  │     nome do arquivo: atividade_YYYY-MM-DD.csv
  │     track('csv_exported', { section: 'activity', rows })
  ├── "Configurar alertas": router.push('/dashboard/alerts')
  └── Links "Ver X": next/link → /dashboard/finance | /customers | /bots | /webhooks | etc.
```

### Tipos de evento e mapeamento

| type | label | category | link destino |
|---|---|---|---|
| `sale` | Venda realizada | sales | /dashboard/finance |
| `lead` | Novo lead | leads | /dashboard/customers |
| `payment` | Pagamento recebido | payments | /dashboard/finance |
| `refund` | Reembolso | payments | /dashboard/finance |
| `reconnect` | Bot reconectado | bots | /dashboard/bots |
| `disconnect` | Bot desconectado | bots | /dashboard/bots |
| `limit` | Limite atingido | system | /dashboard/alerts |
| `newBot` | Novo bot | bots | /dashboard/bots |
| `webhookFailed` | Webhook falhou | system | /dashboard/webhooks |
| `flowPublished` | Fluxo publicado | system | /dashboard/flows |
| `cancellation` | Cancelamento | payments | /dashboard/finance |
| `failure` | Falha | system | /dashboard/alerts |

### CHECK constraint — migração 049

O CHECK da tabela `activity_events` foi corrigido para incluir todos os 12 tipos acima.
Motivo: PostgreSQL normaliza `IN (...)` para `ANY (ARRAY[...])` internamente — o DROP anterior
usava `ilike '%type in%'` e nunca encontrava a constraint. Fix: `DROP CONSTRAINT IF EXISTS` pelo nome exato.

```sql
alter table public.activity_events drop constraint if exists activity_events_type_check;
alter table public.activity_events add constraint activity_events_type_check
  check (type in ('sale','lead','payment','refund','reconnect','disconnect',
                  'limit','newBot','webhookFailed','flowPublished','cancellation','failure'));
```

### Webhook Telegram — correções (migração 049 + fix no route)

- **Antes:** `type: 'message'` → inválido no CHECK → INSERT silenciosamente rejeitado
- **Depois:** `type: 'lead'`, `title: 'Novo lead'`, `description: \`${firstName} iniciou conversa\``
- **bot.username:** adicionado ao `.select('id, user_id, token, webhook_secret, name, username')`
- **campo bot:** `bot.username ? \`@${bot.username}\` : bot.name` — usa @handle quando disponível

### TTL — estratégia de retenção (90 dias)

**Primária:** Vercel Cron → `GET /api/cron/cleanup-activity` (02:00 UTC, protegido por `CRON_SECRET`)
- Deleta em lotes de 500 para evitar lock longo na tabela
- Registra início/fim/contagem no `cron_log`
- Cutoff: `now() - 90 days`

**Secundária (opcional):** pg_cron → migração 050
- Defensiva: só executa se o schema `cron` existir (pg_cron habilitado no Supabase)
- Agendado para 03:00 UTC (1h depois do Vercel Cron)
- Habilitar: Dashboard → Database → Extensions → pg_cron

### Backfill histórico — migração 051

Popula `activity_events` com eventos passados, resolvendo o problema de a tabela ficar vazia quando criada após os dados já existirem.

| Origem | type inserido | Condição |
|---|---|---|
| `transactions` | `sale` | `status = 'approved'` |
| `transactions` | `refund` | `status in ('refunded', 'cancelled')` |
| `contacts` | `lead` | todos com `user_id is not null` |

- Idempotente via `NOT EXISTS` com janela de 2 s no `created_at` — seguro rodar mais de uma vez
- Rodar no Supabase SQL Editor: Dashboard → SQL Editor → cole e execute o arquivo da migration
- Após o backfill, a aba Atividade exibe os dados reais; se ainda vazio, exibe NoDataState
- Novos eventos entram em tempo real via Realtime (INSERT na tabela)

### Cron check-bots — detecção de conectividade (a cada 30 min)

**Arquivo:** `app/api/cron/check-bots/route.ts`  
**Agendamento:** `*/30 * * * *` (vercel.json) — protegido por `CRON_SECRET`

**Algoritmo por bot:**
1. Chama `https://api.telegram.org/bot{token}/getWebhookInfo`
2. Considera **offline** se: `!info.url` (sem webhook configurado) **OU** `last_error_date` dentro dos últimos 1800 s
3. Busca o último evento `disconnect` / `reconnect` do bot em `activity_events` (evita duplicatas)
4. Se offline e último evento ≠ `disconnect` → insere `type: 'disconnect'`
5. Se online e último evento = `disconnect` → insere `type: 'reconnect'`
6. Erros por bot são capturados com Sentry sem parar o loop

**Resposta:** `{ checked, disconnected, reconnected, message }`

**Dependências:**
- `decryptToken()` de `lib/crypto` — tokens ficam encriptados no banco
- `bot.username` → campo `bot` usa `@username` ou `bot.name` como fallback

### botMap — resolução de nomes

```typescript
const botMap = useMemo(() => {
  const m = new Map<string, string>()
  bots.forEach(b => m.set(b.id, b.username ? `@${b.username}` : b.name))
  return m
}, [bots])
// Uso: botMap.get(event.bot_id) ?? event.bot ?? 'Bot desconhecido'
```
O campo `bot` (string legada) serve de fallback para eventos inseridos antes da migração 049 que adicionou `bot_id` FK.

---

## 16. MÓDULO DE CLIENTES

### Arquivos

```
app/dashboard/customers/
  ├── page.tsx            # Server Component — SSR: contacts (25 rows) + bots + contacts_summary RPC
  │                       # + contacts_filter_options RPC — tudo em Promise.all
  └── CustomersClient.tsx # Client Component — Realtime, filtros, sort, paginação, modais, timeline
```

### Fluxo de dados

```
CustomersPage (Server Component)
  ├── Promise.all em paralelo:
  │     ├── contacts: id, name, username, email, phone, origin, bot, bot_id,
  │     │   purchases, total_spent, avg_ticket, tags, first_contact, last_contact,
  │     │   first_purchase, last_purchase (limit 25, order last_contact desc)
  │     ├── bots: id, name, username  (para dropdown de bot e resolução de nome)
  │     ├── RPC contacts_summary(p_user_id): { total, buyers, leads }
  │     └── RPC contacts_filter_options(p_user_id): { origins: string[] }
  └── passa como props:
        initialContacts: RawContact[]   hasMore: boolean
        bots: ContactBotOption[]        originOptions: string[]
        totalCount / buyersCount / leadsCount: number

CustomersClient (Client Component)
  ├── customers state: initialContacts.map(mapRaw) — nunca usa mock
  ├── mapRaw: status = purchases > 0 ? 'buyer' : 'lead'  (não lê status do DB)
  ├── relTime: usa Date.now() — nunca timestamp congelado
  ├── Supabase Realtime:
  │     canal 'customers-realtime', INSERT → prepend + incrementa contadores
  │     UPDATE → atualiza inline no array
  ├── Filtros persistidos em localStorage (prefixo 'umbra_cust_'):
  │     search (debounce 300ms), status, origin, tag, period
  │     getPeriodCutoff(period) usa Date.now() como base
  ├── Sort: SortField × SortDir — sortCustomers() com localeCompare pt-BR
  │     6 colunas clicáveis: name | origin | status | purchases | totalSpent | lastContact
  │     Sort + direção persistidos em localStorage (umbra_cust_sort, umbra_cust_sort_dir)
  ├── Paginação:
  │     client-side: 10/pág sobre dados já carregados
  │     server-side: "Carregar mais" → .range(offset, offset+24) acumula em customers
  ├── bulkAddTag: RPC contacts_bulk_add_tag(p_ids, p_tag) — 1 UPDATE atômico
  ├── Timeline (ProfilePanel):
  │     lazy load via activity_events WHERE contact_id = customer.id
  │     só executa ao abrir o painel — sem dados pré-carregados
  ├── AddCustomerModal: INSERT em contacts com user_id do auth
  ├── ImportCSVModal: FileReader + parseCSV + batch INSERT (lotes 50)
  │     Colunas CSV: Nome*, Username, E-mail, Telefone, Origem, Tags (sep. ;)
  └── deleteCustomer(id): DELETE em contacts → remove do estado local + atualiza contadores
        ProfilePanel footer: botão "Apagar cliente" → confirmação inline → fecha painel
```

### Schema contacts — colunas relevantes (migration 052)

```sql
-- Colunas adicionadas na migração 052
origin         text                          -- UTM source ou origem manual
first_purchase timestamptz                   -- data da primeira transação aprovada
last_purchase  timestamptz                   -- data da última transação aprovada
avg_ticket     numeric(10,2) default 0       -- total_spent / purchases (mantido por trigger)

-- Trigger: trg_sync_contact_stats (migration 052)
-- Dispara após INSERT/UPDATE/DELETE em transactions WHERE contact_id IS NOT NULL
-- Recalcula: purchases, orders_count, total_spent, avg_ticket, first_purchase, last_purchase
```

### RPCs do módulo (migration 052)

```sql
-- contacts_summary(p_user_id): retorna { total, buyers, leads }
-- Usado na PageHeader para mostrar "38 contatos · 25 compradores · 13 leads"
-- Zero rows transferidas (só contagem)

-- contacts_bulk_add_tag(p_ids uuid[], p_tag text): UPDATE atômico
-- array_append com NOT (tags @> ARRAY[p_tag]) — idempotente, sem duplicatas
-- Substitui N queries paralelas (race condition eliminada)

-- contacts_filter_options(p_user_id): retorna { origins: string[] }
-- SELECT DISTINCT origin — populado no server-side para o dropdown Origem
```

### Status buyer/lead — lógica correta

```typescript
// mapRaw() em CustomersClient.tsx
status: Number(row.purchases ?? 0) > 0 ? 'buyer' : 'lead'
// O DB usa status in ('new','active','vip','inactive','blocked') — não usado para classificação
// A classificação visual é sempre derivada do campo purchases
```

### Eventos PostHog do módulo

| Evento | Quando |
|---|---|
| `customer_filter_changed` | ao mudar qualquer filtro (inclui status, origin_filtered, tag_filtered, period) |
| `customer_profile_opened` | ao abrir painel lateral (inclui status: 'buyer'\|'lead') |
| `customer_tag_added` | ao adicionar tag individual ou bulk (inclui tag, bulk, count?) |
| `customer_added` | ao criar cliente via modal "Adicionar cliente" |
| `customer_imported` | ao concluir import CSV (inclui rows: número de contatos) |
| `csv_exported` | ao exportar CSV (inclui section: 'clientes', rows) |

---

## 17. MÓDULO DE AFILIADOS

### Arquivos

```
app/dashboard/affiliates/
  ├── page.tsx             # Server Component — SSR: affiliates + affiliate_payments + affiliate_config
  │                        # Promise.all em paralelo; DEFAULT_CONFIG fallback quando config inexistente
  └── AffiliatesClient.tsx # Client Component — CRUD completo, pagamentos, config, PostHog
```

### Fluxo de dados

```
AffiliatesPage (Server Component)
  ├── Promise.all em paralelo:
  │     ├── affiliates: id, name, email, slug, status, clicks, sales, commission,
  │     │   conversion_rate, payment_method, commission_pct, joined_at, notes
  │     │   filtrado por user_id, ordenado por commission desc
  │     ├── affiliate_payments: id, affiliate_id, cycle, sales, amount, status, paid_at, created_at
  │     │   filtrado por user_id, ordenado por created_at desc
  │     ├── affiliate_config: * (single) — fallback: DEFAULT_CONFIG se inexistente
  │     └── bots: id, name, username — para ApproveAffiliateModal
  └── passa como props:
        initialAffiliates: RawAffiliate[]
        initialPayments: RawPayment[]
        initialConfig: RawConfig
        userId: string
        appUrl: string  ← process.env.APP_URL ?? 'https://umbra.bot'
        bots: RawBot[]  ← export interface RawBot { id, name, username }

AffiliatesClient (Client Component)
  ├── affiliates state: initialAffiliates.map(mapAffiliate)
  ├── payments state: initialPayments.map(mapPayment)
  ├── config state: initialConfig
  ├── approveId state: string | null — id do afiliado a aprovar via modal
  ├── KPIs computados dos dados reais:
  │     activeCount, pendingApps (candidaturas pending),
  │     totalSales, totalComm, pendingCount, pendingTotal
  │     publicPageUrl = appUrl + '/afiliar/' + userId
  ├── handleAdd: INSERT em affiliates → usa UUID retornado do banco → prepend no state
  │     track('affiliate_added', { commission_pct })
  ├── handleEdit: UPDATE em affiliates → atualiza state inline
  ├── handleStatusChange: UPDATE status em affiliates → atualiza state
  │     track('affiliate_status_changed', { status })
  ├── handleDelete: DELETE em affiliates → remove do state
  ├── handleApprove(id, notesJson): UPDATE status='active' + notes=notesJson → atualiza state
  │     chamado pelo ApproveAffiliateModal ao confirmar aprovação
  ├── handleSaveConfig: UPSERT em affiliate_config (onConflict: 'user_id') → atualiza state
  │     cleanBenefits filtra strings vazias antes de salvar
  │     track('affiliate_config_saved', { percentage, attribution, cookie_window })
  ├── handlePay: batch UPDATE affiliate_payments (status='paid', paid_at=now)
  │     await Promise.all de N updates → toast de erro/sucesso
  │     track('affiliate_paid', { count, total })
  ├── Botão "Página pública": split-button = link + botão copiar URL
  │     link aponta para publicPageUrl (appUrl/afiliar/userId)
  │     botão copiar: navigator.clipboard.writeText + feedback "✓"
  ├── Badge de candidaturas pendentes na PageHeader quando pendingApps > 0
  │     clica no badge → muda tab para 'affiliates'
  ├── Tabela de afiliados:
  │     colunas: avatar+nome, status badge, comissão (R$), vendas, cliques,
  │     conversão (%), link, menu MoreHorizontal
  │     filtro de status: Todos | Ativos | Pausados | Arquivados | Pendentes
  ├── AffiliateActionsMenu:
  │     status 'pending': Aprovar (→ abre ApproveAffiliateModal) | Recusar (→ delete)
  │     status outros: Edit | Pause/Ativar | Arquivar/Reativar | Apagar
  ├── ApproveAffiliateModal (novo):
  │     checkboxes de bots (lista dos bots do usuário)
  │     textarea de produtos (nomes separados por vírgula)
  │     ao confirmar: chama handleApprove(id, JSON.stringify({ bots, products }))
  │     salva seleção em affiliates.notes como JSON
  ├── CopyableLink: ícone de cópia + feedback visual "Copiado!"
  │     url = `${appUrl}/r/${slug}` — URL completa com protocolo (sem prefixo manual)
  │     navigator.clipboard.writeText(url) — não adiciona https:// (já está na url)
  │     track('affiliate_link_copied', {})
  ├── mapAffiliate(row, appUrl): recebe appUrl como 2º parâmetro — sem BASE_URL hardcoded
  │     url: `${appUrl}/r/${row.slug}` — correto para qualquer domínio
  ├── AddAffiliateModal: nome, email, slug (auto-gerado), comissão
  ├── EditAffiliateModal: editar nome, email, slug, comissão, método de pagamento
  ├── DeleteConfirmModal: confirmação antes de deletar
  ├── ProgramConfigSection (aba Configurações):
  │     Seção "Página pública":
  │       toggle active (ativa/desativa programa inteiro)
  │       programName input (nome público do programa)
  │       programDescription textarea (160 chars max, contador visível)
  │       redirectUrl input (URL para redirecionar após /r/[slug])
  │     Seção "Benefícios":
  │       lista editável de até 8 benefícios (add/remove por item)
  │     Seção "Comissão padrão": percentage slider/input
  │     Seção "Regra de atribuição": attributionRule select
  │     Seção "Janela de cookie": cookieWindow select
  │     Seção "Regras avançadas":
  │       upsellCommissions toggle, recurringCommissions toggle
  │       autoPayment toggle → quando true: minPayout number input (R$)
  │     botão "Salvar configurações" → handleSaveConfig
  │     Preview card: mostra estado do programa (ativo/fechado) + campos configurados
  └── PaymentsSection (aba Pagamentos):
        tabela com ciclo, afiliado, vendas, valor, status
        checkbox seleção múltipla + "Marcar como pago" em lote
```

### Tabelas do banco

```sql
-- affiliates (migration 053 — campos adicionados)
user_id        uuid references auth.users(id) on delete cascade
commission_pct numeric(5,2) not null default 30
-- RLS: affiliates_owner → auth.uid() = user_id

-- affiliates (migration 055 — campo adicionado)
notes text  -- JSON com { bots: string[], products: string[] } salvo ao aprovar candidatura

-- affiliate_payments (migration 053 — campo adicionado)
user_id uuid references auth.users(id) on delete cascade
-- RLS: affiliate_payments_owner → auth.uid() = user_id

-- affiliate_config (migration 053 — tabela nova)
id                    uuid primary key
user_id               uuid not null unique references auth.users(id) on delete cascade
percentage            numeric(5,2) not null default 30
attribution_rule      text not null default 'last_click'  -- 'first_click' | 'last_click'
cookie_window         integer not null default 30
upsell_commissions    boolean not null default true
recurring_commissions boolean not null default false
auto_payment          boolean not null default false
min_payout            numeric(10,2) not null default 100
created_at / updated_at  timestamptz
-- RLS: affiliate_config_owner → auth.uid() = user_id
-- Trigger: affiliate_config_updated_at (chama set_updated_at())

-- affiliate_config (migration 056 — campos adicionados)
active              boolean not null default true   -- ativa/desativa o programa inteiro
program_name        text                            -- nome público do programa
program_description text                            -- descrição exibida em /afiliar/[userId]
benefits            text[]                          -- lista de benefícios (até 8 itens)
redirect_url        text                            -- URL de destino após /r/[slug]

-- transactions (migration 058 — campo adicionado)
affiliate_id uuid references public.affiliates(id) on delete set null
-- Índice parcial: transactions_affiliate_id_idx WHERE affiliate_id IS NOT NULL
-- Preenchido pelo POST /api/payments/pix quando cookie 'umbra_aff' está presente
```

### DEFAULT_CONFIG (fallback quando affiliate_config ainda não existe)

```ts
const DEFAULT_CONFIG: RawConfig = {
  percentage: 30,
  attributionRule: 'last_click',
  cookieWindow: 30,
  upsellCommissions: true,
  recurringCommissions: false,
  autoPayment: false,
  minPayout: 100,
  active: true,
  programName: '',
  programDescription: '',
  benefits: [],
  redirectUrl: '',
}
```

### Status de afiliados

| status | Label | Descrição |
|---|---|---|
| `active` | Ativo | Afiliado aprovado e divulgando |
| `paused` | Pausado | Comissões suspensas temporariamente |
| `archived` | Arquivado | Inativo, mantido no histórico |
| `pending` | Pendente | Candidatura via página pública aguardando aprovação |

Ações do menu por status:
- **pending**: Aprovar (→ abre `ApproveAffiliateModal` → handleApprove) ou Recusar (DELETE)
- **outros**: Editar, Pausar/Ativar, Arquivar/Reativar, Apagar

### Página pública de candidaturas — `/afiliar/[userId]`

```
app/afiliar/[userId]/
  ├── page.tsx          # Server Component público (sem auth no middleware)
  │                     # Valida UUID → chama get_public_affiliate_program(userId)
  │                     # found=false → ProgramNotFound (sem auth redirect)
  │                     # active=false → ProgramClosed (🔒 "Programa fechado", exibe program_name)
  │                     # Renderiza: hero com program_name (ou fallback), program_description,
  │                     #   lista de benefícios (benefits[] ou auto-gerados dos flags)
  │                     #   + ApplicationForm
  └── ApplicationForm.tsx # Client Component — form nome + email
                          # POST /api/affiliates/apply → { userId, name, email }
                          # Estados: idle | loading | success | error | duplicate
                          # Mensagens em português

app/api/affiliates/apply/route.ts
  ├── Público (sem auth), rate limit 10/h por IP (rateLimit de lib/rate-limit)
  ├── Valida UUID userId + nome (2–120 chars) + e-mail
  └── Chama RPC submit_affiliate_application(p_user_id, p_name, p_email)
        → security definer, bypass RLS, grant to anon
        → retorna { success: true } ou { success: false, error: 'already_applied' | 'invalid_program' }
```

### Link de divulgação — `/r/[slug]`

```
app/r/[slug]/route.ts
  GET /r/{slug-do-afiliado}
  ├── Chama RPC track_affiliate_click({ p_slug }) via supabase.rpc (anon key)
  ├── found=false (slug inválido, afiliado inativo, programa desativado) → redirect para APP_URL
  ├── found=true:
  │     → define cookie 'umbra_aff' = affiliate_id
  │         httpOnly: true, sameSite: 'lax', path: '/'
  │         maxAge = cookie_window * 86400 (dias convertidos em segundos)
  │         secure: true em produção
  │     → redirect para result.redirect_url || APP_URL
  └── O cookie é lido pelo POST /api/payments/pix ao criar cobrança
```

**Ciclo completo de atribuição:**
1. Afiliado compartilha `umbra.bot/r/seu-slug`
2. Visitante acessa → clique registrado atomicamente (clicks++) + cookie 'umbra_aff' setado
3. Visitante compra → PIX route lê cookie, valida IDOR (.eq user_id + status active), salva `affiliate_id` na transação
4. Mercado Pago confirma pagamento → webhook lê `affiliate_id`, busca `commission_pct`, chama `credit_affiliate_sale` (sales++ + commission+=)

### RPCs públicas — migração 054

```sql
-- Retorna info do programa (grant to anon — sem auth necessária)
get_public_affiliate_program(p_user_id uuid) → json
  { found, percentage, cookie_window, upsell_commissions, recurring_commissions }
  -- LEFT JOIN affiliate_config: found=false quando usuário não configurou o programa
  -- Usa DEFAULT quando não há config (percentage=30, cookie_window=30)

-- Insere candidatura como pending (grant to anon — sem auth necessária)
submit_affiliate_application(p_user_id, p_name, p_email) → json
  -- Verifica que userId existe em auth.users
  -- Rejeita e-mail duplicado para o mesmo user_id
  -- Gera slug a partir do nome (regexp, sem unaccent)
  -- Garante unicidade do slug com sufixo UUID se necessário
  -- Busca commission_pct do affiliate_config (fallback: 30%)
  -- INSERT com status='pending'
  -- Retorna { success: true } ou { success: false, error: string }
```

### RPC atualizada — migração 056

```sql
-- get_public_affiliate_program reescrita para incluir novos campos
get_public_affiliate_program(p_user_id uuid) → json
  { found, active, percentage, cookie_window, upsell_commissions, recurring_commissions,
    program_name, program_description, benefits }
  -- Retorna active=false se o programa foi desativado pelo operador
  -- A página /afiliar/[userId] exibe ProgramClosed quando active=false
  -- Benefits é text[] (pode ser null → página usa benefícios gerados automaticamente)
```

### RPC de rastreamento de clique — migração 057

```sql
-- track_affiliate_click(p_slug text) → json
-- security definer, grant to anon, authenticated
-- Busca afiliado pelo slug (status='active')
-- Verifica se o programa está active=true
-- Incremento atômico: UPDATE affiliates SET clicks = clicks + 1
-- Retorna: { found, affiliate_id, cookie_window, redirect_url }
-- found=false se slug não existe, afiliado inativo ou programa desativado
```

- Chamada via `supabase.rpc('track_affiliate_click', { p_slug: slug })` em `app/r/[slug]/route.ts`
- Rota pública (não está no middleware matcher) → usa anon key → function bypassa RLS
- Cookie `umbra_aff` definido com maxAge = `cookie_window * 24 * 60 * 60` segundos

### RPC de crédito de comissão — migração 058

```sql
-- credit_affiliate_sale(p_affiliate_id uuid, p_commission numeric) → void
-- security definer, grant to anon, authenticated
-- UPDATE affiliates SET sales = sales + 1, commission = commission + p_commission
-- Atomicamente incrementa sales e comissão em uma única query
-- Necessário pois o webhook MP roda com anon key (sem sessão de usuário)
```

- Chamada no webhook MP ao confirmar `status = 'approved'`
- Comissão calculada: `net * commission_pct / 100`, arredondada para 2 casas
- Erro capturado com Sentry mas não bloqueia o 200 para o Mercado Pago

### Eventos PostHog do módulo

| Evento | Quando |
|---|---|
| `affiliate_added` | ao adicionar novo afiliado (inclui commission_pct) |
| `affiliate_status_changed` | ao pausar, ativar ou arquivar (inclui status) |
| `affiliate_paid` | ao marcar pagamentos como pagos (inclui count + total em R$) |
| `affiliate_config_saved` | ao salvar configuração do programa (inclui percentage, attribution, cookie_window) |
| `affiliate_link_copied` | ao copiar link de afiliado |

---

## 18. MÓDULO DE BOTS

### Arquivos

```
app/dashboard/bots/
  ├── page.tsx       # Server Component — busca bots (sem token) + flows em paralelo; passa ao BotsClient
  └── BotsClient.tsx # Client Component — lista, detalhe, CRUD, Realtime, modais, tabs

app/actions/bots.ts  # 9 Server Actions (todas autenticadas + rate-limit)
  ├── validateBotTokenAction(token)              # Chama getMe, verifica is_bot, retorna { username, firstName, telegramId }
  ├── saveBotAction(params)                      # encryptToken + INSERT com user_id do servidor
  ├── registerWebhookAction(botId)               # decryptToken + setWebhook + status='online' + PostHog
  ├── getBotTokenAction(botId)                   # decryptToken — chamado só ao clicar "Revelar"
  ├── updateBotAction(id, patch)                 # UPDATE com .eq('user_id', user.id)
  ├── deleteBotAction(id)                        # DELETE com .eq('user_id', user.id)
  ├── getBotTelegramProfileAction(botId)         # getMe + getMyDescription + getMyShortDescription + getMyCommands
  │                                              # + foto via getUserProfilePhotos → getFile → base64 data URL
  ├── saveBotTelegramProfileAction(botId, data)  # setMyName / setMyDescription / setMyShortDescription / setMyCommands
  │                                              # em Promise.allSettled — primeiro erro lançado ao caller
  └── setBotPhotoAction(botId, photo: File)      # valida tipo/tamanho → multipart → setMyPhoto (Bot API 7.3)
```

### Fluxo de dados

```
BotsPage (Server Component)
  ├── Promise.all em paralelo:
  │     ├── bots: id, name, username, status, leads, sales, conversion, revenue,
  │     │         active_flow_id, color, telegram_id, webhook_url, last_sync, added_at,
  │     │         description, welcome_message, fallback_message
  │     │         ← token NUNCA incluído no select (segurança)
  │     └── flows: id, name, description, status
  └── passa como props:
        initialBots: RawBotRow[]
        flows: FlowData[]
        userId: string

BotsClient (Client Component)
  ├── bots state: initialBots.map(mapRaw) — nunca usa MOCK_BOTS
  ├── selectedId state: string | null — id do bot aberto
  ├── selectedTab state: string — aba inicial ao abrir config ('geral' | 'messages' | 'flow')
  ├── openBot(id, tab='geral'): seta selectedId + selectedTab em conjunto
  │     → chamado por BotsList.onOpen (tab='geral') e BotsList.onOpenTab (tab qualquer)
  ├── Supabase Realtime:
  │     canal 'bots-realtime', event UPDATE, tabela bots
  │     filtro: user_id=eq.${userId}
  │     UPDATE → atualiza inline no array (detecta eventos do cron check-bots)
  ├── setBotState(id, patch): atualiza state local apenas (pós-registerWebhookAction)
  ├── updateBot(id, patch): otimista + updateBotAction + rollback em falha
  ├── deleteBot(id): otimista + deleteBotAction + rollback + refreshBotsCount()
  ├── handleBotAdded(bot): prepend ao state + refreshBotsCount()
  ├── AddBotModal:
  │     Passo 1 — input token → validateBotTokenAction (real Telegram getMe)
  │     Passo 2 — config (nome, descrição, flow) + preview do bot
  │     Passo 3 — confirmação + saveBotAction + registerWebhookAction (best-effort)
  │     Sem setTimeout mock / sem Math.random() / sem UUID falso
  ├── TokenReveal: getBotTokenAction chamado só no clique do olho (token off-client até lá)
  ├── RegisterWebhookButton: chama registerWebhookAction para bots offline
  ├── GeneralTab: webhook warning quando webhookUrl vazio + RegisterWebhookButton inline
  │     card "Perfil no Telegram" → botão "Editar perfil" → abre TelegramProfileModal (estado local: tgProfileOpen)
  ├── TelegramProfileModal:
  │     carrega perfil via getBotTelegramProfileAction ao abrir (cancela se fechar antes — flag `cancelled`)
  │     foto: exibe base64 do Telegram ou preview local (URL.createObjectURL) após seleção de arquivo
  │     comandos: lista editável com up/down para reordenar, nome + descrição por linha, DEFAULT_COMMANDS como padrão
  │     save: setBotPhotoAction (se nova foto) → saveBotTelegramProfileAction → onClose()
  ├── FlowTab: usa flows prop (dados reais do banco) — sem mock FLOWS
  └── Toast system: { msg, type: 'success' | 'error' }

BotsList (sub-componente da lista)
  ├── search, statusF: filtros persistidos em estado local
  ├── sortBy state: SortOption ('Maior receita' | 'Mais leads' | 'Mais vendas' | 'Alfabético' | 'Status')
  │     sortBots(filtered, sortBy): retorna cópia ordenada — nunca muta o array original
  ├── totals: online, offline, banned, totalLeads, totalSales, totalRevenue
  │     subtitle: "${n} bots · ${fmtNum(leads)} leads · ${fmtBRLdec(revenue)} em receita"
  ├── Dropdown de ordenação ao lado do dropdown de status
  └── Passa onOpenTab ao BotCard para abrir config em aba específica

BotCard (sub-componente do card)
  ├── Stats grid 2×2: Leads | Vendas / Conversão | Receita
  │     revenue: fmtBRLdec(bot.revenue) — '—' quando zero
  ├── CTA quando leads=0 e sales=0: "Compartilhe o link do bot para capturar seus primeiros leads."
  ├── Flow footer clicável (onClick stopPropagation + onOpenTab('flow')):
  │     flow vinculado → "Fluxo: nome" + seta; sem fluxo → "+ Vincular fluxo" em roxo
  └── Quick actions no hover (top-right, onClick stopPropagation no container):
        CopyButton → copia https://t.me/@username
        <a> ExternalLink → abre t.me em nova aba
        Webhook (se offline) → chama onOpen (navega para config)
        Settings → chama onOpen (navega para config)

BotConfig (sub-componente de detalhe)
  ├── defaultTab?: string prop — tab inicial ('geral', 'messages' ou 'flow')
  └── useState(defaultTab) — usado quando BotCard abre diretamente na aba Fluxo
```

### Status válidos do campo bots.status

```sql
-- migration 006
check (status in ('online', 'offline', 'banned', 'paused'))
-- 'active' é INVÁLIDO e viola o CHECK constraint
-- registerWebhookAction e register/route.ts usam status='online' (corrigido)
```

### Fluxo de adição de bot (AddBotModal)

1. Usuário cola token → `validateBotTokenAction` → Telegram `getMe` → exibe nome + @username
2. Usuário preenche nome/descrição/flow → `saveBotAction` → `encryptToken` + INSERT → retorna `{ id }` real
3. `registerWebhookAction(id)` → `decryptToken` → `setWebhook` → status='online'
4. Se webhook falhar: bot salvo como 'offline'; usuário pode retentar via RegisterWebhookButton na aba Geral

### Dois tipos de atualização de estado

```typescript
// Local only (após ação que já atualizou o DB):
setBotState(id, { status: 'online', webhookUrl })

// Local + DB (com rollback):
updateBot(patch)  // → otimista → updateBotAction → catch: rollback ao snapshot
```

### Segurança

- Token **nunca** incluído no `select()` da página — zero exposição ao cliente por padrão
- `getBotTokenAction` valida propriedade com `.eq('user_id', user.id)` antes de descriptografar
- `saveBotAction` e `registerWebhookAction` leem `user_id` do servidor (sem IDOR)
- Rate limit: 10 validações de token / 10 min por usuário; 10 registros de webhook / 10 min
- `webhook/route.ts`: segurança pelo `webhook_secret` no header — nunca pelo `bot_id` sozinho
- `createAdminClient()` usado **apenas** em rotas sem sessão de usuário (webhook + cron)

### Cliente admin (lib/supabase/admin.ts)

```typescript
// Bypassa RLS via service role key.
// Necessário em rotas que rodam sem sessão de usuário:
//   - POST /api/telegram/webhook  (chamado pelo Telegram)
//   - GET  /api/cron/check-bots   (chamado pelo Vercel Cron)
// Segurança garantida pelo mecanismo próprio de cada rota:
//   - webhook: header X-Telegram-Bot-Api-Secret-Token
//   - cron:    header Authorization: Bearer CRON_SECRET
export function createAdminClient() {
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

**Regra:** Server Actions e Server Components usam `createClient()` (anon key + cookies).
`createAdminClient()` é reservado para rotas sem sessão.

### welcome_message no webhook

Quando o usuário envia `/start`, o webhook busca `welcome_message` do banco e substitui variáveis:

```typescript
const welcomeText = storedWelcome.trim()
  ? storedWelcome
      .replace(/\{nome\}/g,    firstName)
      .replace(/\{bot\}/g,     bot.name)
      .replace(/\{data\}/g,    new Date().toLocaleDateString('pt-BR'))
  : `Olá, <b>${firstName}</b>! …`  // fallback
```

Variáveis suportadas na aba Mensagens padrão: `{nome}`, `{bot}`, `{produto}`, `{valor}`, `{data}`.
As variáveis `{produto}` e `{valor}` são substituídas por string vazia no `/start` (não há produto nesse momento).

### active_flow_id FK (migração 062)

```sql
alter table public.bots
  add constraint bots_active_flow_id_fk
  foreign key (active_flow_id) references public.flows(id)
  on delete set null;
```
Garante que ao deletar um fluxo, `bots.active_flow_id` é zerado automaticamente (sem UUID dangling).

---

## 19. MÓDULO DE NOTIFICAÇÕES

### Arquivos

```
app/dashboard/notifications/
  ├── page.tsx                # Server Component — busca prefs + firstBot em paralelo
  └── NotificationsClient.tsx # Client Component — toda a UI interativa + save para o banco
```

### Fluxo de dados

```
NotificationsPage (Server Component)
  ├── Promise.all em paralelo:
  │     ├── notification_prefs: prefs, channel_state, quiet
  │     │   .eq('user_id', user.id).maybeSingle()
  │     └── bots: name, username
  │         .eq('user_id', user.id).not('token', 'is', null).limit(1).maybeSingle()
  └── passa como props:
        userId: string
        userEmail: string            ← user.email do Supabase Auth
        initialPrefs: RawNotifPrefs | null
        firstBot: { name, username } | null

NotificationsClient (Client Component)
  ├── prefs state: initialPrefs?.prefs ?? DEFAULT_PREFS
  ├── channelState state: initialPrefs?.channel_state ?? buildDefaultChannels(!!firstBot)
  │     email: { linked: true }
  │     panel: { linked: true }
  │     telegram: { linked: !!firstBot }  ← false se usuário não tem bot configurado
  ├── quiet state: initialPrefs?.quiet ?? DEFAULT_QUIET
  ├── snapshot state: cópia do estado persistido (compara com estado atual para dirty check)
  ├── saving state: boolean — botão exibe Loader2 durante o upsert
  ├── error state: string — exibe mensagem real do banco (ou genérica se longa)
  ├── channelDescs (dinâmico):
  │     email:    userEmail || 'Seu e-mail de cadastro'
  │     panel:    'Sino + página de Atividade'
  │     telegram: firstBot ? `Bot @${username ?? name}` : 'Nenhum bot configurado'
  ├── save() async:
  │     supabase.from('notification_prefs').upsert(
  │       { user_id, prefs, channel_state, quiet, updated_at },
  │       { onConflict: 'user_id' }           ← requer CONSTRAINT UNIQUE (migração 061)
  │     )
  │     on success: atualiza snapshot + setSaved(true)
  │     on error: console.error + setError(msg)
  ├── discard(): reset ao snapshot (último salvo)
  ├── reset(): reset aos DEFAULT_PREFS / DEFAULT_QUIET / buildDefaultChannels
  ├── dirty: JSON.stringify(current) !== JSON.stringify(snapshot)
  ├── ChannelsCard: recebe descs dinâmicos por canal
  ├── PreferencesTable: matriz eventos × canais com toggles por célula e por coluna/linha
  └── QuietHoursCard: toggle enable + time pickers (De / Até) + toggle exceptCritical
```

### Tabela notification_prefs — schema (migração 018 + 060 + 061)

```sql
-- Base (migração 018)
id            text        primary key default gen_random_uuid()::text
prefs         jsonb       not null default '{}'
channel_state jsonb       not null default '{"email":{"linked":true},"panel":{"linked":true},"telegram":{"linked":false}}'
quiet         jsonb       not null default '{"enabled":true,"from":"22:00","to":"07:00","exceptCritical":true}'
created_at    timestamptz not null default now()
updated_at    timestamptz not null default now()

-- Adicionado migração 060 + corrigido na 061
user_id       uuid references auth.users(id) on delete cascade

-- Constraint único completo (migração 061 — substitui índice parcial da 060)
-- Obrigatório para upsert ON CONFLICT (user_id) funcionar no PostgREST
CONSTRAINT notification_prefs_user_id_key UNIQUE (user_id)

-- RLS (migração 060)
policy "notification_prefs_owner": auth.uid() = user_id
-- Substitui "notification_prefs_open" (using true) que expunha dados entre usuários
```

### Catálogo de eventos (EVENT_CATALOG)

| Grupo | ID | Label |
|---|---|---|
| Vendas e pagamentos | `sale_approved` | Nova venda aprovada |
| | `sale_pending` | Venda pendente |
| | `sale_refunded` | Estorno solicitado |
| | `payment_failed` | Pagamento falhou |
| | `chargeback` | Chargeback recebido |
| Leads e contatos | `lead_created` | Novo lead capturado |
| | `cart_abandoned` | Carrinho abandonado |
| | `lead_blocked` | Lead bloqueou o bot |
| Sistema e integrações | `bot_down` | Bot desconectado |
| | `gateway_fail` | Gateway com falha |
| | `webhook_fail` | Webhook falhando |
| | `quota_warning` | Limite do plano próximo |
| Resumos | `daily_recap` | Resumo diário |
| | `weekly_recap` | Resumo semanal |
| | `monthly_recap` | Fechamento mensal |
| Equipe | `team_invite` | Convite aceito |
| | `role_change` | Mudança de papel |

### Canais

| ID | Label | Descrição dinâmica |
|---|---|---|
| `email` | E-mail | `user.email` do Supabase Auth |
| `panel` | Painel | Sino + página de Atividade (fixo) |
| `telegram` | Telegram | `Bot @username` real ou "Nenhum bot configurado" |

### Horário de silêncio (QuietHours)

```ts
interface QuietHours {
  enabled:       boolean   // ativa/desativa o silêncio
  from:          string    // ex: '22:00'
  to:            string    // ex: '07:00'
  exceptCritical: boolean  // bot_down, gateway_fail e chargeback passam mesmo no silêncio
}
// Default: enabled=true, from='22:00', to='07:00', exceptCritical=true
```

### Histórico de migrações

| Migração | O que fez |
|---|---|
| 018 | Criou a tabela com RLS aberta (`using true`) — sem user_id |
| 060 | Adicionou `user_id` + índice parcial (bugado) + corrigiu RLS |
| 061 | Removeu índice parcial, adicionou `CONSTRAINT UNIQUE` completo (compatível com PostgREST upsert) |

---

## 20. DOCUMENTAÇÃO PARA USUÁRIOS

### Visão geral

Documentação **não-técnica** voltada para infoprodutores, criadores de conteúdo e vendedores digitais. Escrita em Português (BR), tom direto, sem jargão de API/webhook/JSON.

### Estrutura de arquivos

```
docs/                           ← artigos Markdown (fonte da documentação)
  01-comecando/
    introducao.md               — O que é o Umbra Bot, para quem é
    criar-conta.md              — Cadastro por e-mail ou Google
    primeiro-bot.md             — Criar no BotFather + conectar ao Umbra Bot
    primeiro-pix.md             — Guia completo: zero ao primeiro PIX confirmado (artigo mais importante)
  02-bots/
    como-criar-bot-botfather.md — Passo a passo do BotFather com detalhe do token
    conectar-bot-umbra.md       — Adicionar bot no painel, variáveis de mensagem
    gerenciar-multiplos-bots.md — Lista, status, monitoramento automático 30 min
    desconectar-bot.md          — 3 soluções, como testar, como prevenir
  03-financeiro/
    entender-painel-financeiro.md — 4 cards, seletor período, 3 abas, exportar CSV
    transacoes.md               — Status (aprovada/pendente/expirado/cancelado/falhou), detalhes
    solicitar-saque.md          — Fluxo, limite 3/dia, processamento 06:00 UTC
    adicionar-conta-bancaria.md — PIX/conta corrente/TED, maskPixKey
  04-clientes/
    entender-lista-clientes.md  — Lead vs comprador, colunas, perfil lateral, apagar
    filtrar-clientes.md         — Filtros (status/origem/tag/período/busca), sort, bulk tag, CSV
    adicionar-cliente-manual.md — INSERT direto em contacts
    importar-clientes-csv.md    — Formato, Google Sheets/Excel, preview, lotes de 50
  05-atividade/
    feed-atividade.md           — Tipos de evento, modo ao vivo, links "Ver X"
    filtros-atividade.md        — Categoria/bot/período/busca, TTL 90 dias, carregar mais
    exportar-atividade.md       — CSV com campos, filtros aplicados
  06-alertas/
    entender-alertas.md         — Crítico/aviso/informativo, monitoramento 30 min, filtros
    resolver-alertas.md         — Resolver/reabrir/apagar, ação rápida, limpeza 30 dias
  07-analytics/
    visao-geral-analytics.md    — Filtros globais, seções, Comparar, exportar
    funil-conversao.md          — 4 etapas, como é registrado, taxa entre etapas, gargalos
    relatorios-por-bot.md       — Por bot/produto/origem/coorte/status
  08-afiliados/
    programa-afiliados.md       — Ativar, comissão %, last_click/first_click, cookie_window
    aprovar-afiliados.md        — Candidaturas pending, ApproveModal (bots+produtos), status
    pagar-afiliados.md          — Marcar como pago manualmente, histórico
  09-notificacoes/
    configurar-notificacoes.md  — 3 canais, EVENT_CATALOG 17 eventos, horário de silêncio
  10-perfil/
    editar-perfil.md            — Foto (Supabase Storage), nome, senha, logout
  11-faq/
    perguntas-frequentes.md     — 20 perguntas por tema (bots, financeiro, clientes, afiliados)

app/dashboard/docs/             ← renderizador Next.js das docs
  layout.tsx                    — Layout com DocsSidebar (sidebar fixa)
  page.tsx                      — Redirect → /dashboard/docs/01-comecando/introducao
  _nav.ts                       — Array DOC_NAV: 11 seções, 30 artigos (único ponto de verdade)
  DocsSidebar.tsx               — Client Component: usePathname + useTheme
                                  Toggle dark/light com switch visual + ícone Sol/Lua
                                  Link "← Voltar ao painel" + logo roxo
  DocPager.tsx                  — Client Component: Anterior / Próximo com cards bordados
  [section]/[article]/page.tsx  — Server Component:
                                  fs.readFileSync → stripFrontmatter → marked() → processHtml()
                                  Breadcrumb + hero (title, description, read time)
                                  processHtml(): TL;DR → callout, screenshots → placeholder visual,
                                  TODOs removidos, blockquotes coloridos (tip/warn/note)
```

### Convenções dos artigos Markdown

- Frontmatter YAML: `title`, `description`, `order`, `category`
- **TL;DR** sempre logo após o H1 — renderizado como callout verde
- `<!-- screenshot: descrição -->` — renderizado como placeholder visual tracejado (📸)
- `<!-- TODO: confirmar se feature existe -->` — removido do output para o usuário
- Blockquotes com `**Dica:**`, `**Atenção:**`, `**Nota:**` recebem cores diferentes
- Sem jargão técnico: API → sistema, webhook → integração, JSON → configuração

### processHtml() — transformações no HTML gerado pelo marked

```typescript
// TL;DR → callout destacado
/<p><strong>TL;DR:<\/strong>([\s\S]*?)<\/p>/g → <div class="tldr-box">...</div>

// Screenshot comments → placeholder visual
/<!-- screenshot: (desc) -->/ → <div class="screenshot-ph"><span>📸 (desc)</span></div>

// TODO comments → removidos (invisíveis para o usuário)
/<!-- TODO: ... -->/ → ''

// Blockquotes tipados → classes de cor
bq-tip (verde) | bq-warn (amarelo) | bq-note (azul)
```

### Como adicionar um novo artigo

1. Criar o arquivo `.md` na pasta correta dentro de `/docs/`
2. Adicionar o artigo em `app/dashboard/docs/_nav.ts` (array DOC_NAV)
3. A rota `/dashboard/docs/[section]/[article]` é dinâmica — funciona automaticamente
4. O artigo aparece na sidebar e na paginação Anterior/Próximo automaticamente

### Dependências adicionadas

| Pacote | Uso |
|---|---|
| `marked` | Converte Markdown → HTML no Server Component |
| `@tailwindcss/typography` | Plugin Tailwind (ativo via `@plugin` no globals.css) — classes `prose` |

---

## 21. MÓDULO DE FLUXOS DE VENDA

### Arquivos

```
app/dashboard/flows/
  ├── page.tsx          # Server Component — SSR flows metadata + bots em paralelo
  │                     # select sem nodes/edges (lazy load); passa initialFlows + bots + userId
  └── FlowsClient.tsx   # Client Component — listagem, editor visual, CRUD real, PostHog
```

### Fluxo de dados

```
FlowsPage (Server Component)
  ├── Auth guard: if (!user) redirect('/login')
  ├── Promise.all em paralelo:
  │     ├── flows: id, name, bot, bot_color, status, executions, conversion,
  │     │          description, updated_at   ← SEM nodes/edges (otimização de payload)
  │     └── bots: id, name, username, color  ← para BotSelector e FlowCard
  └── passa como props:
        initialFlows: RawFlowRow[]
        bots: RawBotOption[]
        userId: string

FlowsClient (Client Component)
  ├── flows state: initialFlows.map(mapRawMeta) — nunca usa MOCK_FLOWS
  ├── editingId state: string | null — id do fluxo aberto no editor
  ├── editorData state: FlowEditorData | null — carregado ao abrir editor
  ├── showTemplates state: boolean — abre TemplatesModal
  ├── deleteId / deleting: controle do modal de exclusão
  ├── duplicating: boolean — evita race condition ao duplicar
  ├── toast state: feedback visual (success/error, auto-fecha em 4s)
  │
  ├── useEffect on editingId:
  │     SELECT nodes, edges ao abrir editor (lazy load)
  │     → mapRawFull() → setEditorData()
  │
  ├── createFlow(template?):
  │     INSERT { user_id, name, status:'draft', nodes, edges }  ← nodes/edges do template
  │     retorna id real → setEditingId(data.id) → track('flow_created')
  │
  ├── duplicateFlow(id):
  │     SELECT nodes+edges do fluxo original (.eq user_id)
  │     INSERT com nome + "(cópia)" + status:'draft'
  │     prepend à lista → showToast('Fluxo duplicado')
  │
  ├── saveFlow(updated): .update() com user_id guard → update local state
  │     retorna boolean → FlowEditor mostra toast de erro se false
  │
  ├── publishFlow(updated):
  │     saveFlow({ status: 'published' }) → activity_events INSERT (fire-and-forget)
  │     → track('flow_published', { flow_name, node_count })
  │     → showToast('Fluxo publicado!')
  │
  └── deleteFlow(id):
        DELETE .eq user_id → remove do state → track('flow_deleted')

FlowEditor (sub-componente — editor visual completo)
  ├── Props: flow, bots, onBack, onSave, onPublish, showToast
  ├── name state + nameError: validação — bloqueia save/publish se vazio
  ├── nodes state / edges state: FlowNodeType[] / FlowEdgeType[]
  ├── vp state: { x, y, zoom } — viewport do canvas
  ├── connecting state: { nodeId, handle } — modo de conexão entre nós
  ├── autoSaveRef: debounce 30s (pula se name vazio)
  ├── handleSave: valida nome → onSave → showToast('Rascunho salvo')
  ├── handlePublish: valida nome → onPublish
  └── fitView(): calcula zoom/pan para encaixar todos os nós na tela
```

### Tipos internos

```typescript
interface FlowMeta {           // Listagem — sem nodes/edges (SSR leve)
  id, name, bot, botColor, status: 'published'|'draft',
  executions, conversion, updatedAt, description
}
interface FlowEditorData extends FlowMeta { // Editor — com nodes/edges (lazy)
  nodes: FlowNodeType[]; edges: FlowEdgeType[]
}
interface FlowNodeType { id, type, position: {x,y}, data: NodeData }
interface FlowEdgeType { id, source, target, sourceHandle?, label? }
```

### Templates disponíveis

| ID | Nome | Nós | Descrição |
|---|---|---|---|
| `blank` | Fluxo em branco | 0 | Canvas limpo |
| `lead-capture` | Captura de lead | 5 | mensagem → pergunta nome → pergunta e-mail → tag → confirmação |
| `sales` | Vendas simples | 6 | mensagem → oferta → botões (3 saídas) → respostas por branch |

### Tipos de nó disponíveis

| Tipo | Categoria | Saídas | Descrição |
|---|---|---|---|
| `message` | Conversa | 1 | Envia texto |
| `question` | Conversa | 1 | Pergunta + captura em `{variavel}` |
| `buttons` | Conversa | N (dinâmico) | Botões de escolha — 1 handle por opção (até 6) |
| `condition` | Lógica | 2 | Bifurca por variável (Sim/Não) |
| `delay` | Lógica | 1 | Pausa o fluxo (segundos/min/h/dias) |
| `offer` | Comercial | 1 | Produto com preço e CTA |
| `tag` | CRM | 1 | Adiciona/remove tag do contato |
| `handoff` | CRM | 0 | Encaminha para time humano (terminal) |
| `image` | Mídia | 1 | Envia imagem com URL + legenda opcional |
| `link` | Mídia | 1 | Envia botão inline com URL (Telegram InlineKeyboard) |

**Handles dinâmicos (buttons):** `outputs = -1` no `nodeTypes` sinaliza contagem variável.
`getButtonHandleX(idx, count)` distribui as posições X uniformemente de `padding=30` até `NODE_W-30`.

### Nó inicial

O Canvas computa `startNodeIds` via `useMemo`:
```typescript
const startNodeIds = useMemo(() => {
  const hasIncoming = new Set(edges.map(e => e.target))
  return new Set(nodes.map(n => n.id).filter(id => !hasIncoming.has(id)))
}, [nodes, edges])
```
`FlowNodeComp` recebe `isStart: boolean` → renderiza badge amarelo "▷ INÍCIO" acima do nó.

### Preview com ramificações

`buildPreviewPath(startNode, nodeById, edgesBySource, visited, depth)` é recursivo:
- Para `buttons`: chama `buildPreviewPath` para cada opção, retorna `PreviewEntry[]` por branch
- Para `condition`: chama recursivamente para "Sim" e "Não"
- Limite de profundidade: `depth < 30` — proteção contra loops
- `RenderPreviewEntries` renderiza a árvore com `<PreviewBranch>` aninhados

### Validação de nome

```typescript
// handleSave e handlePublish em FlowEditor
if (!name.trim()) {
  setNameError(true)
  showToast('O nome do fluxo não pode ficar vazio.', 'error')
  return
}
// input com destaque visual: ring-2 ring-danger/50 bg-danger-soft/30
// label "Nome obrigatório" abaixo do campo
// autoSave também pula: if (!name.trim()) return
```

### Segurança

- `saveFlow` e `deleteFlow` usam `.eq('user_id', userId)` — proteção IDOR
- `duplicateFlow` faz SELECT com `.eq('user_id', userId)` antes do INSERT
- `userId` sempre lido do servidor em `page.tsx` via `supabase.auth.getUser()`
- Tokens não são expostos (flows não tocam em bots.token)

### Eventos PostHog

| Evento | Quando | Props |
|---|---|---|
| `flow_created` | ao criar (blank ou template) | `{ flow_name }` |
| `flow_published` | ao publicar | `{ flow_name, node_count }` |
| `flow_deleted` | ao confirmar exclusão | `{}` |

### Execução de fluxo pelo webhook (app/api/telegram/webhook/route.ts)

O webhook implementa um motor de execução de fluxo completo com estado persistido em `contacts`:

```
Recebe /start (novo contato):
  → carrega active_flow_id do bot → loadFlow(flowId) → findStartNode()
  → executeFlowNode(startNodeId, …, depth=0) — recursivo até pausa ou terminal

Recebe mensagem de texto (flow_node_id ≠ null):
  → salva resposta em flow_vars[variavel_do_nó] → avança para próximo nó

Recebe callback_query (botão clicado):
  → answerCallbackQuery → busca edge pelo índice do botão (sourceHandle matching)
  → executeFlowNode(nextNodeId, …)

Funções auxiliares:
  tgApi(token, method, body)               — fetch base para Telegram API
  sendTelegramPhoto(token, chatId, photo)  — envia imagem (nó image)
  sendTelegramWithKeyboard(…, keyboard)    — InlineKeyboard para nó buttons/link
  buildEdgeMap(edges): Map<source, edges[]> — lookup O(1)
  findStartNode(nodes, edges)              — nó sem arestas de entrada
  subVars(text, flowVars, firstName, bot)  — substitui {nome}/{email}/{bot}/{data}
  clearFlowState(contactId, supabase)      — flow_id=null, flow_node_id=null
  loadFlow(flowId, supabase)               — SELECT flows WHERE status='published'
```

**Nós suportados na execução:**

| Tipo | Comportamento | Estado salvo |
|---|---|---|
| `message` | Envia texto, avança automaticamente | — |
| `question` | Envia texto, pausa aguardando resposta | `flow_node_id` |
| `buttons` | Envia InlineKeyboard, pausa | `flow_node_id` |
| `tag` | Adiciona/remove tag no contato, avança | — |
| `delay` | Pulado (sem espera real), avança | — |
| `image` | Envia foto (sendPhoto), avança | — |
| `link` | Envia botão inline com URL, avança | — |
| `offer` | Envia texto formatado com preço + CTA, avança | — |
| `condition` | Pega primeiro branch disponível, avança | — |
| `end` / `handoff` | Terminal — limpa estado do fluxo | — |

**Estado persistido na tabela `contacts` (migração 064):**
- `flow_id`: fluxo ativo (FK para flows, ON DELETE SET NULL)
- `flow_node_id`: nó aguardando resposta (null = sem espera ativa)
- `flow_vars`: JSONB com variáveis capturadas (`{"nome": "João", "email": "j@x.com"}`)

### Pendências conhecidas (backlog)

| Item | Prioridade |
|---|---|
| Confirmação ao sair com mudanças não salvas | 🔴 Alta |
| Copiar/colar nó (Ctrl+C/V) | 🟢 Baixa |
| Export/Import JSON | 🟢 Baixa |
| Estatísticas reais (executions++ no webhook) | 🟢 Baixa |
| Keyword trigger no webhook (detectar palavras-chave e iniciar fluxo) | 🟢 Baixa |
