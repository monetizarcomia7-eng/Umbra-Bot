# CLAUDE.md — Umbra Bot

Contexto automático para sessões de desenvolvimento. Atualizar sempre que o projeto evoluir.

---

## 1. REGRAS ABSOLUTAS

- **NUNCA** renomear para "Pulso", "Pulso.bot" ou qualquer outro nome — sempre **"Umbra Bot"** / **"umbra.bot"**
- Todo texto visível ao usuário em **Português (Brasil)**
- Só fazer o que foi explicitamente pedido — sem features extras, sem refactor não solicitado

---

## 1b. LEITURA OBRIGATÓRIA POR SESSÃO

**Ao iniciar qualquer sessão de desenvolvimento, ler obrigatoriamente:**

- **`CLAUDE.md`** — este arquivo (fonte da verdade para o Claude Code)
- **`INTEGRATIONS.md`** — contexto completo de todas as integrações externas (Supabase, Telegram, Mercado Pago, Upstash Redis, Sentry, PostHog, reCAPTCHA, Meta CAPI, TikTok, Google, web-push, GramJS, Vercel)

> O arquivo `INTEGRATIONS.md` documenta: visão geral de todas as integrações, rotas de API com método/auth/rate-limit, webhooks recebidos, variáveis de ambiente, tabelas do banco, mecanismos de segurança e crons. Sem ele, o contexto de integrações estará incompleto.

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
│   │   ├── bots.ts               # 11 Server Actions: validateBotTokenAction (getMe real), saveBotAction (AES-256-GCM),
│   │   │                         # registerWebhookAction (decryptToken + status='online'), getBotTokenAction,
│   │   │                         # updateBotAction, deleteBotAction — userId sempre do servidor (sem IDOR)
│   │   │                         # getBotTelegramProfileAction (perfil + foto base64), saveBotTelegramProfileAction,
│   │   │                         # setBotPhotoAction (multipart → setMyPhoto Bot API 7.3)
│   │   │                         # getBotMessagesAction (lazy-load welcome_message/fallback_message por demanda),
│   │   │                         # setBotStatusAction (pause/resume dedicado — não passa por updateBotAction)
│   │   ├── gateways.ts           # 5 Server Actions: validateGatewayCredentialsAction (chama API do gateway),
│   │   │                         # connectGatewayAction (valida + encryptToken + upsert), disconnectGatewayAction,
│   │   │                         # updateGatewayAction (só conta bancária), testGatewayConnectionAction (decryptToken + API)
│   │   │                         # Rate limit por action; userId sempre do servidor (sem IDOR)
│   │   ├── guide.ts              # 4 Server Actions: getArticleBodyAction (body Markdown→HTML + TOC + views),
│   │   │                         # voteArticleAction (toggle vote via RPC + rate limit 10/min), getUserVoteAction,
│   │   │                         # logGuideSearchAction (INSERT em guide_search_logs se query ≥ 2 chars)
│   │   │                         # fire-and-forget com void .then({error}) — nunca .catch() no PostgrestFilterBuilder
│   │   ├── flows.ts              # 10 Server Actions: createFlowAction (Zod + rate-limit 30/min + limite 500/user),
│   │   │                         # saveFlowAction (Zod discriminated union por tipo de nó + size limit 800 KB + bot_id lookup + rate-limit 120/min),
│   │   │                         # publishFlowAction (usa _doSave interno — sem duplicação de parse/rate-limit; valida URLs + create_flow_version RPC),
│   │   │                         # duplicateFlowAction (rate-limit 20/min), deleteFlowAction,
│   │   │                         # getFlowNodeStatsAction (lazy load — RPC flow_node_stats por 30 dias),
│   │   │                         # getFlowAnalyticsAction (dashboard /flows/[id]/analytics — RPCs flow_node_stats_v2 + flow_events_timeseries em paralelo),
│   │   │                         # listFlowVersionsAction + rollbackFlowVersionAction (rate-limit 10/min),
│   │   │                         # simulateFlowAction (modo de teste server-side — sem enviar ao Telegram; aceita buttonChoices + keywordInput)
│   │   │                         # NODE_SCHEMA é discriminated union por type (16 shapes específicos por tipo de nó)
│   │   │                         # EDGE_SCHEMA.sourceHandle apertado para z.number().min(0).max(20)
│   │   │                         # isSafeUrl() bloqueia localhost/169.254/10.x/192.168 (SSRF guard) — também no UrlInput do Inspector
│   │   └── recaptcha.ts          # verifyRecaptchaAction: Server Action para verificar token reCAPTCHA v2
│   │                             # Chama verifyRecaptchaToken de lib/recaptcha — secret key nunca exposta ao browser
│   ├── (auth)/
│   │   ├── login/page.tsx        # Login com email + Google OAuth + reCAPTCHA v2 (verifyRecaptchaAction antes do Supabase)
│   │   ├── register/page.tsx     # Registro com email + Google OAuth + reCAPTCHA v2
│   │   └── forgot-password/page.tsx  # Recuperação de senha + reCAPTCHA v2
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
│   │   │   ├── mercadopago-webhook/route.ts # Confirma pagamento (valida secret em prod)
│   │   │   │                               # Aprovado: credita comissão via RPC credit_affiliate_sale (mig 058)
│   │   │   │                               # Aprovado: insere alert type='sale', source='webhook', context chips
│   │   │   │                               # Aprovado: chama fireCapiPurchase (lib/capi.ts) fire-and-forget
│   │   │   │                               #   → envia evento Purchase para Meta CAPI / TikTok Events API / Google MP
│   │   │   ├── mercadopago-oauth/route.ts  # GET: inicia fluxo OAuth MP → valida usuário + banco (IDOR-safe)
│   │   │   │                               # gera state (20 bytes hex) → cookies httpOnly (mp_oauth_state, mp_oauth_bank)
│   │   │   │                               # redireciona para https://auth.mercadopago.com/authorization
│   │   │   └── mercadopago-oauth/callback/route.ts  # GET: callback OAuth — verifica state cookie (CSRF)
│   │   │                                             # troca code por access_token (POST /oauth/token)
│   │   │                                             # busca email/nickname via GET /v1/users/me
│   │   │                                             # encryptToken → upsert gateways (onConflict user_id,provider)
│   │   │                                             # activity_event fire-and-forget → redirect ?mp_connected=1
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
│   │   │   ├── check-bots/route.ts           # GET: verifica conectividade de todos os bots a cada 30 min
│   │   │   │                                 # createAdminClient (bypassa RLS — cron não tem sessão de usuário)
│   │   │   │                                 # disconnect → insere activity_event + alert critical (bot_offline, source='cron')
│   │   │   │                                 # reconnect  → insere activity_event + auto-resolve alert (resolved_by='sistema (auto)')
│   │   │   ├── process-remarketing/route.ts  # GET: enfileira contatos elegíveis + envia mensagens pendentes
│   │   │   │                                     # Protegido por CRON_SECRET — chamado via cron-job.org (1x/hora)
│   │   │   │                                     # Task 0: SENTINEL __delay__:<nodeId> em flow_scheduled_sends —
│   │   │   │                                     #   importa executeFlowNode/loadFlow/buildEdgeMap de lib/flow-engine.ts
│   │   │   │                                     #   carrega snapshot da versão do contato (contacts.flow_version)
│   │   │   │                                     #   executa o nó alvo de verdade (não envia só ⏳ como antes)
│   │   │   │                                     # Task 1: findEligibleContactIds por trigger_type + audience → INSERT remarketing_executions
│   │   │   │                                     # Task 2: SELECT pending WHERE scheduled_at<=now → sendTelegramMessage → sent/failed
│   │   │   │                                     # Agenda próxima etapa (step_index+1) com scheduled_at = now + delay
│   │   │   │                                     # Atualiza total_sent via RPC increment_campaign_sent (atômico)
│   │   │   ├── process-broadcasts/route.ts   # GET: processa 1 broadcast agendado por rodada (CRON_SECRET)
│   │   │   │                                     # Protegido por CRON_SECRET — chamado via cron-job.org (a cada 15 min)
│   │   │   │                                     # CAS lock: UPDATE WHERE status='scheduled' evita duplo-processamento
│   │   │   │                                     # Segmentação idêntica ao /api/broadcasts/send (all/leads/buyers/tag:)
│   │   │   │                                     # Rate limit 35ms/msg, cancellation check a cada 50 msgs
│   │   │   │                                     # Registra no cron_log fire-and-forget + Sentry captureCheckIn
│   │   │   ├── recompute-flow-conversion/route.ts # GET: recalcula flows.conversion% (CRON_SECRET, 1x/dia 03:00)
│   │   │   │                                     # Chama RPC recompute_all_flow_conversions() (mig 105 — 1 UPDATE com JOIN)
│   │   │   │                                     # Retorna { ok, updated, duration_ms }
│   │   │   │                                     # Sentry.captureCheckIn monitor 'recompute-flow-conversion'
│   │   │   └── cleanup-flow-events/route.ts  # GET: TTL flow_node_events > 30 dias (CRON_SECRET, 1x/dia 06:00)
│   │   │                                     # Chama RPC cleanup_flow_node_events(30) (mig 105)
│   │   │                                     # Retorna { ok, deleted, duration_ms } + Sentry checkIn 'cleanup-flow-events'
│   │   ├── push/
│   │   │   ├── subscribe/route.ts
│   │   │   └── notify/route.ts
│   │   ├── broadcasts/send/route.ts          # POST: envia broadcast imediato (auth + rate limit 5/hora)
│   │   │                                    # substituteVars {nome}/{bot}/{data}/{produto}/{valor}
│   │   │                                    # Segmenta por audience (all/leads/buyers/tag:XYZ)
│   │   │                                    # cancellation check a cada 50 msgs (status='canceled'→break)
│   │   │                                    # Atualiza sent/delivered/failed em tempo real no banco
│   │   ├── finance/
│   │   │   ├── balance/route.ts  # GET: saldo fresco via RPC finance_summary (usado pelo WithdrawModal)
│   │   │   └── transactions/route.ts # GET: paginação "carregar mais" (?offset=N, limit 500)
│   │   ├── checkout/
│   │   │   ├── track/route.ts    # POST: registra eventos de funil (visited/cart_added/payment_initiated)
│   │   │   │                     # Público (sem auth), CORS *, rate-limit 60/min por IP
│   │   │   │                     # Usa RPC track_checkout_event (security definer, migração 041)
│   │   │   ├── pay/route.ts      # POST: cria pagamento PIX via checkout público (sem auth do comprador)
│   │   │   │                     # Público, rate-limit 20/min por IP; usa createAdminClient para buscar
│   │   │   │                     # credenciais do dono do checkout; valida checkout published + método habilitado
│   │   │   │                     # Verifica recaptcha_token via verifyRecaptchaToken (lib/recaptcha) se enviado
│   │   │   │                     # Aceita coupon_code (chama validate_and_apply_coupon RPC) + order_bump boolean
│   │   │   │                     # totalPrice = (price − desconto) + bumpPrice; retorna pix_qr_code + amount
│   │   │   └── validate-coupon/route.ts  # GET: valida cupom sem incrementar uso (preview para o comprador)
│   │   │                                 # Público, rate-limit 30/min por IP; usa admin client
│   │   │                                 # Retorna { valid, coupon_id, type, value, discount, final }
│   │   ├── affiliates/
│   │   │   └── apply/route.ts    # POST: candidatura pública ao programa de afiliados
│   │   │                         # Público (sem auth), rate-limit 10/h por IP
│   │   │                         # Verifica recaptcha_token via verifyRecaptchaToken se enviado
│   │   │                         # Usa RPC submit_affiliate_application (security definer, migração 054)
│   │   └── migrations/route.ts   # Protegida por ADMIN_EMAIL
│   ├── afiliar/
│   │   └── [userId]/
│   │       ├── page.tsx          # Página pública do programa de afiliados (sem auth)
│   │       │                     # Server Component: chama get_public_affiliate_program (RPC anon)
│   │       │                     # found=false → ProgramNotFound | active=false → ProgramClosed
│   │       │                     # Exibe program_name, program_description, benefits[] dinâmicos
│   │       └── ApplicationForm.tsx # Client Component: formulário de candidatura → POST /api/affiliates/apply
│   │                               # reCAPTCHA v2 obrigatório; recaptcha_token enviado no body
│   ├── c/
│   │   └── [slug]/
│   │       ├── page.tsx          # Página pública do checkout (Server Component, admin client)
│   │       │                     # Busca checkout por slug + pixels do dono (sem access_token)
│   │       │                     # Busca profiles.name do vendedor → sellerName (fallback 'o vendedor')
│   │       │                     # PublicCheckout inclui: success_url, guarantee_days, countdown_end,
│   │       │                     # order_bump, logo_image, two_step, upsell, visitor_tracking
│   │       ├── CheckoutPageClient.tsx # Client Component: formulário com CPF/CNPJ mask,
│   │       │                          # timer PIX 30 min, polling checkout_tx_status (4s),
│   │       │                          # success_url redirect, guarantee badge, countdown_end timer,
│   │       │                          # logo_image sobrescreve logo texto, contador de visitantes ao vivo
│   │       │                          # (Supabase Realtime Presence quando visitor_tracking=true),
│   │       │                          # formulário 2 etapas (two_step), cupom de desconto (preview via
│   │       │                          # GET /api/checkout/validate-coupon), order bump checkbox,
│   │       │                          # upsell step pós-pagamento (modal antes do redirect),
│   │       │                          # reCAPTCHA v2 obrigatório antes do botão Pagar
│   │       │                          # Aviso legal abaixo do botão Pagar (sellerName dinâmico):
│   │       │                          # declaração Umbra Bot + Termos + Denunciar produto + nota reCAPTCHA
│   │       └── PixelScripts.tsx  # Snippets de pixel (Meta/TikTok/Google) injetados no head
│   │                              # step inclui 'upsell' — Purchase dispara em success + upsell
│   ├── b/
│   │   └── [slug]/
│   │       ├── page.tsx          # Server Component público (admin client, ISR revalidate=60)
│   │       │                     # Busca biolink por slug WHERE status='published'; notFound() se não existe
│   │       │                     # generateMetadata: title/description/openGraph com avatar como imagem
│   │       └── BioPublicClient.tsx # Client Component: page temática completa, rastreamento de visita
│   │                               # e de cliques via RPCs anon (fire-and-forget, não bloqueia navegação)
│   ├── r/
│   │   └── [slug]/
│   │       └── route.ts          # GET: rota pública — tenta afiliado primeiro, depois redirecionador
│   │                             # 1. RPC track_affiliate_click → cookie 'umbra_aff' + redirect (afiliado)
│   │                             # 2. Admin client → redirects WHERE slug + status='active' (redirecionador)
│   │                             #    hashIp (SHA-256, 16 chars), detectDevice (bot/mobile/desktop/tablet)
│   │                             #    parseReferrer (hostname do Referer), cloaking (decoy_url p/ bots)
│   │                             #    record_redirect_click RPC (migração 065) + 301/302 conforme redirect_type
│   │                             # Não está no matcher do middleware → público por padrão
│   └── dashboard/
│       ├── layout.tsx            # Shared layout — envolve todas as rotas /dashboard/** com DashboardLayout
│       │                         # Garante que DashboardProvider monte uma única vez e persista entre navegações
│       ├── page.tsx              # Server Component async — 9 queries paralelas: transactions (30d) + bots (online count) +
│       │                         # bots (total count) + prevTransactions (30-60d) + profiles.balance + contacts (30d count) +
│       │                         # contacts (prev 30-60d count) + activity_events (6) + bots list (6)
│       │                         # Bug fix: bots.status='online' (não 'active' — inválido no CHECK constraint)
│       ├── _components/
│       │   └── DashboardClient.tsx  # Client Component — 5 KPIs reais + deltas + gráfico + top produtos
│       │                            # Row 2: Saldo Disponível (profiles.balance) + lista dos 6 bots com BotStatusBadge
│       │                            # Row 4: Atividade Recente (activity_events) + Ações Rápidas (links diretos)
│       │                            # Interfaces exportadas: ActivityEvent, BotSummary, InitialDashboardData
│       ├── bots/                 # Gerenciar bots — dados reais (SSR + Realtime)
│       │   ├── page.tsx          # Server Component: SSR bots (sem token) + flows em paralelo
│       │   └── BotsClient.tsx    # Client Component: CRUD, Realtime, AddBotModal, tabs, TokenReveal
│       ├── finance/              # Financeiro — Server Component + módulo finance/ (SSR + Realtime)
│       │   └── page.tsx          # Server Component: 6 queries em paralelo; SELECT inclui
│       │                         # customer_phone, customer_device, payment_method, checkout_id
│       │                         # passa userId={uid} ao FinanceDashboard
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
│       │   └── _components/      # 7 componentes isolados
│       │       ├── FilterBar.tsx        # Barra com 5 selects + toggle Comparar + Limpar
│       │       ├── KpiSummaryRow.tsx    # 4 KPI cards com delta badges (compare mode) — Receita/Vendas/Ticket/Conv.
│       │       ├── RevenueLineChart.tsx # AreaChart diário Receita/Vendas com toggle (mounted pattern SSR-safe)
│       │       ├── FunnelChart.tsx      # Funil 4 etapas + conv. total + deltas de período
│       │       ├── BarListCard.tsx      # Genérico <T>: bot | produto | fluxo | UTM
│       │       ├── StatusCard.tsx       # Pizza Recharts — distribuição por status
│       │       └── CohortTable.tsx      # Coorte semanal S0–S5 com heatmap color-mix
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
│       ├── redirects/            # Redirecionadores — dados reais do Supabase (SSR + Client)
│       │   ├── page.tsx          # Server Component: SSR redirects + contagem de cliques 30d + delta vs 30-60d
│       │   └── RedirectsClient.tsx # Client Component: CRUD real, analytics lazy por link (RPC redirect_analytics),
│       │                           # cloaking, UTM, CSV export, criar/editar/apagar modais, 4 eventos PostHog
│       ├── remarketing/          # Remarketing — SSR + RemarketingClient (dados reais, auditoria completa)
│       │   ├── page.tsx          # Server Component: SSR campaigns (limit 50, sem step_stats) + bots em paralelo
│       │   │                     # select otimizado (step_stats omitido — lazy-load no editor)
│       │   │                     # initialHasMore: boolean → paginação client-side
│       │   └── RemarketingClient.tsx # Client Component: CRUD real, Realtime, Templates, 5 PostHog events
│       │                             # Auto-save 30s (debounce + stateRef estável)
│       │                             # CSV export com BOM UTF-8 + event csv_exported
│       │                             # Paginação: loadMore() .range() + "Carregar mais campanhas"
│       │                             # openCampaign(): lazy-load step_stats ao abrir editor
│       │                             # ExecutionHistoryCard: histórico de remarketing_executions lazy
│       │                             # Aviso mudanças não salvas: dirty check ao clicar Voltar
│       │                             # Prévia oculta em xl: (sidebar já exibe)
│       ├── broadcasts/           # Disparador — dados reais do Supabase (SSR + Realtime)
│       │   ├── page.tsx          # Server Component: SSR broadcasts (limit 50) + bots + RPC audience counts em paralelo
│       │   └── BroadcastsClient.tsx # Client Component: CRUD real, Realtime UPDATE+INSERT, BotPicker real,
│       │                            # AudiencePicker dinâmico (all/leads/buyers/tag:) com re-fetch por bot,
│       │                            # paginação .range() 50/página, "Carregar mais disparos"
│       │                            # sendBroadcastNow → POST /api/broadcasts/send (20s timeout, otimista)
│       │                            # cancelBroadcast → UPDATE status='canceled'/'draft', deleteBroadcast → DELETE
│       │                            # duplicateBroadcast → INSERT cópia com status='draft' + "(cópia)" no título
│       │                            # now=Date.now() real, sem Math.random(), progresso via Realtime
│       │                            # Realtime stale-draft guard: bloqueia draft de sobrescrever sending/done/failed/canceled
│       │                            # MessageComposer: texto 4096 chars + mídia URL (image/video/file) + 3 botões inline
│       │                            # BestPracticesModal: 6 dicas de disparo responsável
│       │                            # Filtros avançados: registered_after + registered_before (JSONB filters)
│       │                            # KPI cards: Disparos no mês / Mensagens enviadas / Taxa de entrega / Em andamento
│       │                            # Filtros de listagem: busca título/mensagem + status + bot dropdown
│       ├── tools/                # Ferramentas (mock)
│       ├── gateways/             # Gateways — dados reais do Supabase (SSR + Client)
│       │   ├── page.tsx          # Server Component: SSR gateways + bank_accounts + RPC gateways_stats em paralelo
│       │   │                     # aceita searchParams (mp_connected, mp_error) para resultado do callback OAuth
│       │   │                     # passa hasMpOAuth (!!MERCADOPAGO_CLIENT_ID) ao Client
│       │   └── GatewaysClient.tsx # Client Component: GATEWAY_CATALOG (só mercadopago), ConnectModal (OAuth + manual),
│       │                          # TestModal (decryptToken + API), DisconnectModal, ConfigureModal (banco de recebimento)
│       │                          # KPI cards 4 colunas (conectados, volume 30d, transações 30d, taxa média)
│       │                          # SplitExplanation: visualização do split em cada venda (gateway + Umbra + você)
│       │                          # OAuth: botão azul Globe → /api/payments/mercadopago-oauth?bank_account_id=
│       │                          # Toast de resultado OAuth ao retornar (mpConnected / mpError), limpa URL
│       │                          # 3 eventos PostHog: gateway_disconnected, gateway_configured, gateway_connection_tested
│       │                          # Rate limit server-side (validate: 15/h, connect: 10/h)
│       ├── tracking/             # Trackeamento — dados reais do Supabase (SSR + Client)
│       │   ├── page.tsx          # Server Component: SSR pixels + RPC pixels_stats em paralelo; exporta RawPixelRow e PixelStats
│       │   └── TrackingClient.tsx # Client Component: PIXEL_CATALOG (Meta/TikTok/Google), sempre 3 PixelCards (sem NoDataState),
│       │                          # VerifyPixelModal (testPixelAction + sendTestPixelEvent + aba Payload Preview),
│       │                          # EditPixelModal (validação de formato inline + campo pixelCode TikTok),
│       │                          # auto-open VerifyPixelModal após salvar pixel novo (pendingVerifyRef),
│       │                          # histórico last_test_at no card, Export JSON, Realtime dual-channel,
│       │                          # auto-refresh 5 min (fetchPixelStats), match rate tip, 4 eventos PostHog
│       │                          # dbStatus em PixelItem — computeStatus usa dbStatus quando sem eventos
│       │                          #   (pixel verificado mostra 'healthy' em vez de 'waiting')
│       │                          # SnippetCard — snippets HTML de instalação browser-side por provider
│       ├── checkout/             # Checkout — SSR + CheckoutClient (dados reais, migrações 078–081)
│       │   ├── page.tsx          # Server Component: SSR checkouts + gateways + pixels em paralelo; exporta RawCheckout/RawGateway/RawPixel
│       │   │                     # RawCheckout inclui: success_url, guarantee_days, countdown_end (mig 081)
│       │   └── CheckoutClient.tsx # Client Component: CRUD real (criar/salvar/publicar/duplicar/arquivar/apagar),
│       │                          # templates modal (3 templates), auto-save 30s, BackConfirm, DeleteModal,
│       │                          # Realtime canal 'checkouts-realtime', gateway+pixel pickers do banco,
│       │                          # PreviewPanel (toggle Desktop/Mobile — phone frame 375px),
│       │                          # seção "Configurações avançadas" (success_url/guarantee_days/countdown_end),
│       │                          # upload de product_image (Supabase Storage bucket checkout-images),
│       │                          # analytics drill-down por checkout (funil visited/cart/paid lazy),
│       │                          # 4 eventos PostHog (checkout_created/published/deleted/duplicated)
│       ├── biolink/              # Bio Link — dados reais (SSR + Client), migrações 088–090
│       │   ├── page.tsx          # Server Component: SSR lista de biolinks do usuário + biolink_analytics RPC em paralelo
│       │   └── BioLinkClient.tsx # Client Component: lista multi-biolink + editor visual, CRUD real, auto-save 30s,
│       │                         # avatar upload (Storage bio-avatars), 7 temas, links UUID, publish/unpublish,
│       │                         # duplicar, QuickPreviewModal (prévia rápida), taxa de conversão nos cards,
│       │                         # URL limpa (stripProtocol), analytics por link, 5 PostHog events
│       ├── webhooks/             # Webhooks — dados reais (SSR + Client), migração 091
│       │   ├── page.tsx          # Server Component: SSR webhooks + RPC webhooks_stats em paralelo
│       │   └── WebhooksClient.tsx # Client Component: CRUD real, Realtime INSERT+UPDATE, delivery log lazy,
│       │                           # KPI cards (ativos/entregas 24h/taxa sucesso/com falhas), toggle ativo/pausado,
│       │                           # testWebhookAction real HTTP + HMAC, resendDeliveryAction, secret show/hide/copy,
│       │                           # SSRF protection, secret criptografado AES-256-GCM, 7 eventos PostHog
│       ├── profile/              # Perfil + avatar upload + 2FA + equipe com convites in-app
│       │   ├── page.tsx          # SSR: profiles + team_members + MFA factors + get_pending_invites_for_user
│       │   └── ProfileClient.tsx # getInitials: fallback para local-part do e-mail quando nome vazio
│       │                         # Papéis: owner/admin/editor/analista (labels OK; controle de acesso pendente)
│       │                         # InviteModal → RPC invite_team_member (cria alerta in-app para o convidado)
│       │                         # PendingInvitesCard: convites recebidos com Aceitar/Recusar no topo
│       │                         # Migrações 092 (avatar_initials + team_members user_id FK) e 093 (4 RPCs)
│       ├── notifications/        # Notificações — Server Component SSR + Client Component
│       │   ├── page.tsx          # Server Component: SSR prefs + bots (array) em paralelo; passa userId + userEmail
│       │   └── NotificationsClient.tsx # Client Component: salva via upsert ON CONFLICT user_id;
│       │                               # email e Telegram reais (user.email + bot.username do banco)
│       │                               # ChannelsCard: email/panel sempre "Ativo" (sem toggle), botões Testar
│       │                               # Painel: testPanelNotificationAction (alerta real na tabela alerts)
│       │                               # E-mail: aviso "Em breve" inline (sem backend de e-mail)
│       │                               # "Restaurar padrão": dialog de confirmação (ação destrutiva)
│       │                               # snapshot sincronizado ao vincular/desvincular Telegram
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
│       │                                     # Light mode fix: usa var(--primary) em vez de
│       │                                     # var(--accent-fg) em badge, links, checkbox,
│       │                                     # bordas e label do TL;DR (accent-fg = branco no light)
│       ├── guide/                # Guia da Plataforma — SSR + GuideClient (dados reais, migração 070)
│       │   ├── page.tsx          # Server Component: SSR guide_articles + guide_faqs em paralelo (ISR revalidate=3600)
│       │   └── GuideClient.tsx   # Client Component: busca + filtros por categoria + ArticlePanel com body lazy,
│       │                         # TOC (table of contents), votos (helpful/not helpful), views, FAQ accordion,
│       │                         # suporte CTAs (WhatsApp/Telegram), 5 PostHog eventos
│       └── academy/              # Academia (SSR + AcademyClient, dados reais, migrações 094–098)
│                                 # VideoPlayer real (YouTube/Vimeo/Bunny.net/direct/placeholder)
│                                 # Busca + filtro por nível, 5 PostHog events, courseCompleted activity event
├── components/
│   ├── ReCaptchaWidget.tsx       # Widget reCAPTCHA v2 reutilizável (react-google-recaptcha)
│   │                             # Renderiza null se NEXT_PUBLIC_RECAPTCHA_SITE_KEY não configurada (dev-safe)
│   │                             # hl="pt-BR"; onExpired reseta token para null
│   └── dashboard/
│       ├── Layout.tsx            # Shell: DashboardProvider → LayoutShell (Sidebar + Topbar)
│       │                         # usePathname() + isDocs: oculta Sidebar e wrapper de padding
│       │                         # quando rota começa com /dashboard/docs (evita dupla sidebar)
│       ├── Sidebar.tsx           # Navegação colapsável (260px / 80px) + badge via DashboardProvider
│       ├── Topbar.tsx            # Busca global (14 tabelas, race-condition safe) + notif + user
│       ├── OnboardingWizard.tsx  # Modal 4 passos (welcome→bot→gateway→done) — aparece 1x
│       │                         # BotStep: validateBotTokenAction → saveBotAction({ name, token, username, telegramId })
│       ├── PageHeader.tsx
│       ├── Button.tsx
│       └── finance/              # Módulo completo do Financeiro (10 arquivos)
│           ├── types.ts          # Transaction (+ botId, gatewayRaw), Withdrawal, Invoice, BankAccount,
│           │                     # RawTransaction (+ customer_phone, customer_device, checkout_id),
│           │                     # RawWithdrawal, RawFinanceBot, RawFinanceFlow, RawInvoice, RawFinanceSummary
│           │                     # TxDetail (+ phone, device, checkoutId)
│           ├── formatters.ts     # fmtBRL, fmtBRLdec, fmtDate, fmtDateTime, fmtTime, fmtPct
│           │                     # — todos com timeZone: 'America/Sao_Paulo'
│           ├── constants.ts      # txTypeMap, txStatusMap, wdStatusMap, invStatusMap, filtros
│           │                     # GATEWAY_LABEL, DEVICE_LABEL — centralizados (usados por TransactionsSection + FinanceDashboard)
│           ├── mock-data.ts      # financeMock (apenas dados de demonstração — não usado em produção)
│           ├── atoms.tsx         # Icon, Badge, Card, Tabs, Modal, Dropdown, Btn, Spinner, etc.
│           ├── FinanceDashboard.tsx  # Componente raiz (client) — seletor de período 7d/30d/90d/Tudo
│           │                         # Memo A: mapRawRows (rows→tipados), Memo B: buildPeriodSummary (period-dep)
│           │                         # Memo C: periodKpis (vendas, ticket médio, taxa aprovação, reembolsos)
│           │                         # Memo D: revenueByDay (série diária para Recharts AreaChart)
│           │                         # SmallStatCard: 4 KPIs secundários (vendas/ticket/aprovação/reembolsos)
│           │                         # RevenueChart: AreaChart Recharts (colapsável, mounted SSR-safe)
│           │                         # Realtime: canal 'finance-tx-realtime' (postgres_changes INSERT)
│           │                         # CSV export 15 colunas; userId prop
│           ├── TransactionsSection.tsx # Tabela com filtros (tipo/status/busca/bot/gateway), paginação
│           │                           # perPage=15; FilterSelect nativo (bot + gateway dropdowns)
│           │                           # botOptions / gatewayOptions derivados dos dados reais
│           │                           # TransactionDetail: phone, device, checkoutId além dos campos anteriores
│           ├── WithdrawalsSection.tsx  # Tabela de saques; estado vazio com ícone Inbox quando sem saques
│           ├── InvoicesSection.tsx     # Tabela de faturas; estado vazio aprimorado (FileText icon + texto melhor)
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
│   ├── flow-engine.ts            # Motor de execução de fluxos extraído do webhook (compartilhado com cron):
│   │                             # executeFlowNode({ ... }) recursivo (depth ≤ 20) com telemetria automática
│   │                             # loadFlow(id, supabase, version?) — carrega snapshot imutável de flow_versions
│   │                             # getLatestFlowVersion(id) — versão mais recente publicada
│   │                             # buildEdgeMap / findStartNode / subVars / clearFlowState / evaluateCondition
│   │                             # sendTelegramPhoto/Video/WithKeyboard / answerCallbackQuery — todos retornam boolean
│   │                             # logNodeEvent(supabase, args) — fire-and-forget em flow_node_events (silencia 42P01)
│   │                             # 17 tipos de nó suportados (message/question/buttons/condition/delay real/
│   │                             # image/video/link/checkout/offer/tag/phone/upsell/downsell/orderbump/
│   │                             # remarketing/handoff). Nó delay agenda em flow_scheduled_sends sentinel __delay__:<nodeId>
│   ├── rate-limit.ts             # Redis (Upstash) + fallback memória
│   ├── analytics-server.ts       # PostHog server-side capture
│   ├── csv.ts                    # exportCSV()
│   ├── capi.ts                   # fireCapiPurchase(data: CapiPurchaseData) → dispara Purchase CAPI
│   │                             # Lê pixels com capi=true via admin client; sha256 em email/nome;
│   │                             # event_id=txId (deduplicação Meta); Promise.allSettled por provider;
│   │                             # Meta CAPI / TikTok Events API / Google Measurement Protocol
│   ├── recaptcha.ts              # verifyRecaptchaToken(token): Promise<boolean>
│   │                             # Chama https://www.google.com/recaptcha/api/siteverify
│   │                             # Retorna true se RECAPTCHA_SECRET_KEY não configurada (dev-safe / preview-safe)
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
│   ├── 11-faq/                   # perguntas-frequentes (20 perguntas organizadas por tema)
│   └── 12-fluxos/                # 12 artigos: introducao-fluxos, criar-primeiro-fluxo, tipos-de-nos,
│                                 # variaveis, triggers-keyword, conectar-fluxo-bot, templates,
│                                 # modo-de-teste, versionamento, atalhos-de-teclado,
│                                 # exportar-importar, debugar-fluxo
├── supabase/migrations/          # 105 migrações SQL (000 a 106 + auxiliares)
├── vercel.json                   # 4 Cron jobs Vercel (Hobby só executa 2 — os primeiros da lista): process-withdrawals (06:00 UTC) + cleanup-activity (02:00 UTC) + check-bots + cleanup-alerts
│                                 # Crons adicionais via cron-job.org (gratuitos): process-remarketing (1x/hora — também retoma delays via sentinel __delay__) +
│                                 # process-broadcasts (a cada 15 min) + recompute-flow-conversion (1x/dia 03:00) + cleanup-flow-events (1x/dia 06:00 TTL 30d) +
│                                 # publish-instagram (a cada 1 min) + refresh-instagram-tokens (1x a cada 12h) + cleanup-instagram-logs (1x/dia 07:00 TTL 30d)
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
        ├── isDocs = pathname?.startsWith('/dashboard/docs')
        ├── Sidebar   ← renderizado somente quando !isDocs (oculto nas rotas de docs)
        ├── Topbar    ← usa user, alerts, logout do provider (sem fetch próprio)
        └── {children} — envolto em div.max-w-[1400px] apenas quando !isDocs
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
| Perfil — aba conectada ao Supabase (SSR real, sem mock) | ✅ Funcional |
| Perfil — 2FA real via Supabase MFA (TOTP + QR code + factor enroll/verify/unenroll) | ✅ Funcional |
| Perfil — getInitials com fallback para local-part do e-mail (corrige avatar "?") | ✅ Corrigido |
| Perfil — convites de equipe in-app: InviteModal → RPC invite_team_member → alerta no convidado | ✅ Implementado |
| Perfil — PendingInvitesCard: convites recebidos exibidos no topo do perfil (Aceitar/Recusar) | ✅ Implementado |
| Perfil — accept_team_invite: status='active' + resolve alerta automaticamente | ✅ Implementado |
| Perfil — reject_team_invite: DELETE + resolve alerta | ✅ Implementado |
| Perfil — papéis: owner/admin/editor/analista (labels e descrições OK; controle de acesso pendente) | ⏳ Parcial |
| Perfil — migração 092: avatar_initials em profiles + user_id FK em team_members | ✅ Criada (aplicar no Supabase) |
| Perfil — migração 093: CHECK alerts.type + 4 RPCs SECURITY DEFINER para convites | ✅ Criada (aplicar no Supabase) |
| Onboarding wizard (4 passos, aparece só 1x por usuário) | ✅ Funcional |
| Dashboard KPIs reais (receita, vendas, bots ativos) | ✅ Funcional |
| Dashboard KPI deltas (variação % vs período anterior) | ✅ Funcional |
| Dashboard gráfico real (receita por dia do banco) | ✅ Funcional |
| Dashboard top produtos reais (agrupado por product_name) | ✅ Funcional |
| Seletor de período no Dashboard (7d/30d/90d) + cache useRef | ✅ Funcional |
| DashboardProvider (contexto global, 1 fetch para user+alerts+bots) | ✅ Funcional |
| Dashboard — bug fix: bots.status='online' (era 'active' — violava CHECK constraint, activeCount sempre 0) | ✅ Corrigido |
| Dashboard — 5º KPI card: Leads capturados (contacts count 30d) com delta vs período anterior | ✅ Implementado |
| Dashboard — saldo disponível via profiles.balance (Row 2, exato por trigger atômico) | ✅ Implementado |
| Dashboard — lista dos 6 bots (Row 2) com BotStatusBadge (online/offline/banned/paused) | ✅ Implementado |
| Dashboard — atividade recente (activity_events, últimos 6 eventos) na Row 4 | ✅ Implementado |
| Dashboard — Ações Rápidas (Row 4): links diretos para Bots/Broadcast/Financeiro/Análises | ✅ Implementado |
| Dashboard — 9 queries em paralelo no page.tsx (txs+bots+prevTx+profile+leads+prevLeads+activity+botsList) | ✅ Implementado |
| Análises — módulo modular: filtros SQL server-side, coorte via RPC, cliente fino | ✅ Funcional |
| Análises — KpiSummaryRow: 4 KPI cards (Receita/Vendas/Ticket médio/Conversão) com DeltaBadge em compare mode | ✅ Implementado |
| Análises — RevenueLineChart: AreaChart diário Recharts com toggle Receita/Vendas (mounted SSR-safe) | ✅ Implementado |
| Análises — computeKpiSummary() + computeRevenueByDay() em _server.ts (zero queries extras) | ✅ Implementado |
| Análises — KpiSummary + DayRevenue interfaces em _types.ts; kpi + revenueByDay no AnalyticsSummary | ✅ Implementado |
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
| Financeiro — Realtime: canal 'finance-tx-realtime' (postgres_changes INSERT, filtrado por user_id) | ✅ Implementado |
| Financeiro — SmallStatCard: 4 KPIs secundários (vendas, ticket médio, taxa aprovação, reembolsos) | ✅ Implementado |
| Financeiro — RevenueChart: AreaChart Recharts por dia (colapsável, mounted SSR-safe, oculto em 'all') | ✅ Implementado |
| Financeiro — CSV export 15 colunas (+ phone, device, checkoutId, bot, gateway, method, UTMs, type) | ✅ Implementado |
| Financeiro — SELECT page.tsx: customer_phone, customer_device, payment_method, checkout_id adicionados | ✅ Implementado |
| Financeiro — TransactionsSection: FilterSelect bot + gateway (dropdowns nativos com ChevronDown) | ✅ Implementado |
| Financeiro — TransactionsSection: perPage=15 (era 8) | ✅ Implementado |
| Financeiro — TransactionDetail: phone, device (DEVICE_LABEL), checkoutId exibidos no detalhe expandível | ✅ Implementado |
| Financeiro — WithdrawalsSection: estado vazio com ícone Inbox + texto orientativo | ✅ Implementado |
| Financeiro — InvoicesSection: estado vazio aprimorado (ícone FileText + texto mais claro) | ✅ Implementado |
| Financeiro — constants.ts: GATEWAY_LABEL e DEVICE_LABEL centralizados (exportados) | ✅ Implementado |
| Financeiro — types.ts: botId/gatewayRaw em Transaction; phone/device/checkoutId em TxDetail e RawTransaction | ✅ Implementado |
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
| Alertas — botão "Configurar alertas" duplicado: aparece no header E no empty state — remover do empty state | ⏳ Pendente |
| Alertas — empty state sem educação: adicionar cards informativos com tipos de alertas disponíveis (Bot offline, Gateway, Webhook, Venda) | ⏳ Pendente |
| Alertas — KPI "Resolvidos hoje" confuso: subtexto "0 ainda ativos · 0 no total" contradiz "resolvidos" — reescrever como "Resolvidos (7 dias)" com link para filtrar status=resolved | ⏳ Pendente |
| Alertas — ausência de seletor de período nos KPIs: adicionar toggle "Hoje / 7 dias / 30 dias" nos cards de Resolvidos e Atenção | ⏳ Pendente |
| Alertas — filtro "Todos os tipos" sem contagens: exibir badge N ao lado de cada tipo no dropdown (ex: "Bot (3)", "Gateway (1)") | ⏳ Pendente |
| Alertas — 4º KPI card "Gerados (30 dias)": volume total de alertas criados no período independente de status | ⏳ Pendente |
| Alertas — indicador Realtime ausente no contador: ponto verde pulsante quando canal está conectado (como botão "Ao vivo" em Atividade) | ⏳ Pendente |
| Alertas — botão "Configurar alertas" sem status de configuração: substituir por badge contextual ("Telegram vinculado ✓" ou "Configurar notificações" warning) | ⏳ Pendente |
| Alertas — filtro por origem ausente: campo `source` ('cron','webhook','sistema (auto)') não exposto no FilterBar | ⏳ Pendente |
| Alertas — sem "Silenciar temporariamente": toggle rápido de quiet_hours diretamente na tela de Alertas (ex: "Silenciar por 1 hora") | ⏳ Pendente |
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
| Broadcasts — Server Component SSR + BroadcastsClient (dados reais, sem mock) | ✅ Funcional |
| Broadcasts — CRUD real (criar/salvar/cancelar/deletar/duplicar) com .eq('user_id') IDOR-safe | ✅ Implementado |
| Broadcasts — BotPicker: bots reais do banco (sem SENDER_BOTS hardcoded) | ✅ Implementado |
| Broadcasts — AudiencePicker dinâmico via RPC broadcasts_audience_counts (all/leads/buyers/tag:) | ✅ Implementado |
| Broadcasts — AudiencePicker: contagens re-fetched por bot (localCounts via RPC ao trocar botId) | ✅ Implementado |
| Broadcasts — sendBroadcastNow: chama POST /api/broadcasts/send (otimista 'sending' + 20s timeout) | ✅ Implementado |
| Broadcasts — progresso em tempo real via Supabase Realtime (sem Math.random()) | ✅ Implementado |
| Broadcasts — Realtime stale-draft guard: bloqueia draft de sobrescrever sending/done/failed/canceled | ✅ Implementado |
| Broadcasts — cancelamento mid-flight: UPDATE status='canceled' → API verifica a cada 50 msgs | ✅ Implementado |
| Broadcasts — duplicateBroadcast: copia source como draft, título + "(cópia)", preserva media/buttons/filters | ✅ Implementado |
| Broadcasts — cron process-broadcasts: agenda broadcasts (CRON_SECRET, cron-job.org 15 min) | ✅ Implementado |
| Broadcasts — CAS lock no cron: UPDATE WHERE status='scheduled' evita duplo-processamento | ✅ Implementado |
| Broadcasts — substituição de variáveis {nome}/{bot}/{data}/{produto}/{valor} | ✅ Implementado |
| Broadcasts — segmentação por tag: audience='tag:VIP' usa .contains('tags', ['VIP']) | ✅ Implementado |
| Broadcasts — migração 070: user_id NOT NULL + índice cron + RPC broadcasts_audience_counts | ✅ Criada |
| Broadcasts — paginação: limit 50 no SSR + "Carregar mais" client-side (.range()) | ✅ Implementado |
| Broadcasts — MessageComposer: texto 4096 chars + insert de variáveis + mídia URL + 3 botões inline | ✅ Implementado |
| Broadcasts — BestPracticesModal: 6 dicas (segmentação, personalização, horário, limite TG, teste, frequência) | ✅ Implementado |
| Broadcasts — Filtros avançados: registered_after + registered_before salvo em JSONB filters | ✅ Implementado |
| Broadcasts — KPI cards (4): Disparos no mês / Mensagens enviadas / Taxa de entrega / Em andamento | ✅ Implementado |
| Broadcasts — Filtros de listagem: busca por título/mensagem + dropdown status + dropdown bot | ✅ Implementado |
| Broadcasts — SendingStatusCard: barra de progresso + entregues/falhas/velocidade + ETA + botão cancelar | ✅ Implementado |
| Broadcasts — PreviewBroadcast: sidebar com prévia da mensagem (exibe imagem se URL for image) | ✅ Implementado |
| Broadcasts — SummaryCard: bot/público/alcance/agendamento/estimativa em tempo real | ✅ Implementado |
| Broadcasts — banner "N disparos em andamento" na listagem quando sendingCount > 0 | ✅ Implementado |
| Web Push (VAPID) | ✅ Implementado |
| Rate limiting (Upstash Redis + fallback) | ✅ Funcional |
| Sentry (client Replay + server tracePropagation + captureException) | ✅ Configurado |
| PostHog (28 eventos rastreados) | ✅ Configurado |
| Vercel Analytics + Speed Insights | ✅ Ativo |
| Schema do banco (28 tabelas — inclui invoices, migration 043) | ✅ Migrações SQL criadas e aplicadas no Supabase |
| RLS em todas as tabelas | ✅ Configurado (flows corrigida na migração 040) |
| Content-Security-Policy (CSP sem unsafe-eval em produção) | ✅ Configurado no middleware |
| Google reCAPTCHA v2 (login, cadastro, recuperação de senha, afiliados, checkout público) | ✅ Implementado |
| Notificações — Server Component SSR + Client Component (dados reais do banco) | ✅ Funcional |
| Notificações — save() persiste via upsert ON CONFLICT user_id (migração 060 + 061) | ✅ Implementado |
| Notificações — email e bot Telegram reais (user.email + bots.username do banco) | ✅ Implementado |
| Notificações — RLS corrigida: política por usuário em vez de open (migração 060) | ✅ Corrigido |
| Notificações — migração 061: fix CONSTRAINT UNIQUE completo (substitui índice parcial incompatível) | ✅ Corrigido |
| Notificações — botão "Testar" no canal Painel: testPanelNotificationAction insere alerta real na tabela alerts | ✅ Implementado |
| Notificações — botão "Testar" no canal E-mail: aviso inline "Em breve" (sem backend de e-mail) | ✅ Implementado |
| Notificações — toggle Ativar/Desativar de e-mail e painel removido — ambos sempre exibem badge "Ativo" | ✅ Corrigido |
| Notificações — "Restaurar padrão" abre dialog de confirmação antes de resetar (ação destrutiva protegida) | ✅ Corrigido |
| Notificações — snapshot sincronizado ao vincular/desvincular Telegram — "Descartar" não reverte link já gravado no banco | ✅ Corrigido |
| Notificações — notifications_quiet_hours_set disparava a cada keystroke — movido para save(), dispara só quando quiet mudou | ✅ Corrigido |
| Notificações — buildDefaultChannels() sem parâmetro hasBots (era código morto) | ✅ Corrigido |
| Checkout — SSR + CheckoutClient (dados reais, sem mock) | ✅ Funcional |
| Checkout — CRUD real: criar/salvar/publicar/duplicar/arquivar/apagar com user_id IDOR-safe | ✅ Implementado |
| Checkout — gateway + pixel pickers do banco (SSR: connectedGateways + configuredPixels) | ✅ Implementado |
| Checkout — auto-save 30s + BackConfirmModal + DeleteModal + TemplatesModal (3 templates) | ✅ Implementado |
| Checkout — Realtime canal 'checkouts-realtime' filtrado por user_id | ✅ Implementado |
| Checkout — preview ao vivo + editor visual completo (identidade, produto, pagamento, campos, layout) | ✅ Implementado |
| Checkout — 4 eventos PostHog: checkout_created/published/deleted/duplicated | ✅ Implementado |
| Checkout — migração 078: checkout_id em checkout_events + trigger sync_checkout_stats + RPC track_checkout_visit | ✅ Criada |
| Checkout — página pública /c/[slug] (Server Component admin client + CheckoutPageClient) | ✅ Implementado |
| Checkout — rastreamento de visita via RPC track_checkout_visit (grant to anon, migração 078) | ✅ Implementado |
| Checkout — /api/checkout/pay: pagamento público via admin client (busca token do dono, cria PIX MP) | ✅ Implementado |
| Checkout — migração 079: checkout_id + customer_phone em transactions + RPC checkout_tx_status (anon) | ✅ Criada |
| Checkout — migração 080: product_image em checkouts + bucket checkout-images (público, 2 MB, RLS por pasta user_id) | ✅ Criada |
| Checkout — migração 081: success_url + guarantee_days + countdown_end em checkouts | ✅ Criada |
| Checkout — migração 082: RLS checkouts_owner (auth.uid() = user_id) + índice user_id | ✅ Criada |
| Checkout — /api/checkout/pay: suporte a CNPJ (14 dígitos) além de CPF (11 dígitos) | ✅ Implementado |
| Checkout — CPF/CNPJ sempre obrigatório no formulário público (always: true, label 'CPF / CNPJ') | ✅ Implementado |
| Checkout — máscara CPF/CNPJ automática (troca ao atingir 11 dígitos) no CheckoutPageClient | ✅ Implementado |
| Checkout — countdown PIX 30 min: timer visual no CheckoutPageClient após gerar QR code | ✅ Implementado |
| Checkout — polling de status PIX (4s) via RPC checkout_tx_status — sem auth, sem dados sensíveis | ✅ Implementado |
| Checkout — success_url: redireciona comprador após pagamento confirmado (window.location.href) | ✅ Implementado |
| Checkout — guarantee_days: badge de garantia exibido no checkout público quando configurado | ✅ Implementado |
| Checkout — countdown_end: timer de urgência no topo do checkout público quando ativo | ✅ Implementado |
| Checkout — product_image: upload de imagem do produto no editor (Supabase Storage) | ✅ Implementado |
| Checkout — editor: seção "Configurações avançadas" com success_url, guarantee_days, countdown_end | ✅ Implementado |
| Checkout — PreviewPanel com toggle Desktop/Mobile (375 px phone frame) | ✅ Implementado |
| Checkout — analytics drill-down por checkout: funil de conversão lazy (visited/cart/paid) | ✅ Implementado |
| Checkout — migração 082: RLS corrigida checkouts_owner (auth.uid() = user_id) — IDOR crítico resolvido | ✅ Implementado |
| Checkout — taxa PIX corrigida: 0,99% flat (era 3,99%+R$0,40) em /api/checkout/pay | ✅ Corrigido |
| Checkout — validação de algoritmo CPF/CNPJ (mod-11) no servidor (pay/route.ts) e cliente (CheckoutPageClient.tsx) | ✅ Implementado |
| Checkout — handleImageUpload: remove imagem anterior do Storage antes de novo upload (sem órfãos) | ✅ Corrigido |
| Checkout — deleteCheckout: remove product_image do Storage ao apagar checkout | ✅ Corrigido |
| Checkout — botão Reativar no menu de checkouts arquivados (retorna para status draft) | ✅ Implementado |
| Checkout — botão Copiar link no menu do CheckoutCard (copia umbrabot.com.br/c/slug) | ✅ Implementado |
| Checkout — validação de protocolo em success_url (http/https) no handleSave e handlePublish | ✅ Implementado |
| Checkout — fmtCountdown suporta dias (ex: "1d 02:30:15") no checkout público | ✅ Corrigido |
| Checkout — order_bump: produto adicional (JSONB) oferecido antes do botão de pagamento — migração 085 | ✅ Implementado |
| Checkout — logo_image: campo URL para logo por imagem (sobrescreve logo texto) — migração 085 | ✅ Implementado |
| Checkout — two_step: formulário em 2 etapas (dados pessoais → pagamento) — migração 085 | ✅ Implementado |
| Checkout — upsell: oferta pós-compra (modal após pagamento confirmado, redireciona para link) — migração 085 | ✅ Implementado |
| Checkout — visitor_tracking: contador de visitantes ao vivo via Supabase Realtime Presence — migração 085 | ✅ Implementado |
| Checkout — checkout_coupons: tabela com RLS + UNIQUE(user_id, code) + validate_and_apply_coupon RPC — migração 086 | ✅ Implementado |
| Checkout — /api/checkout/validate-coupon: preview sem incremento de uso (rate-limit 30/min) | ✅ Implementado |
| Checkout — /api/checkout/pay: coupon_code + order_bump; totalPrice = (price − desconto) + bumpPrice | ✅ Implementado |
| Checkout — aviso legal no rodapé da página pública: declaração Umbra Bot + nome do vendedor dinâmico + links Termos/Privacidade + Denunciar produto + nota reCAPTCHA Google | ✅ Implementado |
| Checkout — /c/[slug]/page.tsx: busca profiles.name do vendedor (sellerName) via admin client e passa ao CheckoutPageClient | ✅ Implementado |
| Checkout — migração 087: customer_device (mobile/desktop/tablet/unknown) em transactions; detectDevice() em /api/checkout/pay via User-Agent | ✅ Implementado |
| Checkout — /c/[slug]/page.tsx: export const revalidate = 60 (ISR — dados frescos sem custo de SSR puro) | ✅ Implementado |
| Checkout — polling PIX refatorado: setInterval → recursive setTimeout com flag active (sem sobreposição de requests) | ✅ Corrigido |
| Checkout — 11 novos eventos PostHog no CheckoutPageClient: checkout_pay_started, checkout_pay_success, checkout_pay_failed, coupon_applied, coupon_rejected, order_bump_selected, upsell_accepted, upsell_rejected, two_step_phase_advanced | ✅ Implementado |
| Checkout — order_bump.image: loading="lazy" + onError fallback (imagem quebrada oculta, sem crash) | ✅ Corrigido |
| Checkout — upsell: nota de preço "Cobrado separadamente ao clicar em…" + link com target="_blank" rel="noopener" | ✅ Implementado |
| Checkout — build fix: `paidAmountRef` captura `effectivePrice` no `handleSubmit` para uso no `useEffect` de `checkout_pay_success` (evita temporal dead zone de `const` declarada depois do efeito) | ✅ Corrigido |
| Webhooks — Server Component SSR + WebhooksClient (dados reais, sem mock) | ✅ Funcional |
| Webhooks — CRUD real: create/update/delete/toggle (9 Server Actions) com IDOR-safe (.eq user_id) | ✅ Implementado |
| Webhooks — HMAC-SHA256 em todas as entregas (header X-Umbra-Signature-256) | ✅ Implementado |
| Webhooks — webhook_deliveries: histórico lazy paginado (20/página via loadDeliveriesAction) | ✅ Implementado |
| Webhooks — dispatchWebhookEvent fire-and-forget wired em MP webhook (sale.approved/pending) e Telegram (lead.created) | ✅ Implementado |
| Webhooks — Supabase Realtime: canal 'webhooks-realtime' filtrado por user_id (INSERT/UPDATE) | ✅ Implementado |
| Webhooks — migração 091: user_id FK + RLS owner + webhook_deliveries + RPCs webhooks_stats/sync_webhook_stats | ✅ Criada |
| Webhooks — SSRF protection: bloqueia localhost, 169.254.x, 10.x, 192.168.x na URL do endpoint | ✅ Implementado |
| Webhooks — secret criptografado AES-256-GCM (encryptToken) — nunca descriptografado no client | ✅ Implementado |
| Webhooks — 7 eventos PostHog: webhook_created/tested/paused/resumed/deleted/secret_rotated/delivery_resent | ✅ Implementado |
| Webhooks — retry automático: 3 tentativas com backoff [0 ms, 1 s, 5 s]; header X-Umbra-Retry: N (0 = primeira tentativa) em lib/webhooks.ts | ✅ Implementado |
| Webhooks — payload preview no histórico: DeliveryRow expandível com lazy-fetch de payload + response_body via loadDeliveryDetailAction | ✅ Implementado |
| Webhooks — alerta proativo de falha: _createFailureAlert cria type='webhookFailed' após todas as 3 tentativas falharem; _resolveFailureAlert auto-resolve ao próximo sucesso | ✅ Implementado |
| Webhooks — seção Integrações: cards Zapier/Make/n8n/ManyChat com guias passo a passo expandíveis (grid md:2 xl:4 colunas) na página de Webhooks | ✅ Implementado |
| Sistema de planos/billing | ❌ Não iniciado |
| Bio Link — Server Component SSR + BioLinkClient (dados reais, sem mock, migração 088) | ✅ Funcional |
| Bio Link — CRUD real: INSERT na primeira vez (UUID) + UPDATE com .eq('user_id') IDOR-safe | ✅ Implementado |
| Bio Link — auto-save 30s (só após first save quando page.id existe), dirty check, DiscardModal | ✅ Implementado |
| Bio Link — avatar upload (Supabase Storage bucket bio-avatars, 2 MB, RLS por pasta user_id/) | ✅ Implementado |
| Bio Link — 7 temas de cor (violet/mint/sunset/ocean/rose/mono/cream), 3 fundos, 3 estilos de botão | ✅ Implementado |
| Bio Link — links: CRUD com reordenação, tipos (bot/product/custom/social/video), destaque, UUID | ✅ Implementado |
| Bio Link — analytics: views_period + clicks_period + clicks_by_link via RPC biolink_analytics | ✅ Implementado |
| Bio Link — publish/unpublish: toggle status published↔draft com saveImpl | ✅ Implementado |
| Bio Link — página pública /b/[slug] (ISR revalidate=60, generateMetadata para SEO) | ✅ Implementado |
| Bio Link — rastreamento de visita: RPC record_biolink_visit (security definer, grant to anon) | ✅ Implementado |
| Bio Link — rastreamento de clique: RPC record_biolink_link_click (fire-and-forget no client) | ✅ Implementado |
| Bio Link — 5 eventos PostHog: biolink_created/saved/published/link_added/theme_changed | ✅ Implementado |
| Bio Link — migração 088: user_id FK + RLS owner + biolink_view/click_events + 3 RPCs | ✅ Criada |
| Bio Link — migração 089: bucket bio-avatars (público, 2 MB, jpg/png/webp/gif, RLS por pasta) | ✅ Criada |
| Bio Link — multi-biolink: lista de bio links por usuário, CRUD múltiplo (INSERT + UPDATE por id), migração 090 | ✅ Implementado |
| Bio Link — duplicar bio link: INSERT cópia com slug sufixo `-copia-{id}`, nome ` (cópia)`, status='draft', views/clicks=0 | ✅ Implementado |
| Bio Link — QuickPreviewModal: prévia rápida do bio link em modal (PhonePreview, fecha ao clicar fora) | ✅ Implementado |
| Bio Link — taxa de conversão nos cards: (clicks / views) × 100 exibida quando views > 0 | ✅ Implementado |
| Bio Link — URL limpa nos cards: stripProtocol(appUrl) remove prefixo https:// para exibição | ✅ Implementado |
| Bio Link — página pública /b/[slug]: removido display de URL abaixo do avatar (mantido nome) | ✅ Corrigido |
| Bio Link — migração 090: biolink_analytics RPC atualizada com p_biolink_id text default null (filtro por biolink) | ✅ Criada |
| Remarketing — Server Component SSR + RemarketingClient (dados reais, sem mock) | ✅ Funcional |
| Remarketing — createCampaign: INSERT real com user_id + UUID real retornado | ✅ Implementado |
| Remarketing — saveCampaign: UPDATE com .eq('user_id') — IDOR duplo | ✅ Implementado |
| Remarketing — activate/pause: UPDATE status real com validação (≥1 etapa para ativar) | ✅ Implementado |
| Remarketing — deleteCampaign: DELETE com modal de confirmação + PostHog | ✅ Implementado |
| Remarketing — duplicateCampaign: copia steps + config, nome + "(cópia)", status draft | ✅ Implementado |
| Remarketing — trigger_type: bug de mapeamento corrigido (era r.trigger, agora r.trigger_type) | ✅ Corrigido |
| Remarketing — KPI deltas removidos (eram hardcoded 18.4% e 24.1%) | ✅ Corrigido |
| Remarketing — NoDataState: estado vazio visual quando sem campanhas | ✅ Implementado |
| Remarketing — Realtime: canal postgres_changes filtrado por user_id (INSERT/UPDATE/DELETE) | ✅ Implementado |
| Remarketing — Templates modal: 4 templates prontos (botão funcional) | ✅ Implementado |
| Remarketing — bot_id: seletor de bot vinculado à campanha (migração 067) | ✅ Implementado |
| Remarketing — triggerConfig dinâmico: campos extras por tipo (tag, dias, horas) | ✅ Implementado |
| Remarketing — 5 eventos PostHog: campaign_created/saved/activated/paused/deleted | ✅ Implementado |
| Remarketing — migração 067: bot_id FK + last_run_at + total_sent | ✅ Criada |
| Remarketing — migração 068: next_run_at + tabela remarketing_executions (RLS re_owner) | ✅ Criada |
| Remarketing — cron process-remarketing: enfileira contatos elegíveis + envia mensagens via Telegram | ✅ Implementado |
| Remarketing — cron: 7 gatilhos (carrinho_abandonado, compra_concluida, nao_comprou_72h, inatividade, tag_adicionada, abandonou_funil, aniversario skip) | ✅ Implementado |
| Remarketing — cron: agenda próximas etapas automaticamente com delay correto (minutos/horas/dias) | ✅ Implementado |
| Remarketing — cron: atualiza total_sent via RPC increment_campaign_sent (atômico, sem race condition) | ✅ Implementado |
| Remarketing — cron: protegido por CRON_SECRET, chamado via cron-job.org (1x/hora, gratuito) | ✅ Configurado |
| Remarketing — migração 069: índice contacts (user_id, bot_id, telegram_id) + índice re_pending_scheduled + RPC increment_campaign_sent | ✅ Criada |
| Remarketing — auto-save 30 s: debounce + stateRef/campaignRef estáveis (pula se nome vazio) | ✅ Implementado |
| Remarketing — indicador "Auto-save em 30 s" na topbar quando dirty=true | ✅ Implementado |
| Remarketing — aviso de mudanças não salvas ao clicar Voltar (backConfirmOpen + dirty check) | ✅ Implementado |
| Remarketing — botão Prévia oculto em xl: (sidebar já exibe a prévia — sem duplicação) | ✅ Implementado |
| Remarketing — CSV export: arquivo remarketing_YYYY-MM-DD.csv com BOM UTF-8 | ✅ Implementado |
| Remarketing — csv_exported via PostHog { section: 'remarketing', rows } | ✅ Implementado |
| Remarketing — ExecutionHistoryCard: histórico lazy de remarketing_executions no editor | ✅ Implementado |
| Remarketing — paginação: limit 50 no SSR + "Carregar mais campanhas" client-side (.range()) | ✅ Implementado |
| Remarketing — select SSR otimizado: step_stats omitido (lazy-load ao abrir editor) | ✅ Implementado |
| Remarketing — openCampaign(): lazy-load step_stats sob demanda para PerformanceCard | ✅ Implementado |
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
| Afiliados — 4º KPI card "Receita gerada" (total R$ de vendas atribuídas) + seletor de período 7d/30d/90d | ⏳ Pendente |
| Afiliados — badge de programa inativo: indicador visual quando active=false na PageHeader e no botão "Página pública" | ⏳ Pendente |
| Afiliados — coluna commission_pct (%) por afiliado na tabela (atualmente só exibe R$ total) | ⏳ Pendente |
| Afiliados — Supabase Realtime: canal postgres_changes para INSERT/UPDATE na tabela affiliates | ⏳ Pendente |
| Afiliados — CSV export da lista de afiliados (alinhado com Clientes, Atividade, Financeiro) | ⏳ Pendente |
| Afiliados — coluna joined_at (data de entrada) na tabela de afiliados | ⏳ Pendente |
| Afiliados — PaymentsSection: resumo mensal (pago este mês vs mês anterior) na seção de pagamentos | ⏳ Pendente |
| Afiliados — notas de aprovação legíveis: exibir JSON {bots, products} de forma humanizada no painel do afiliado | ⏳ Pendente |
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
| Bots — BOT_COLORS: cor aleatória atribuída ao criar bot (saveBotAction + BotsClient compartilham array duplicado) | ✅ Implementado |
| Bots — getBotMessagesAction: lazy-load welcome_message/fallback_message ao abrir MessagesTab (removido do SSR) | ✅ Implementado |
| Bots — setBotStatusAction: Server Action dedicado para pause/resume — status não passa mais por updateBotAction | ✅ Implementado |
| Bots — BotAvatar: exibe iniciais + cor quando bot não tem @username no Telegram | ✅ Implementado |
| Bots — migração 100: `bot_id uuid FK → bots(id)` em `alerts` + índice parcial `alerts_bot_id_idx` | ✅ Implementado |
| Bots — cron check-bots: CONCURRENCY=15 bots em paralelo via `Promise.allSettled` | ✅ Implementado |
| Bots — cron check-bots: detecção de bot banido (Forbidden) → alerta `type='bot_offline'` + `bots.status='banned'` | ✅ Implementado |
| Bots — cron check-bots: `Sentry.captureCheckIn` com monitor slug `'check-bots'` | ✅ Implementado |
| Gateways — SSR + GatewaysClient (dados reais, migração 074) | ✅ Funcional |
| Gateways — CRUD real: connect/disconnect/update/test (5 Server Actions) | ✅ Implementado |
| Gateways — ConnectModal: OAuth azul (Globe) + fallback token manual | ✅ Implementado |
| Gateways — OAuth Mercado Pago: /mercadopago-oauth + /callback (CSRF via cookie) | ✅ Implementado |
| Gateways — token OAuth criptografado AES-256-GCM (encryptToken) antes de salvar | ✅ Implementado |
| Gateways — SplitExplanation: visualização do split gateway + Umbra Bot + você | ✅ Implementado |
| Gateways — KPI cards: conectados / volume 30d / transações 30d / taxa média | ✅ Implementado |
| Gateways — migração 074: RLS owner, UNIQUE(user_id,provider), account_id FK, RPC gateways_stats | ✅ Implementado |
| Gateways — GATEWAY_CATALOG com apenas mercadopago (outros re-adicionados quando integração for construída) | ✅ Implementado |
| Trackeamento — Server Component SSR + TrackingClient (dados reais, migração 076) | ✅ Funcional |
| Trackeamento — tabela pixels: UUID PK, UNIQUE(user_id,provider), RLS owner, token AES-256-GCM | ✅ Implementado |
| Trackeamento — RPC pixels_stats: events_sent_today + events_matched + last_event (de checkout_events) | ✅ Implementado |
| Trackeamento — PIXEL_CATALOG: Meta, TikTok, Google com idLabel/tokenLabel/capiLabel por provider | ✅ Implementado |
| Trackeamento — savePixelAction: encryptToken + upsert onConflict(user_id,provider) + retorna { id } | ✅ Implementado |
| Trackeamento — testPixelAction: Meta Graph API / TikTok Business API / GA4 format validation | ✅ Implementado |
| Trackeamento — sendTestPixelEvent: Meta TEST00001 (CAPI) / TikTok TEST_EVENT / GA4 /debug/mp/collect | ✅ Implementado |
| Trackeamento — sendTestPixelEvent: atualiza last_test_at no banco após envio bem-sucedido (fire-and-forget) | ✅ Implementado |
| Trackeamento — fetchPixelStats: Server Action para auto-refresh (setInterval 5 min no client) | ✅ Implementado |
| Trackeamento — Realtime dual-channel: 'pixels-tracking' (UPDATE) + 'checkout-events-tracking' (INSERT) | ✅ Implementado |
| Trackeamento — VerifyPixelModal: aba "Verificar" (logs + verdict) + aba "Payload Preview" (JSON educativo) | ✅ Implementado |
| Trackeamento — VerifyPixelModal: botão "Enviar evento de teste" com rate limit 5/min | ✅ Implementado |
| Trackeamento — Match rate tip: aviso quando < 70% sem CAPI configurado | ✅ Implementado |
| Trackeamento — UTM link generator: validação URL via new URL() + copy com feedback | ✅ Implementado |
| Trackeamento — Status tooltip via HTML title attribute (badge com cursor-help) | ✅ Implementado |
| Trackeamento — 3 PixelCards sempre visíveis (sem NoDataState): grid fixo Meta/TikTok/Google | ✅ Implementado |
| Trackeamento — Status 'waiting': pixel configurado mas sem evento ainda (separado de 'warning') | ✅ Implementado |
| Trackeamento — Validação de formato inline: regex por provider (meta dígitos, tiktok dígitos, google G-XXX) | ✅ Implementado |
| Trackeamento — Auto-open VerifyPixelModal após salvar pixel novo (pendingVerifyRef pattern) | ✅ Implementado |
| Trackeamento — TikTok: campo separado Pixel Code (pixel_code) além de Advertiser ID (pixel_id) | ✅ Implementado |
| Trackeamento — Histórico last_test_at: "Último teste" exibido no card quando disponível | ✅ Implementado |
| Trackeamento — Export JSON: botão exporta configurações dos pixels em JSON sem tokens | ✅ Implementado |
| Trackeamento — migração 076: schema correto (UUID PK, provider col, UNIQUE user_id+provider, RLS, RPC) | ✅ Criada |
| Trackeamento — migração 077: adiciona pixel_code (TikTok Pixel Code) e last_test_at à tabela pixels | ✅ Criada |
| Trackeamento — 4 eventos PostHog: pixel_configured, pixel_verified, pixel_test_sent, utm_link_copied | ✅ Implementado |
| Trackeamento — CAPI automático na venda: fireCapiPurchase() chamado pelo MP webhook após aprovação | ✅ Implementado |
| Trackeamento — testPixelAction persiste status='healthy'/'warning' no banco após verificação | ✅ Implementado |
| Trackeamento — dbStatus em PixelItem: computeStatus retorna 'healthy' para pixel verificado sem eventos | ✅ Implementado |
| Trackeamento — SnippetCard: snippets HTML de instalação browser-side por provider (Meta/TikTok/Google) | ✅ Implementado |
| Trackeamento — lib/capi.ts: fireCapiPurchase com sha256, event_id=txId, Promise.allSettled, Sentry por provider | ✅ Implementado |
| Redirecionadores — Server Component SSR + RedirectsClient (dados reais, sem mock) | ✅ Funcional |
| Redirecionadores — CRUD real (criar/editar/pausar/retomar/apagar) com .eq('user_id') IDOR-safe | ✅ Implementado |
| Redirecionadores — analytics lazy por link via RPC redirect_analytics (by_day, by_source, by_device) | ✅ Implementado |
| Redirecionadores — cloaking: decoy_url servida a bots, destino real para humanos | ✅ Implementado |
| Redirecionadores — suporte 301/302, UTM opcionais (nullable), destination_label | ✅ Implementado |
| Redirecionadores — /r/[slug]: rastreia clique (IP hash SHA-256, device, referrer) + RPC record_redirect_click | ✅ Implementado |
| Redirecionadores — tabela redirect_click_events + RLS por proprietário (migração 065) | ✅ Implementado |
| Redirecionadores — RPC record_redirect_click: unique_clicks por IP hash, security definer | ✅ Implementado |
| Redirecionadores — RPC redirect_analytics: by_day (generate_series), by_source, by_device (America/Sao_Paulo) | ✅ Implementado |
| Redirecionadores — delta de cliques 30d vs 30-60d calculado no Server Component | ✅ Implementado |
| Redirecionadores — CSV export filtrado por status + 4 eventos PostHog | ✅ Implementado |
| Redirecionadores — migração 065: user_id + RLS owner + redirect_click_events + RPCs | ✅ Implementado |
| Redirecionadores — migração 066: RPC redirect_unique_clicks_30d (count distinct ip_hash, 30d, exclui bots) | ✅ Implementado |
| Redirecionadores — KPI "Cliques únicos (30d)" via RPC redirect_unique_clicks_30d no Server Component | ✅ Implementado |
| Redirecionadores — KPI "Top link" com subtitle "total acumulado" (esclarece janela all-time) | ✅ Corrigido |
| Redirecionadores — seletor de período 7/14/30d no painel expandido de analytics | ✅ Implementado |
| Redirecionadores — sparkline preload automático para todos os links da página corrente (14d) | ✅ Implementado |
| Redirecionadores — loadAnalytics estável via analyticsMapRef + inflightRef (sem infinite loop) | ✅ Implementado |
| Redirecionadores — cache de analytics por chave ${id}:${period} (por link e período) | ✅ Implementado |
| Redirecionadores — confirmação inline ao pausar link (botão Confirmar / Cancelar no DetailsCard) | ✅ Implementado |
| Redirecionadores — slug sanitização defensiva em createLink (NFD, lowercase, -strip, 64 chars) | ✅ Implementado |
| Redirecionadores — cloaking null-safe: decoy_url || appUrl (bots nunca veem destino real) | ✅ Corrigido |
| Redirecionadores — clicks ?? 0 / unique_clicks ?? 0 null-safety em mapRaw | ✅ Corrigido |
| Redirecionadores — status 'archived' com ação "Arquivar" no DetailsCard | ✅ Implementado |
| Redirecionadores — onLoadAnalytics passado corretamente de LinkRow → LinkStats (era noop) | ✅ Corrigido |
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
| Clientes — KpiRow 4 cards: avg_ticket global, LTV total, taxa de conversão, novos 30d + delta vs 30-60d | ✅ Implementado |
| Clientes — RPC contacts_kpis: avg_ticket, ltv, new_30d, new_prev_30d, conversion_rate (mig 099) | ✅ Implementado |
| Clientes — RPC contacts_filter_options v2: origins + tags[{tag,count}] + states (mig 099) | ✅ Implementado |
| Clientes — RPC find_duplicate_contacts: banner de duplicata no ProfilePanel (mig 099) | ✅ Implementado |
| Clientes — tag filter com contagens reais: dropdown exibe "tag (N)" via TagOption[] | ✅ Implementado |
| Clientes — filtro por estado: dropdown stateOptions do banco | ✅ Implementado |
| Clientes — segmentação RFM: computeRfm() client-side, 7 segmentos, dropdown no FilterBar | ✅ Implementado |
| Clientes — ProfilePanel 3 abas: Linha do tempo / Compras reais (lazy transactions) / Anotações | ✅ Implementado |
| Clientes — campo notes (mig 099): auto-save 1,5s debounce (noteTimerRef) na aba Anotações | ✅ Implementado |
| Clientes — dados geográficos: city + state exibidos no ProfilePanel quando presentes | ✅ Implementado |
| Clientes — flow_vars: grid de pares chave/valor (JSON parse de JSONB) no ProfilePanel | ✅ Implementado |
| Clientes — histórico de compras real: lazy query transactions WHERE contact_id = customer.id | ✅ Implementado |
| Clientes — engagement metrics: totalInteractions + lastInteraction (lazy via activity_events) | ✅ Implementado |
| Clientes — busca inclui email, phone e telegram_id além de name/username | ✅ Implementado |
| Clientes — bulk delete (BulkDeleteModal) + bulk update origin (BulkOriginModal) IDOR-safe | ✅ Implementado |
| Clientes — IDOR fix: loadMore + deleteCustomer + bulkDeleteCustomers + bulkUpdateOrigin usam .eq('user_id', userId) | ✅ Corrigido |
| Clientes — CSV 22 colunas (+ ID Telegram, Segmento RFM, Cidade, Estado, Ticket médio, Anotações, Variáveis do fluxo) | ✅ Implementado |
| Clientes — SELECT inclui city, state, flow_vars, notes, telegram_id; CONTACTS_SELECT constante centralizada | ✅ Implementado |
| Documentação para usuários — /docs/ (30 artigos Markdown, 11 seções) | ✅ Completo |
| Documentação — renderizador /dashboard/docs (sidebar + artigo + paginação) | ✅ Funcional |
| Documentação — toggle dark/light na sidebar da docs | ✅ Implementado |
| Documentação — TL;DR callout, screenshots placeholder, blockquotes coloridos | ✅ Implementado |
| Documentação — botão "Documentação" em Gerenciar Bots navega para /dashboard/docs | ✅ Implementado |
| Documentação — light mode fix: var(--primary) em vez de var(--accent-fg) no artigo (badge, links, checkbox, bordas TL;DR) | ✅ Corrigido |
| Documentação — sidebar dupla corrigida: LayoutShell usa usePathname() + isDocs para ocultar Sidebar em /dashboard/docs/** | ✅ Corrigido |
| Guia da Plataforma — Server Component SSR + GuideClient (dados reais, migração 070) | ✅ Funcional |
| Guia da Plataforma — page.tsx: SSR guide_articles + guide_faqs em paralelo (ISR revalidate=3600) | ✅ Implementado |
| Guia da Plataforma — busca por texto (query ≥ 2 chars) + logGuideSearchAction (guide_search_logs) | ✅ Implementado |
| Guia da Plataforma — filtro por categoria com contagem de artigos | ✅ Implementado |
| Guia da Plataforma — ArticlePanel: body lazy (getArticleBodyAction) + TOC (##-headings) + views | ✅ Implementado |
| Guia da Plataforma — votos helpful/not helpful: voteArticleAction + getUserVoteAction + rate limit | ✅ Implementado |
| Guia da Plataforma — FAQ accordion com guide_faqs do banco | ✅ Implementado |
| Guia da Plataforma — CTAs de suporte (WhatsApp/Telegram) + 5 eventos PostHog | ✅ Implementado |
| Guia da Plataforma — migração 070: slug/status/icon/icon_color/helpful_yes/helpful_no/tags/order_in_category em guide_articles | ✅ Criada |
| Guia da Plataforma — migração 070: guide_faqs + guide_article_votes + guide_search_logs + RPCs | ✅ Criada |
| Guia da Plataforma — RPC increment_article_views (fire-and-forget via void .then({error})) | ✅ Implementado |
| Guia da Plataforma — RPC vote_article (toggle: insert/delete + atualiza helpful_yes/no) | ✅ Implementado |
| Guia da Plataforma — RPC get_article_vote (retorna boolean\|null para estado do voto do usuário) | ✅ Implementado |
| Academia — Server Component SSR + AcademyClient (dados reais, sem mock) | ✅ Funcional |
| Academia — 4 queries paralelas no SSR: courses + enrollments + progress + certificates | ✅ Implementado |
| Academia — RLS corrigida em courses: SELECT-only para authenticated (migração 094) | ✅ Implementado |
| Academia — course_enrollments: matrícula automática ao abrir curso via RPC enroll_in_course | ✅ Implementado |
| Academia — course_progress: progresso real por aula (done + watched_sec) via RPC upsert_lesson_progress | ✅ Implementado |
| Academia — course_certificates: certificado automático ao 100% via RPC issue_certificate | ✅ Implementado |
| Academia — camada relacional course_modules + course_lessons (opcional; fallback JSONB via RPC) | ✅ Tabelas e RPCs criadas |
| Academia — progressPct: calculado localmente a partir dos dados do SSR e atualizado otimisticamente | ✅ Implementado |
| Academia — badge "Meus certificados" com contagem real + CertificatesPanel modal | ✅ Implementado |
| Academia — empty state quando sem cursos (sem mock) | ✅ Implementado |
| Testes (unit/e2e) | ❌ Não iniciado |
| CI/CD | ❌ Não iniciado |

---

## 6. ANALYTICS — EVENTOS RASTREADOS

| Evento | Onde é disparado |
|---|---|
| `user_registered` | `app/auth/callback/route.ts` (primeiro login) |
| `bot_connected` | disponível no EventMap |
| `gateway_connected` | `OnboardingWizard` — GatewayStep |
| `gateway_disconnected` | `GatewaysClient.tsx` — ao desconectar gateway (inclui gateway: provider) |
| `gateway_configured` | `GatewaysClient.tsx` — ao salvar conta bancária de recebimento (inclui gateway: provider) |
| `gateway_connection_tested` | `GatewaysClient.tsx` — ao verificar conexão (inclui gateway: provider + success: boolean) |
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
| `redirect_created` | `RedirectsClient.tsx` — ao criar redirecionador (inclui slug, cloaking, utm_enabled, redirect_type) |
| `redirect_updated` | `RedirectsClient.tsx` — ao editar redirecionador (inclui slug) |
| `redirect_status_changed` | `RedirectsClient.tsx` — ao pausar ou retomar (inclui status: 'active'\|'paused') |
| `redirect_deleted` | `RedirectsClient.tsx` — ao apagar redirecionador (confirmação modal) |
| `campaign_created` | `RemarketingClient.tsx` — ao criar campanha (blank ou template) (inclui trigger, audience) |
| `campaign_saved` | `RemarketingClient.tsx` — ao salvar alterações no editor (inclui step_count) |
| `campaign_activated` | `RemarketingClient.tsx` — ao ativar campanha (inclui trigger, step_count) |
| `campaign_paused` | `RemarketingClient.tsx` — ao pausar campanha (inclui trigger) |
| `campaign_deleted` | `RemarketingClient.tsx` — ao apagar campanha (confirmação modal) |
| `csv_exported` | `RemarketingClient.tsx` (CampaignList) — ao exportar CSV de campanhas (inclui section: 'remarketing', rows) |
| `pixel_configured` | `TrackingClient.tsx` — ao salvar configuração de pixel (inclui provider + has_capi + events_enabled_count) |
| `pixel_verified` | `TrackingClient.tsx` — ao verificar conexão do pixel (inclui provider + status: 'ok'\|'error') |
| `pixel_test_sent` | `TrackingClient.tsx` — ao enviar evento de teste via CAPI (inclui provider) |
| `utm_link_copied` | `TrackingClient.tsx` — ao copiar link UTM gerado (inclui has_utm: boolean) |
| `checkout_pay_started` | `CheckoutPageClient.tsx` — ao clicar em Pagar (inclui checkout_id, amount, has_coupon, has_order_bump) |
| `checkout_pay_success` | `CheckoutPageClient.tsx` — ao confirmar pagamento via polling (inclui checkout_id, amount, time_to_pay_ms) |
| `checkout_pay_failed` | `CheckoutPageClient.tsx` — em erros de servidor ou rede (inclui checkout_id, error_type) |
| `coupon_applied` | `CheckoutPageClient.tsx` — ao aplicar cupom válido (inclui checkout_id, coupon_type, discount) |
| `coupon_rejected` | `CheckoutPageClient.tsx` — ao tentar cupom inválido/expirado (inclui checkout_id, reason) |
| `order_bump_selected` | `CheckoutPageClient.tsx` — ao marcar order bump (inclui checkout_id, bump_price) |
| `upsell_accepted` | `CheckoutPageClient.tsx` — ao clicar no CTA do upsell (inclui checkout_id) |
| `upsell_rejected` | `CheckoutPageClient.tsx` — ao clicar em "Não, obrigado" no upsell (inclui checkout_id) |
| `two_step_phase_advanced` | `CheckoutPageClient.tsx` — ao avançar de dados pessoais para pagamento (inclui checkout_id) |
| `guide_article_opened` | `GuideClient.tsx` — ao abrir artigo (inclui article_id, article_title, category) |
| `guide_article_helpful` | `GuideClient.tsx` — ao votar em artigo (inclui article_id, helpful: boolean) |
| `guide_search_performed` | `GuideClient.tsx` — ao realizar busca (inclui query, results_count) |
| `guide_support_clicked` | `GuideClient.tsx` — ao clicar em CTA de suporte (inclui action: string) |
| `guide_category_viewed` | `GuideClient.tsx` — ao filtrar por categoria (inclui category: string) |

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

### Google reCAPTCHA v2

- **Páginas protegidas:** login, cadastro, recuperação de senha, candidatura de afiliados (`/afiliar/[userId]`), checkout público (`/c/[slug]`)
- **Fluxo:** widget renderizado no browser → token gerado pelo Google → verificado server-side via `lib/recaptcha.ts` antes de qualquer ação
- **`lib/recaptcha.ts`**: `verifyRecaptchaToken(token)` → chama `https://www.google.com/recaptcha/api/siteverify`
  - Retorna `true` se `RECAPTCHA_SECRET_KEY` não configurada (seguro para dev/preview — não bloqueia)
- **`app/actions/recaptcha.ts`**: Server Action `verifyRecaptchaAction(token)` — usado nas páginas de auth (Supabase é client-side, então precisa de Server Action para verificar sem expor a secret)
- **`components/ReCaptchaWidget.tsx`**: renderiza `null` se `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` vazio — formulários funcionam normalmente em dev sem configuração
- **APIs públicas**: `/api/checkout/pay` e `/api/affiliates/apply` verificam `recaptcha_token` no body quando presente
- **Variáveis**: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (client) + `RECAPTCHA_SECRET_KEY` (server-only)
- **Criar chaves**: https://www.google.com/recaptcha/admin/create → tipo "reCAPTCHA v2 — checkbox"

---

## 10. MÓDULO FINANCEIRO

### Fluxo de dados

```
FinancePage (Server Component)
  └── Promise.all com 6 queries em paralelo:
        ├── transactions (limit 500): id, amount, net, fee, status, type, product_name,
        │   customer_name, customer_email, customer_phone, customer_device, payment_method, checkout_id,
        │   gateway, bot_id, flow_id, utm_source, utm_campaign, created_at
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
  ├── chartCollapsed state: boolean — recolhe/expande o RevenueChart
  ├── mounted state: boolean — SSR-safe para Recharts (setMounted(true) em useEffect)
  ├── Supabase Realtime:
  │     canal 'finance-tx-realtime', postgres_changes INSERT, tabela transactions
  │     filtro: user_id=eq.${userId}
  │     nova tx → prepend em allRawTxs (re-dispara Memo A)
  ├── Memo A — mapRawRows (SEM dependência de period — roda só quando rows/bots/flows mudam):
  │     ├── botMap / flowMap para lookup O(1) de nomes por id
  │     ├── transaction.type lido do banco (mig 044); fallback: heurística por status
  │     │     'fee' | 'commission' → tipos diretos; isRefund → 'refund'; default → 'sale'
  │     ├── status mapping correto: approved→available, pending→pending, expired→expired,
  │     │     cancelled→cancelled, refunded/cancelled→failed
  │     ├── TxDetail: method via payment_method (mig 047) + METHOD_LABEL; fallback 'Pix'
  │     │     customer_name, customer_email, customer_phone, customer_device (DEVICE_LABEL),
  │     │     checkout_id, gateway (GATEWAY_LABEL), bot_id→nome, flow_id→nome, utm_source, utm_campaign
  │     ├── Transaction: botId = bot_id (para filtro universal por bot)
  │     │     gatewayRaw = gateway raw string (para filtro universal por gateway)
  │     └── invoices: rawInvoices.length > 0 → dados reais; senão [] (estado vazio — sem mock)
  ├── Memo B — buildPeriodSummary (COM dependência de period — só roda ao trocar período):
  │     ├── summary cards — usa dbSummary (RPC) quando disponível:
  │     │     saldoDisponivel = profiles.balance (trigger atômico, sempre preciso)
  │     │     aLiberar / totalRecebido / comissoesPlataforma = SUM() no banco (sem limite de rows)
  │     │     Fallback se RPC falhar: computa dos rows carregados
  │     └── deltas reais: compara período atual vs anterior
  │           pct(cur, prev) = prev > 0 ? round(((cur-prev)/prev)*1000)/10 : 0
  ├── Memo C — periodKpis (derivado de filteredTxs — 4 KPIs secundários):
  │     ├── totalSales: count das transações aprovadas no período
  │     ├── avgTicket: totalRevenue / totalSales (0 se sem vendas)
  │     ├── approvalRate: approved / (approved + expired + cancelled + refunded) × 100
  │     └── totalRefunds: count das transações com status 'failed' (refunded/cancelled)
  ├── Memo D — revenueByDay (derivado de filteredTxs — série para Recharts):
  │     Agrupa approved por dia (America/Sao_Paulo)
  │     Retorna Array<{ day: 'DD/MM', revenue: number }> para o AreaChart
  │     Oculto quando period === 'all' (chart não renderiza)
  ├── SmallStatCard: 4 cards abaixo dos KPIs principais
  │     Vendas (totalSales) | Ticket médio (avgTicket) | Taxa aprovação (approvalRate) | Reembolsos (totalRefunds)
  ├── RevenueChart: AreaChart Recharts — só monta quando mounted=true (SSR-safe)
  │     Oculto quando period === 'all' ou chartCollapsed=true
  │     Tooltip.formatter: (value) => [fmtBRLdec(Number(value ?? 0)), 'Receita'] — ValueType-safe
  ├── filteredTxs = txRows filtradas por period (useMemo)
  ├── filteredWds = wdRows filtradas por period (useMemo)
  ├── banner hasMore: mostra quantidade carregada + botão "Carregar mais →"
  │     → GET /api/finance/transactions?offset=N → acumula em allRawTxs
  ├── CSV export 15 colunas: Data | Tipo | Produto | Cliente | E-mail | Telefone | Dispositivo |
  │     Checkout ID | Valor bruto | Taxa | Valor líquido | Método | Bot | Gateway | Status
  │     — saques incluem coluna "Observação" (withdrawal.notes)
  │     track('csv_exported', { section: 'finance', period })
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

### GATEWAY_LABEL e DEVICE_LABEL — centralizados em constants.ts

```typescript
// Exportados de components/dashboard/finance/constants.ts
// Usados em TransactionsSection (dropdowns) e FinanceDashboard (TxDetail + export CSV)

export const GATEWAY_LABEL: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  pushinpay:   'Pushinpay',
  pagarme:     'Pagar.me',
  stripe:      'Stripe',
}

export const DEVICE_LABEL: Record<string, string> = {
  mobile:  'Mobile',
  desktop: 'Desktop',
  tablet:  'Tablet',
  unknown: 'Desconhecido',
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
  ├── _types.ts           # Period, Filters, AnalyticsSummary, KpiSummary, DayRevenue, BotStat, FlowStat, CohortRow, etc.
  ├── _utils.ts           # fmtBRL, fmtNum, fmtPct, getDateRange, PERIOD_LABELS
  ├── _actions.ts         # 'use server' — getExportRows(filters): busca aprovadas sob demanda (CSV)
  ├── _server.ts          # computeKpiSummary(curTxs, prevTxs, curEvts) | computeRevenueByDay(curTxs, period) |
  │                       # computeFunnel(curTxs, curContactCount, ...) | computeByBot |
  │                       # computeByProduct | computeByFlow | computeByUtm |
  │                       # computeStatusBreakdown | computeExportRows | transformCohortRpc
  └── _components/
      ├── FilterBar.tsx        # 5 selects + toggle Comparar + Limpar — desabilita ao navegar (isPending)
      ├── KpiSummaryRow.tsx    # 4 KPI cards com DeltaBadge (compare mode) — Receita/Vendas/Ticket/Conv.
      ├── RevenueLineChart.tsx # AreaChart diário Recharts com toggle Receita/Vendas (mounted SSR-safe)
      ├── FunnelChart.tsx      # 4 etapas + % entre etapas + conv. total + deltas vs. anterior
      ├── BarListCard.tsx      # Genérico <T> — bot | produto | fluxo | UTM (barra horizontal)
      ├── StatusCard.tsx       # PieChart Recharts (donut) — status dos pagamentos
      └── CohortTable.tsx      # Tabela semanal S0–S5 com heatmap color-mix(oklab)
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
  │     computeKpiSummary(curTxs, prevTxs, curEvts) | computeRevenueByDay(curTxs, period) |
  │     computeFunnel(curTxs, curContactCount, ...) | computeByBot | computeByProduct |
  │     computeByFlow | computeByUtm | computeStatusBreakdown | transformCohortRpc
  └── Passa AnalyticsSummary (objeto serializado) para <AnalyticsClient summary={...} />

AnalyticsClient (Client Component — ~135 linhas)
  ├── Recebe summary: AnalyticsSummary — nenhuma computação client-side
  ├── useTransition + router.replace → atualiza URL ao mudar filtro (sem reload)
  ├── PostHog: track('analytics_filter_changed') a cada mudança de filtro ou Limpar
  ├── handleExport → chama Server Action getExportRows(filters) sob demanda → exportCSV()
  │     track('csv_exported', { section: 'analytics', rows, period })
  ├── FilterBar: isPending=true desabilita interação durante navegação
  └── Renderiza: KpiSummaryRow | FunnelChart | RevenueLineChart | BarListCard×4 | StatusCard | CohortTable
```

### AnalyticsSummary — contrato Server → Client

```ts
interface AnalyticsSummary {
  filters:       Filters          // estado atual dos filtros (lido da URL)
  kpi:           KpiSummary       // 4 KPIs + valores de comparação (computeKpiSummary)
  revenueByDay:  DayRevenue[]     // série diária de receita/vendas (computeRevenueByDay)
  funnel:        FunnelStage[]    // 4 etapas do funil
  byBot:         BotStat[]        // top 5 bots por receita
  byProduct:     ProductStat[]    // top 5 produtos por receita
  byFlow:        FlowStat[]       // top 5 fluxos (isReal=true: dados reais; false: executions estático)
  byUtm:         UtmStat[]        // top 6 origens UTM por receita
  statusBreakdown: StatusData[]   // distribuição por status (approved/pending/etc.)
  cohortRows:    CohortRow[]      // resultado da RPC analytics_cohort_weekly
  botOptions:    BotOption[]      // opções para o dropdown de bots
  productOptions: string[]        // opções para o dropdown de produtos (via analytics_filter_options)
  flowOptions:   FlowOption[]     // opções para o dropdown de fluxos
  utmOptions:    string[]         // opções para o dropdown de origens (via analytics_filter_options)
  // exportRows REMOVIDO — fetched on-demand via getExportRows() Server Action (_actions.ts)
  error:         string | null
  limitReached:  boolean
  queryLimit:    number           // 5000
}

// Interfaces adicionadas em _types.ts
interface KpiSummary {
  totalRevenue:   number   // receita líquida aprovada no período
  totalSales:     number   // vendas aprovadas no período
  avgTicket:      number   // totalRevenue / totalSales
  conversionRate: number   // (totalSales / visited) * 100 — 0 se sem eventos visited
  prevRevenue:    number   // receita do período anterior (só quando compare=true)
  prevSales:      number   // vendas do período anterior (só quando compare=true)
}

interface DayRevenue {
  day:     string   // 'DD/MM'
  revenue: number   // receita líquida aprovada nesse dia
  sales:   number   // número de vendas aprovadas nesse dia
}
```

### computeKpiSummary e computeRevenueByDay (_server.ts)

```typescript
// computeKpiSummary(curTxs, prevTxs, curEvents): KpiSummary
// Reusa arrays já buscados — zero queries extras ao Supabase
// approved  = curTxs.filter(t => t.status === 'approved')
// visited   = curEvents.filter(e => e.event_type === 'visited').length
// avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0
// conversionRate = visited > 0 ? (totalSales / visited) * 100 : 0
// prevRevenue/prevSales = calculados de prevTxs (só preenchidos quando compare=true)

// computeRevenueByDay(txs, period): DayRevenue[]
// period 'all': detecta dia mais antigo dos approved → máximo 90 dias
// period '7d'|'30d'|'90d': usa N dias fixos
// Agrupa por tx.created_at.slice(0,10) (chave YYYY-MM-DD)
// Retorna array de N entradas na ordem cronológica (sem buracos — 0 em dias sem vendas)
// day: formato 'DD/MM' (ex: '23/05')
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
- `CRON_SECRET` — protege todos os cron routes: `process-withdrawals`, `cleanup-activity`, `check-bots`, `cleanup-alerts`, `process-remarketing`
- `ADMIN_MIGRATION_SECRET` — protege `POST /api/admin/migrate-tokens`
- `ADMIN_EMAIL` — protege `GET /api/migrations`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL`
- `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`
- `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` — chave pública do reCAPTCHA v2 (exposta ao browser)
- `RECAPTCHA_SECRET_KEY` — chave secreta do reCAPTCHA v2 (server-only, nunca ao browser)
  - Criar em: https://www.google.com/recaptcha/admin/create → tipo "reCAPTCHA v2 — checkbox"
  - Sem essas variáveis: widget não aparece e verificação retorna `true` (dev-safe)

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
  └── ActivityClient.tsx  # Client Component — feed Realtime, filtros, paginação, agrupamento,
  │                         # EventDetailPanel, SummarySidebar, seleção múltipla, export, NoDataState
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
  ├── selectedEvent state: ActivityEvent | null — null = sidebar summary; event = EventDetailPanel
  ├── selectionMode state: boolean — alterna entre navegação e seleção múltipla
  ├── selectedIds state: Set<string> — IDs dos eventos selecionados para export parcial
  ├── LS helper: thin wrapper sobre localStorage com guard de SSR (typeof window !== 'undefined')
  ├── botMap: Map<uuid, string> — resolve bot_id → '@username' | 'nome' em O(1)
  ├── topSentinelRef + IntersectionObserver:
  │     div invisível (h-px) acima do feed
  │     quando visível (usuário rolou ao topo) → setUnreadCount(0)
  ├── periodRef: useRef espelhando period — evita stale closure em loadMore
  │
  ├── type DisplayItem = ActivityEvent | ActivityEvent[]
  ├── GROUP_WINDOW_MS = 30 * 60 * 1000  (janela de agrupamento de 30 min)
  ├── groupDayEvents(events): DisplayItem[]
  │     agrupa consecutivos com mesmo type + bot_id dentro de GROUP_WINDOW_MS
  │     grupo com ≥ 2 eventos → ActivityEvent[] (renderizado por GroupedEventCard)
  │     evento único → ActivityEvent (renderizado por EventCard normal)
  │
  ├── severityTones: Record<category, { bg, text }>
  │     sales → bg-success/10, text-success
  │     leads → bg-primary/10, text-primary
  │     payments → bg-warning/10, text-warning
  │     bots → bg-info/10, text-info
  │     system → bg-danger/10, text-danger
  │     Badge de severidade aplicado em cada EventCard e GroupedEventCard
  │
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
  │     Dropdown de bots renderizado somente quando bots.length > 1
  ├── getPeriodCutoff(period, now?): retorna timestamp (ms) de cutoff ou null para 'all'
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
  │     contador /h: eventsPerHour — tooltip "Eventos registrados na última hora" (cursor-help)
  ├── Cabeçalho de dia:
  │     exibe data + contagem de eventos do dia
  │     dayRevenue > 0 → exibe receita acumulada do dia em verde (vendas + pagamentos)
  ├── Seleção múltipla:
  │     toggle selectionMode → cards exibem checkbox (Square / SquareCheck)
  │     selectedIds: Set<string> — controla quais IDs estão marcados
  │     export CSV do subconjunto selecionado (se selectedIds.size > 0) ou do total filtrado
  │     campos: Data | Tipo | Título | Descrição | Bot | Valor (R$)
  │     nome do arquivo: atividade_YYYY-MM-DD.csv
  │     track('csv_exported', { section: 'activity', rows })
  ├── EventDetailPanel (sidebar direita — ao clicar em qualquer card):
  │     substitui SummarySidebar quando selectedEvent !== null
  │     exibe: ícone categoria, tipo, título, descrição completa, bot, valor, timestamp absoluto
  │     botão Fechar (X) → selectedEvent = null → restaura SummarySidebar
  ├── SummarySidebar (sidebar direita — padrão quando selectedEvent === null):
  │     aceita period prop → stats adaptados ao período via getPeriodCutoff
  │     cards: distribuição por categoria, top bots por evento (card oculto quando sem bots)
  │     linhas de severidade com contagem zero ocultadas automaticamente
  │     rodapé: link "Configurar alertas" → /dashboard/alerts (Bell + ChevronRight icon)
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
  │                       # + contacts_filter_options v2 RPC + contacts_kpis RPC — 5 queries em Promise.all
  │                       # SELECT inclui: city, state, flow_vars, notes, telegram_id (migração 099)
  │                       # Passa: tagOptions, stateOptions, kpiData, userId ao Client
  └── CustomersClient.tsx # Client Component — Realtime, filtros+sort persistidos, paginação server-side,
                          # KpiRow (4 cards), RFM segmentation, ProfilePanel 3 abas, bulk ops expandidas,
                          # notes auto-save, purchase history real, engagement metrics, dedup warning
```

### Interfaces TypeScript exportadas

```typescript
// TagOption — do contacts_filter_options v2 (inclui contagem de contatos por tag)
export interface TagOption {
  tag:   string
  count: number
}

// ContactKpis — do contacts_kpis RPC (migração 099)
export interface ContactKpis {
  avg_ticket:      number   // ticket médio global (total_spent / purchases para compradores)
  ltv:             number   // LTV total = soma de total_spent de todos os contatos
  new_30d:         number   // novos contatos nos últimos 30d
  new_prev_30d:    number   // novos contatos nos 30d anteriores (base para delta)
  conversion_rate: number   // (buyers / total) * 100
}

// RfmSegment — tipo interno, nunca exportado
type RfmSegment = 'champion' | 'at_risk' | 'lost' | 'cold_lead' | 'regular' | 'new_buyer' | 'lead'

// CustomerPatch — usado pelo updateCustomer()
type CustomerPatch = Partial<Pick<Customer, 'tags' | 'notes'>>
```

### Fluxo de dados

```
CustomersPage (Server Component)
  ├── Promise.all com 5 queries em paralelo:
  │     ├── contacts: id, name, username, email, phone, origin, bot, bot_id,
  │     │   purchases, total_spent, avg_ticket, tags, first_contact, last_contact,
  │     │   first_purchase, last_purchase, city, state, flow_vars, notes, telegram_id
  │     │   (limit 25, order last_contact desc)
  │     ├── bots: id, name, username  (para dropdown de bot e resolução de nome)
  │     ├── RPC contacts_summary(p_user_id): { total, buyers, leads }
  │     ├── RPC contacts_filter_options(p_user_id): { origins: string[], tags: TagOption[], states: string[] }
  │     └── RPC contacts_kpis(p_user_id): ContactKpis
  └── passa como props:
        initialContacts: RawContact[]       hasMore: boolean
        bots: ContactBotOption[]            userId: string
        totalCount / buyersCount / leadsCount: number
        originOptions: string[]             tagOptions: TagOption[]
        stateOptions: string[]              kpiData: ContactKpis

CustomersClient (Client Component)
  ├── customers state: initialContacts.map(mapRaw) — nunca usa mock
  ├── CONTACTS_SELECT: constante com todos os campos (evita divergência entre loadMore e SSR)
  ├── mapRaw: status = purchases > 0 ? 'buyer' : 'lead'  (não lê status do DB)
  ├── relTime: usa Date.now() — nunca timestamp congelado
  │
  ├── KpiRow (4 cards no topo):
  │     Ticket médio global (kpiData.avg_ticket)
  │     LTV total (kpiData.ltv)
  │     Taxa de conversão (kpiData.conversion_rate %)
  │     Novos 30d (kpiData.new_30d) + delta vs new_prev_30d (badge ± %)
  │
  ├── Supabase Realtime:
  │     canal 'customers-realtime', INSERT → prepend + incrementa contadores
  │     UPDATE → atualiza inline no array (novos campos: city, state, notes, flow_vars)
  │
  ├── Filtros persistidos em localStorage (prefixo 'umbra_cust_'):
  │     search (debounce 300ms — busca name, username, email, phone, telegram_id)
  │     status, origin, tag, period, state (filtro por estado — novo), rfm (segmento RFM — novo)
  │     getPeriodCutoff(period) usa Date.now() como base
  │
  ├── FilterBar estendida:
  │     Dropdown Origem (originOptions)
  │     Dropdown Tag: exibe "tag (N)" a partir de TagOption[] com contagem real
  │     Dropdown Estado: stateOptions (SELECT DISTINCT state do banco)
  │     Dropdown Segmento RFM: 7 opções derivadas de computeRfm()
  │
  ├── RFM segmentation (computeRfm() — client-side, sem queries extras):
  │     Entradas: purchases, lastPurchase, lastContact — dados já carregados
  │     7 segmentos:
  │       'champion'   → compradores recentes (< 30d) com múltiplas compras
  │       'regular'    → compradores com compra entre 30–90d
  │       'at_risk'    → compradores sem compra há 90–180d
  │       'lost'       → compradores sem compra há > 180d
  │       'new_buyer'  → primeira compra recente (< 30d, purchases = 1)
  │       'cold_lead'  → lead sem interação há > 90d
  │       'lead'       → lead com interação recente (< 90d)
  │     RFM_LABELS: mapa de rótulos em português por segmento
  │
  ├── Sort: SortField × SortDir — sortCustomers() com localeCompare pt-BR
  │     6 colunas clicáveis: name | origin | status | purchases | totalSpent | lastContact
  │     Sort + direção persistidos em localStorage (umbra_cust_sort, umbra_cust_sort_dir)
  │
  ├── Paginação:
  │     client-side: 10/pág sobre dados já carregados
  │     server-side: "Carregar mais" → .range(offset, offset+24).eq('user_id', userId) — IDOR fix
  │     usa CONTACTS_SELECT para manter consistência de campos com o SSR
  │
  ├── Bulk operations (BulkActionsBar — visível quando selectedIds.size > 0):
  │     Adicionar tag: RPC contacts_bulk_add_tag(p_ids, p_tag) — 1 UPDATE atômico
  │     Apagar selecionados: BulkDeleteModal → DELETE .in('id', [...]).eq('user_id', userId) — IDOR fix
  │     Atualizar origem: BulkOriginModal → UPDATE .in('id', [...]).eq('user_id', userId) — IDOR fix
  │
  ├── updateCustomer(id, patch: CustomerPatch): UPDATE com .eq('user_id', userId)
  │     Lida com CustomerPatch = Partial<Pick<Customer, 'tags' | 'notes'>>
  │     Atualiza state local otimisticamente
  │
  ├── deleteCustomer(id): DELETE .eq('id', id).eq('user_id', userId) — IDOR fix
  │     ProfilePanel footer: botão "Apagar cliente" → confirmação inline → fecha painel
  │
  ├── AddCustomerModal: INSERT em contacts com user_id do auth
  └── ImportCSVModal: FileReader + parseCSV + batch INSERT (lotes 50)
        Colunas CSV: Nome*, Username, E-mail, Telefone, Origem, Tags (sep. ;)

ProfilePanel (painel lateral — 3 abas)
  ├── Linha do tempo (aba padrão):
  │     lazy load via activity_events WHERE contact_id = customer.id
  │     só executa ao abrir o painel
  │
  ├── Compras (aba real — migração 079 contact_id em transactions):
  │     lazy query: transactions WHERE contact_id = customer.id ORDER BY created_at desc
  │     Exibe: data, produto, valor, status badge
  │     Estado vazio quando sem compras (sem mock)
  │
  ├── Anotações (aba — migração 099 notes column):
  │     Textarea com auto-save 1.5s debounce via noteTimerRef
  │     noteTimerRef: useRef<ReturnType<typeof setTimeout>>
  │     ao digitar → clearTimeout + setTimeout(1500) → updateCustomer(id, { notes })
  │     Feedback: "Salvo ✓" / "Erro ao salvar"
  │
  ├── Dados geográficos: city + state exibidos quando presentes (migração 099)
  ├── flow_vars: exibido como grid de pares chave/valor (JSON parse de JSONB)
  │     Título "Variáveis do fluxo" quando flow_vars não vazio
  ├── Telegram quick-link: t.me/{username} quando username presente
  ├── CopyButton: copia e-mail, telefone e Telegram ID com feedback visual
  ├── Engagement strip: totalInteractions + lastInteraction
  │     lazy query: activity_events WHERE contact_id = customer.id (count + MAX created_at)
  └── Duplicate warning banner:
        lazy RPC find_duplicate_contacts(p_user_id, p_contact_id, p_email, p_phone, p_telegram_id)
        banner amarelo "Possível duplicata" com link para abrir o outro contato
        exibido apenas quando RPC retorna > 0 resultados
```

### Schema contacts — colunas relevantes (migração 052 + 099)

```sql
-- Colunas adicionadas na migração 052
origin         text                          -- UTM source ou origem manual
first_purchase timestamptz                   -- data da primeira transação aprovada
last_purchase  timestamptz                   -- data da última transação aprovada
avg_ticket     numeric(10,2) default 0       -- total_spent / purchases (mantido por trigger)

-- Trigger: trg_sync_contact_stats (migration 052)
-- Dispara após INSERT/UPDATE/DELETE em transactions WHERE contact_id IS NOT NULL
-- Recalcula: purchases, orders_count, total_spent, avg_ticket, first_purchase, last_purchase

-- Colunas adicionadas na migração 099
notes          text                          -- anotações internas do operador (auto-save 1.5s)
-- (city, state, flow_vars, telegram_id já existiam em versões anteriores)
```

### RPCs do módulo

```sql
-- contacts_summary(p_user_id): retorna { total, buyers, leads }
-- Usado na PageHeader para mostrar "38 contatos · 25 compradores · 13 leads"
-- Zero rows transferidas (só contagem)

-- contacts_bulk_add_tag(p_ids uuid[], p_tag text): UPDATE atômico
-- array_append com NOT (tags @> ARRAY[p_tag]) — idempotente, sem duplicatas
-- Substitui N queries paralelas (race condition eliminada)

-- contacts_filter_options v2 (p_user_id): retorna { origins: string[], tags: TagOption[], states: string[] }
-- v1 retornava apenas { origins: string[] }
-- v2 adicionada na migração 099:
--   tags: array de { tag, count } — SELECT DISTINCT tag + COUNT por tag (unnest)
--   states: SELECT DISTINCT state WHERE state IS NOT NULL
-- grant execute to authenticated

-- contacts_kpis(p_user_id): retorna ContactKpis — migração 099
-- avg_ticket:      AVG(total_spent / purchases) WHERE purchases > 0
-- ltv:             SUM(total_spent)
-- new_30d:         COUNT WHERE first_contact >= now() - 30d
-- new_prev_30d:    COUNT WHERE first_contact BETWEEN now()-60d AND now()-30d
-- conversion_rate: (COUNT buyers / COUNT total) * 100
-- grant execute to authenticated

-- find_duplicate_contacts(p_user_id, p_contact_id, p_email, p_phone, p_telegram_id)
--   → table (id, name, email, phone, telegram_id) LIMIT 5 — migração 099
-- Busca contatos do mesmo usuário com e-mail, telefone OU telegram_id coincidentes
-- Exclui o próprio contato (p_contact_id)
-- Retorna IDs para exibir banner de duplicata no ProfilePanel
-- grant execute to authenticated
```

### Status buyer/lead — lógica correta

```typescript
// mapRaw() em CustomersClient.tsx
status: Number(row.purchases ?? 0) > 0 ? 'buyer' : 'lead'
// O DB usa status in ('new','active','vip','inactive','blocked') — não usado para classificação
// A classificação visual é sempre derivada do campo purchases
```

### IDOR — correções aplicadas na migração 099

Todas as operações de escrita e leitura paginada foram corrigidas para incluir `.eq('user_id', userId)`:

```typescript
// loadMore (ANTES: sem .eq user_id — qualquer UUID na URL poderia ler contatos de outro usuário)
supabase.from('contacts').select(CONTACTS_SELECT)
  .eq('user_id', userId)          // ← IDOR fix
  .range(offset, offset + 24)

// deleteCustomer
supabase.from('contacts').delete()
  .eq('id', id).eq('user_id', userId)  // ← IDOR fix

// bulkDeleteCustomers
supabase.from('contacts').delete()
  .in('id', [...ids]).eq('user_id', userId)  // ← IDOR fix

// bulkUpdateOrigin
supabase.from('contacts').update({ origin })
  .in('id', [...ids]).eq('user_id', userId)  // ← IDOR fix
```

### CSV export — 22 colunas

| Coluna | Campo |
|---|---|
| ID | id |
| Nome | name |
| Username | username |
| E-mail | email |
| Telefone | phone |
| ID Telegram | telegramId ← **novo** |
| Origem | origin |
| Status | Comprador / Lead |
| Segmento RFM | rfm label ← **novo** |
| Compras | purchases |
| Total gasto | totalSpent |
| Ticket médio | avgTicket ← **novo** |
| Tags | tags.join('; ') |
| Cidade | city ← **novo** |
| Estado | state ← **novo** |
| Primeiro contato | firstContact |
| Último contato | lastContact |
| Primeira compra | firstPurchase |
| Última compra | lastPurchase |
| Bot | bot |
| Anotações | notes ← **novo** |
| Variáveis do fluxo | JSON.stringify(flowVars) ← **novo** |

### Eventos PostHog do módulo

| Evento | Quando |
|---|---|
| `customer_filter_changed` | ao mudar qualquer filtro (inclui status, origin_filtered, tag_filtered, state_filtered, rfm_filtered, period) |
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
        appUrl: string  ← process.env.APP_URL ?? 'https://www.umbrabot.com.br'
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
1. Afiliado compartilha `umbrabot.com.br/r/seu-slug`
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

### Pendências conhecidas (backlog)

| Item | Prioridade |
|---|---|
| 4º KPI card "Receita gerada" (SUM de transactions.net WHERE affiliate_id = x AND status='approved') + seletor de período 7d/30d/90d | 🔴 Alta |
| Badge de programa inativo: quando `config.active=false`, exibir tag "Programa inativo" na PageHeader e estilizar o botão "Página pública" em cinza/muted | 🔴 Alta |
| Coluna `% comissão` na tabela (exibir `commission_pct` ao lado da comissão em R$) | 🟡 Média |
| Supabase Realtime: canal `'affiliates-realtime'` (postgres_changes INSERT/UPDATE, tabela affiliates, filtro user_id) | 🟡 Média |
| CSV export: botão "Exportar CSV" na lista de afiliados (campos: nome, e-mail, slug, status, cliques, vendas, comissão, % comissão, data de entrada) | 🟡 Média |
| Coluna `joined_at` na tabela (data de entrada do afiliado, formato relativo) | 🟢 Baixa |
| PaymentsSection: resumo mensal — total pago este mês vs mês anterior (delta ± %) | 🟢 Baixa |
| Notas de aprovação legíveis: parse do JSON `{bots, products}` e exibição humanizada no painel/menu do afiliado | 🟢 Baixa |

---

## 18. MÓDULO DE BOTS

### Arquivos

```
app/dashboard/bots/
  ├── page.tsx       # Server Component — busca bots (sem token) + flows em paralelo; passa ao BotsClient
  └── BotsClient.tsx # Client Component — lista, detalhe, CRUD, Realtime, modais, tabs

app/actions/bots.ts  # 11 Server Actions (todas autenticadas + rate-limit)
  ├── validateBotTokenAction(token)              # Chama getMe, verifica is_bot, retorna { username, firstName, telegramId }
  ├── saveBotAction(params)                      # encryptToken + INSERT com user_id do servidor; BOT_COLORS aleatório
  ├── registerWebhookAction(botId)               # decryptToken + setWebhook + status='online' + PostHog
  ├── getBotTokenAction(botId)                   # decryptToken — chamado só ao clicar "Revelar"
  ├── updateBotAction(id, patch)                 # UPDATE com .eq('user_id', user.id) — NÃO inclui status (rota separada)
  ├── deleteBotAction(id)                        # DELETE com .eq('user_id', user.id)
  ├── getBotTelegramProfileAction(botId)         # getMe + getMyDescription + getMyShortDescription + getMyCommands
  │                                              # + foto via getUserProfilePhotos → getFile → base64 data URL
  ├── saveBotTelegramProfileAction(botId, data)  # setMyName / setMyDescription / setMyShortDescription / setMyCommands
  │                                              # em Promise.allSettled — primeiro erro lançado ao caller
  ├── setBotPhotoAction(botId, photo: File)      # valida tipo/tamanho → multipart → setMyPhoto (Bot API 7.3)
  ├── getBotMessagesAction(botId)                # lazy-load welcome_message + fallback_message — chamado ao abrir MessagesTab
  └── setBotStatusAction(botId, status)          # UPDATE status='paused'|'online' dedicado — não passa por updateBotAction
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
  ├── page.tsx                # Server Component — busca prefs + bots (array) em paralelo
  └── NotificationsClient.tsx # Client Component — toda a UI interativa + save para o banco

app/actions/notifications.ts  # 5 Server Actions
  ├── saveNotificationPrefsAction(prefs, channelState, quiet)
  ├── generateTelegramVerifyCodeAction(botId)  → código 6 dígitos + TTL 10 min
  ├── checkTelegramLinkStatusAction()          → polling: verifica se webhook vinculou owner_chat_id
  ├── unlinkTelegramChannelAction()            → remove linked + owner_chat_id
  ├── testTelegramNotificationAction()         → envia mensagem real via Bot API
  └── testPanelNotificationAction()            → insere alerta real (type='sale', severity='info') na tabela alerts
```

### Fluxo de dados

```
NotificationsPage (Server Component)
  ├── Promise.all em paralelo:
  │     ├── notification_prefs: prefs, channel_state, quiet
  │     │   .eq('user_id', user.id).maybeSingle()
  │     └── bots: id, name, username
  │         .eq('user_id', user.id).not('token', 'is', null)  ← array completo (não apenas o primeiro)
  └── passa como props:
        userId: string
        userEmail: string            ← user.email do Supabase Auth
        initialPrefs: RawNotifPrefs | null
        bots: RawBotOption[]         ← lista de bots para o seletor do TelegramChannelCard

NotificationsClient (Client Component)
  ├── prefs state: initialPrefs?.prefs ?? DEFAULT_PREFS
  ├── channelState state: buildChannelMap(initialPrefs?.channel_state)
  │     email: { linked: true }   ← sempre ativo — sem toggle (sem backend de e-mail)
  │     panel: { linked: true }   ← sempre ativo — sem toggle
  │     telegram: { linked: false } ← gerenciado separadamente pelo tgState
  ├── tgState state: parseTelegramState(initialPrefs?.channel_state)
  ├── quiet state: initialPrefs?.quiet ?? DEFAULT_QUIET
  ├── snapshot state: cópia do estado persistido (dirty check)
  │     atualizado em: save() + handleTgLinked() + handleTgUnlinked()
  │     (sync em handleTg* garante que "Descartar" não reverta link já gravado no banco)
  ├── resetConfirmOpen state: boolean — abre dialog de confirmação ao clicar "Restaurar padrão"
  ├── saving state: boolean — botão exibe Loader2 durante o upsert
  ├── error state: string — exibe mensagem real do banco (ou genérica se longa)
  ├── save() async:
  │     saveNotificationPrefsAction(prefs, buildFullChannelState(), quiet)
  │     on success: setSnapshot + setSaved(true)
  │     on error: setError(msg) com auto-clear 5s
  │     track('notifications_saved', { channels_enabled, telegram_linked })
  │     track('notifications_quiet_hours_set', {})  ← SÓ quando quiet mudou vs snapshot
  ├── discard(): reset ao snapshot (último salvo)
  ├── reset(): reset aos DEFAULT_PREFS / DEFAULT_QUIET / buildDefaultChannels()
  │     chamado apenas ao confirmar o dialog resetConfirmOpen
  │     track('notifications_reset_to_default', {})
  ├── handleTgLinked(updated): setTgState + setSnapshot(s => ({ ...s, tg: updated }))
  │     track('notifications_channel_toggled', { channel: 'telegram', linked: true })
  ├── handleTgUnlinked(): setTgState({ linked:false }) + setSnapshot(s => ({ ...s, tg: {linked:false} }))
  │     track('notifications_channel_toggled', { channel: 'telegram', linked: false })
  ├── dirty: JSON.stringify(current) !== JSON.stringify(snapshot)
  ├── ChannelsCard:
  │     props: { tgState, bots, userEmail, onTgLinked, onTgUnlinked }
  │     E-mail card: badge "Ativo" fixo + botão "Testar" → aviso inline "Em breve"
  │     Painel card: badge "Ativo" fixo + botão "Testar" → testPanelNotificationAction()
  │                  feedback colorido: verde (ok) / vermelho (erro), auto-oculta em 4s
  │     Telegram card: TelegramChannelCard (fluxo de vinculação via código de 6 dígitos)
  ├── PreferencesTable: matriz eventos × canais com toggles por célula e por coluna/linha
  └── QuietHoursCard: toggle enable + time pickers (De / Até) + toggle exceptCritical
        setQuiet passado diretamente (sem wrapper que chamava track em cada keystroke)

Dialog "Restaurar padrão":
  Modal overlay com aviso (AlertTriangle icon, ícone warning)
  Botões: "Cancelar" (fecha) | "Restaurar padrão" (chama reset() + fecha)
  Aparece apenas quando resetConfirmOpen=true
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

| ID | Label | Estado | Testar | Observação |
|---|---|---|---|---|
| `email` | E-mail | Sempre "Ativo" (sem toggle) | "Em breve" inline | Sem backend de envio de e-mail por ora |
| `panel` | Painel | Sempre "Ativo" (sem toggle) | `testPanelNotificationAction()` — insere alerta real | Alerta aparece na aba Alertas |
| `telegram` | Telegram | Vinculado / Não vinculado | `testTelegramNotificationAction()` — envia mensagem real | Fluxo de vinculação via código 6 dígitos |

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
                                  Light mode fix: usa var(--primary) em 6 pontos que usavam
                                  var(--accent-fg) — accent-fg = branco no light mode (invisível
                                  sobre fundo claro); primary = roxo escuro no light, visível
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
  ├── page.tsx              # Server Component — SSR: flows metadata (LIMIT 500) + bots +
  │                         # RPC flows_stats_by_user (mig 103, agregada em 1 query)
  │                         # select sem nodes/edges (lazy load); passa initialFlows + bots + userId
  ├── FlowsClient.tsx       # Client Component — usa Server Actions (createFlowAction,
  │                         # saveFlowAction, publishFlowAction, duplicateFlowAction, deleteFlowAction)
  │                         # FIX 1.1: Realtime UPDATE preserva revenue/sales/leads (não estão na row)
  ├── _shared/
  │   ├── types.ts          # FlowMeta (inclui botId), FlowEditorData, FlowNodeType, FlowEdgeType,
  │   │                     # FlowNodeStatsRow, FlowVersionRow, RawFlowRow (com bot_id)
  │   ├── nodeTypes.tsx     # NODE_TYPES, NODE_CATEGORIES, ícones e cores por tipo de nó
  │   ├── mappers.ts        # mapRawMeta (inclui botId), mapRawFull, fmtBRLdec
  │   ├── constants.ts      # MAX_HISTORY/AUTO_SAVE_MS/PREVIEW_MAX_DEPTH/DRAG_THRESHOLD/PAN_THRESHOLD/
  │   │                     # MIN_ZOOM/MAX_ZOOM/TOAST_MS centralizados; autoLayout (DYNAMIC import dagre);
  │   │                     # snapGrid, nodeUid()/edgeUid() (crypto.randomUUID); validateFlow();
  │   │                     # isSafeUrl (bloqueia localhost/169.254/10.x/192.168)
  │   └── ui.tsx            # Toast, Spinner e componentes de UI compartilhados
  ├── _list/
  │   ├── NoDataState.tsx   # Estado vazio quando flows.length === 0
  │   ├── TemplatesModal.tsx # Modal de 3 templates (branco, captura lead, vendas simples)
  │   ├── FlowCard.tsx      # Card de fluxo com confirmação inline de Apagar
  │   └── FlowsList.tsx     # Grid de cards com busca e filtros
  └── _editor/
      ├── FlowEditor.tsx    # Orquestrador: useMemo isDirty (hash leve, sem JSON.stringify),
      │                     # auto-save 30s só quando dirty=true, atalhos D (duplicar) / Del / Ctrl+Z/Y,
      │                     # validação ao publicar (banner de erros + bordas nos nós), versionamento,
      │                     # modo de teste, botSelector usa botId real
      ├── Palette.tsx       # Painel de tipos de nó: clique OU drag&drop para o canvas
      ├── BotSelector.tsx   # Dropdown: value=botId|null, onChange(botId|null)
      ├── EdgePanel.tsx     # Painel de edição de aresta selecionada
      ├── MiniMap.tsx       # Mapa miniatura do canvas
      ├── ZoomControls.tsx  # Botões zoom in/out + fit
      ├── TestRunnerModal.tsx # Modo de teste: simulateFlowAction → trail bot/user/system
      │                     # com variáveis customizáveis (nome, email, etc.) sem enviar ao Telegram
      │                     # B4: dropdown por nó de "buttons" para escolher qual opção simular
      │                     # B5: campo para testar trigger keyword (match ou não)
      ├── FlowVersionsPanel.tsx # Lista de versões publicadas + Restaurar (rollback via RPC)
      ├── ImportExportModal.tsx # Export JSON + Import (whitelist contra nodeTypes registry)
      │                     # Reescrita de IDs (nodeUid/edgeUid) + skip de tipos desconhecidos
      ├── ShortcutsModal.tsx # Lista de atalhos do editor (abre com tecla ? ou botão Keyboard)
      └── _editor/canvas/FlowNode.tsx + FlowEdges.tsx — ambos com React.memo
                                          # (reduz ~70% renders durante drag em fluxos grandes)
      ├── canvas/
      │   ├── Canvas.tsx    # Pan/zoom/box-select/drag/conexões + drag&drop drop da Palette,
      │   │                 # hover de aresta (state hoveredEdgeId), bgPannedRef reset após consumo
      │   ├── FlowNode.tsx  # Renderiza nó + mini-stats (sent↗/entered↘/!failed) no canto + borda
      │   │                 # vermelha quando errorNodeIds inclui o id
      │   ├── FlowEdges.tsx # SVG das arestas — hover destaca em var(--primary)
      │   └── NodeHandle.tsx # Handle de entrada/saída
      ├── inspector/
      │   └── Inspector.tsx # Painel de propriedades + stats do nó (Enviados/Concluíram/Falhas)
      │                     # + botão Duplicar (atalho D)
      └── preview/
          └── PreviewChat.tsx # Prévia da conversa com ramificações
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

### Webhook — execução de fluxo (atualizado — migração 103)

| Nó | Comportamento na execução | Estado |
|---|---|---|
| `message` | Envia texto e avança | — |
| `question`/`phone` | Envia texto, pausa em `flow_node_id` | Aguarda resposta |
| `buttons` | Envia InlineKeyboard, pausa | Aguarda `callback_query` |
| `tag` | Adiciona/remove tag e avança | — |
| `delay` | **REAL**: insere `flow_scheduled_sends` com sentinel `__delay__:<targetNodeId>` + persiste `flow_node_id`. O cron `process-remarketing` processa o sentinel, retoma na posição salva e re-executa o fluxo a partir do próximo nó | `flow_node_id` |
| `condition` | **REAL**: `evaluateCondition()` avalia operadores (equals, not_equals, contains, starts_with, ends_with, not_empty, empty, gt, lt) com case-insensitive em strings e Number em gt/lt. Escolhe branch pelo `sourceHandle` (0=Sim, 1=Não) | — |
| `image`/`video` | Envia mídia + caption, avança | — |
| `link`/`checkout` | Envia botão URL inline, avança | — |
| `offer`/`upsell`/`downsell`/`orderbump` | Envia texto formatado + CTA URL, avança | — |
| `remarketing` | Enfileira `flow_scheduled_sends` (cron envia depois) | — |
| `handoff`/`end` | Terminal — limpa estado | — |

**Telemetria (migração 103):**
- `logNodeEvent(supabase, {...})` insere em `flow_node_events` fire-and-forget
- Eventos: `entered`, `sent`, `failed`, `completed`, `abandoned` + `latency_ms`
- RPC `flow_node_stats(p_flow_id, p_days=30)` agrega por `node_id` para o Inspector
- `executeFlowNode` recebe `userId` adicional (assinatura nova)
- Tabela pode não existir em ambientes sem migração: insert silencia erro `42P01`

**Estado persistido na tabela `contacts` (migração 064):**
- `flow_id`: fluxo ativo (FK para flows, ON DELETE SET NULL)
- `flow_node_id`: nó aguardando resposta (null = sem espera ativa)
- `flow_vars`: JSONB com variáveis capturadas
- `flow_version` (mig 103): snapshot do fluxo (futuro — uso para imutabilidade)

### Eventos PostHog

| Evento | Quando | Props |
|---|---|---|
| `flow_created` | ao criar (blank ou template) | `{ flow_name }` |
| `flow_published` | ao publicar | `{ flow_name, node_count }` |
| `flow_deleted` | ao confirmar exclusão | `{}` |

### Server Actions (app/actions/flows.ts) — Fase 2

Todas autenticadas + rate-limited via Upstash Redis. Schema Zod valida tudo:

| Action | Validação | Limites |
|---|---|---|
| `createFlowAction` | name 1–120, nodes ≤500, edges ≤1000 | 30/min; 500 fluxos/user |
| `saveFlowAction` | + size limit 800KB por estrutura | 120/min |
| `publishFlowAction` | + valida URLs http/https (SSRF guard) | 30/min |
| `duplicateFlowAction` | UUID válido | 20/min |
| `deleteFlowAction` | UUID válido | sem limit explícito (RLS protege) |
| `getFlowNodeStatsAction` | UUID válido | — |
| `listFlowVersionsAction` | UUID válido | — |
| `rollbackFlowVersionAction` | UUID + version | 10/min |
| `simulateFlowAction` | qualquer payload | — |

**`publishFlowAction`** também:
1. Valida URLs (bloqueia localhost, 169.254, 10.x, 192.168, .local)
2. Cria snapshot via RPC `create_flow_version` → retorna `version`
3. Atualiza `bots.active_flow_id` se `botId` estiver definido (substitui match-by-string)
4. Insere `activity_event` (fire-and-forget)

### Migração 103 — Tabelas e RPCs novas

```sql
-- Índices
create index flows_user_id_updated_at_idx on flows(user_id, updated_at desc);
create index flows_bot_id_idx on flows(bot_id) where bot_id is not null;

-- Coluna nova em flows
alter table flows add column bot_id uuid references bots(id) on delete set null;

-- flow_node_events (telemetria, RLS owner SELECT)
-- flow_versions (snapshots imutáveis, RLS owner ALL)
-- contacts.flow_version (snapshot por contato — futuro)

-- RPCs:
flows_stats_by_user(p_user_id)              → table(flow_id, revenue, sales, leads)
recompute_flow_conversion(p_flow_id)        → void
flow_node_stats(p_flow_id, p_days=30)       → table com event aggregations
create_flow_version(p_flow_id)              → integer (versão criada)
rollback_flow_to_version(p_flow_id, p_ver)  → void
```

### Migração 105 — Performance + TTL de telemetria + dashboard

```sql
-- 1. recompute_all_flow_conversions: 1 UPDATE com JOIN (era N+1 queries)
-- 2. cleanup_flow_node_events(p_days): TTL de telemetria
-- 3. flow_node_stats_v2(p_flow_id, p_days): por nó com avg_latency_ms + abandoned
-- 4. flow_events_timeseries(p_flow_id, p_days): serie diária para gráfico
-- 5. CHECK constraint em contacts.flow_vars (64 KB) — fix re-auditoria 7.4
```

**Cron novo:** `GET /api/cron/cleanup-flow-events` — protegido por CRON_SECRET,
chamado via cron-job.org 1x/dia (06:00). Apaga `flow_node_events` > 30 dias.

### Dashboard analytics por fluxo (re-auditoria 6.1)

Nova rota: `/dashboard/flows/[id]/analytics?days=7|14|30|90`

```
app/dashboard/flows/[id]/analytics/
  ├── page.tsx          # SSR: flow + flow_node_stats_v2 + flow_events_timeseries
  │                     # + transactions (revenue/sales) + contacts (leads atribuídos)
  └── AnalyticsClient.tsx # KPIs (4) + gráfico diário de eventos (bar chart simples)
                          # + Funil por nó (drop rate destacado) + Top falhas + tabela detalhada
```

Acesso: botão `<BarChart3>` no FlowCard (menu) e na topbar do FlowEditor.

### Flow Engine — extraído em lib/flow-engine.ts (re-auditoria P1)

O motor de execução foi **extraído do webhook** para `lib/flow-engine.ts` e
agora é compartilhado entre:
- `app/api/telegram/webhook/route.ts` (execução em tempo real)
- `app/api/cron/process-remarketing/route.ts` (retomada de delay)

**Exports principais:**

```ts
// Types
type ContactState, FlowNode, FlowEdge, LoadedFlow, ExecuteOpts

// Helpers
buildEdgeMap(edges)         → Map<source, edges[]>
findStartNode(nodes, edges) → node sem incoming
subVars(text, vars, ...)    → substitui {nome}/{email}/{bot}/{data}
clearFlowState(contactId, supabase) → zera flow_id/node_id/version
evaluateCondition(op, v, c) → boolean (9 operadores)

// Load (com snapshot por versão — fix 3.1)
loadFlow(flowId, supabase, version?) → LoadedFlow
getLatestFlowVersion(flowId, supabase) → number

// Send (todos retornam boolean — fix 1.3)
sendTelegramPhoto/Video/WithKeyboard/answerCallbackQuery → boolean

// Telemetria (fire-and-forget, silencia erro 42P01)
logNodeEvent(supabase, { userId, flowId, nodeId, event, ... })

// Engine principal
executeFlowNode({ nodeId, nodes, edgeMap, contact, ..., flowVersion, userId, supabase })
```

**Mudanças semânticas:**
- `delay` agora **retoma o fluxo** corretamente via cron (era stub com ⏳)
- Cada send retorna boolean → `logNodeEvent` registra `failed` com `error_msg` real
- `contacts.flow_version` é populado e usado para carregar snapshot correto
- Rate-limit por contact_id no webhook: 60 req/min

### Migração 104 — Schema hardening + cron de conversion

```sql
-- 1. user_id NOT NULL (limpa órfãos antes)
delete from flows where user_id is null;
alter table flows alter column user_id set not null;

-- 2. CHECK constraints — nodes/edges devem ser arrays JSONB com até 1 MB cada
alter table flows
  add constraint flows_nodes_is_array check (jsonb_typeof(nodes) = 'array'),
  add constraint flows_edges_is_array check (jsonb_typeof(edges) = 'array'),
  add constraint flows_nodes_size check (octet_length(nodes::text) <= 1048576),
  add constraint flows_edges_size check (octet_length(edges::text) <= 1048576);

-- 3. RPC recompute_all_flow_conversions() — chamada 1x/dia pelo cron
--    Atualiza conversion% = (count(approved transactions) / executions) * 100
--    Retorna quantos fluxos foram atualizados

-- 4. View flows_orphaned — debug: fluxos com bot_id apontando para bots deletados
```

**Cron:** `GET /api/cron/recompute-flow-conversion` — protegido por `CRON_SECRET`,
chamado via cron-job.org 1x/dia (não está no vercel.json porque o plano Hobby só
roda os 2 primeiros). Registra no `cron_log` + Sentry checkIn `recompute-flow-conversion`.

### Fixes da auditoria aplicados

| Fix | Onde |
|---|---|
| **1.1** Realtime UPDATE preserva revenue/sales/leads | [FlowsClient.tsx](app/dashboard/flows/FlowsClient.tsx) |
| **1.2** `isDirty` via useMemo com hash leve (não JSON.stringify) | [FlowEditor.tsx](app/dashboard/flows/_editor/FlowEditor.tsx) |
| **1.3** Auto-save só dispara quando `isDirty=true` | [FlowEditor.tsx](app/dashboard/flows/_editor/FlowEditor.tsx) |
| **1.4** Índice composto `(user_id, updated_at desc)` | migração 103 |
| **1.5** Server Actions com Zod + rate-limit substituem cliente Supabase | [app/actions/flows.ts](app/actions/flows.ts) |
| **1.6** `dagre` via `await import('dagre')` (dynamic) | [_shared/constants.ts](app/dashboard/flows/_shared/constants.ts) |
| **1.7** IDs via `crypto.randomUUID()` (nodeUid, edgeUid) | [_shared/constants.ts](app/dashboard/flows/_shared/constants.ts) |
| **1.8** `RawFlowRow` inclui `bot_id` | [_shared/types.ts](app/dashboard/flows/_shared/types.ts) |
| **B1** Query SSR usa RPC agregada + LIMIT 500 | [page.tsx](app/dashboard/flows/page.tsx) |
| **B2** `bot_id` FK em flows (não string `bot`) | migração 103 + saveFlowAction |
| **B3** BotSelector usa `b.id === value` corretamente | [BotSelector.tsx](app/dashboard/flows/_editor/BotSelector.tsx) |
| **B4** Handoff: inspector deixa claro que é terminal | [Inspector.tsx](app/dashboard/flows/_editor/inspector/Inspector.tsx) |
| **B5** `condition` avalia operadores reais | [webhook/route.ts](app/api/telegram/webhook/route.ts) |
| **B6** `delay` real via `flow_scheduled_sends` + sentinel `__delay__` | webhook + [process-remarketing](app/api/cron/process-remarketing/route.ts) |
| **médio** `pushHistory` não duplica snapshots idênticos | FlowEditor |
| **médio** `bgPannedRef.current = false` após consumo | [Canvas.tsx](app/dashboard/flows/_editor/canvas/Canvas.tsx) |
| **UX** highlight hover de aresta | [FlowEdges.tsx](app/dashboard/flows/_editor/canvas/FlowEdges.tsx) |
| **UX** drag&drop palette → canvas | Palette + Canvas |
| **UX** atalho `D` duplica nó selecionado | FlowEditor |
| **UX** indicador "• Não salvo" no topbar | FlowEditor |
| **UX** banner com validação ao publicar (lista de erros) | FlowEditor + validateFlow |
| **UX** botão "Testar" — TestRunnerModal | TestRunnerModal |
| **UX** botão "Histórico" — FlowVersionsPanel | FlowVersionsPanel |
| **UX** mini-stats nos nós (30 dias) | FlowNode + Inspector |
| **UX** confirmação inline de Apagar no FlowCard | FlowCard |
| **segurança** SSRF guard nas URLs (isSafeUrl) | constants + publishFlowAction |

### Atalhos de teclado (editor)

| Tecla | Ação |
|---|---|
| **`Shift+N`** | Adiciona nó **mensagem** no centro (era `N` — re-auditoria B3) |
| `D` | Duplica nó(s) selecionado(s) |
| `Ctrl+C` / `Cmd+C` | Copia nós selecionados (clipboard interno, não OS) |
| `Ctrl+V` / `Cmd+V` | Cola nós do clipboard interno no centro |
| `Ctrl+Z` / `Cmd+Z` | Desfazer |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Refazer |
| `Delete` / `Backspace` | Apagar nó(s) ou aresta selecionada |
| `Shift+click` | Adiciona/remove nó da seleção múltipla |
| `Shift+drag` no fundo | Box-select (seleção por área) |
| **`?`** | Abre modal com lista completa de atalhos |
| `Esc` | Limpa seleção, conexão em progresso, banner de erros |

### Templates disponíveis (8 categorizados — `constants.ts`)

| ID | Categoria | Nome | Nós | Descrição |
|---|---|---|---|---|
| `blank` | Começar | Fluxo em branco | 0 | Canvas limpo |
| `lead-capture` | Captura | Captura de lead | 5 | nome + email + tag |
| `webinar` | Captura | Webinar / Aula gratuita | 7 | inscrição + lembrete 1h antes |
| `quiz` | Engajamento | Quiz / Diagnóstico | 7 | 3 perguntas + segmenta por resposta |
| `reengage` | Engajamento | Reativação de inativos | 4 | mensagem + tag inativo |
| `sales` | Vendas | Vendas simples | 6 | oferta + 3 botões |
| `cart-recovery` | Vendas | Recuperação de carrinho | 5 | delay 1h + cupom + retry 24h |
| `post-sale` | Pós-venda | Pós-venda + upsell | 7 | agradece + avaliação + upsell |

`TemplatesModal` filtra por categoria (chips no topo) com contador por chip.
Adicionar novo template: incluir em `FLOW_TEMPLATES` com `category` válida (definida em `FlowTemplate['category']`).

### Validação inline no Inspector (URLs)

`UrlInput` (componente interno do Inspector) substitui inputs de URL nos nós
`image`, `video`, `link`, `checkout`, `upsell`, `downsell`:
- Borda **verde** + ícone ✓ quando URL válida (HTTP/HTTPS público)
- Borda **vermelha** + ícone ⚠ + mensagem quando inválida ou em IP privado
- Usa o helper `isSafeUrl()` de `constants.ts` (mesma função do `publishFlowAction`)

### Import / Export JSON

`ImportExportModal` (botão `<FileJson>` na topbar):

**Export:**
- Snapshot completo: `{ format: 'umbra-flow', version: 1, name, description, triggerType, keywords, nodes, edges, exportedAt }`
- Copiar para clipboard ou baixar `.json`

**Import:**
- Cole texto ou faça upload de `.json`
- Valida `format === 'umbra-flow'`, `nodes` array (≤500), `edges` array (≤1000)
- **Reescreve IDs** via `nodeUid()/edgeUid()` para evitar colisão com nós já existentes
- Substitui graph atual (mas `Ctrl+Z` desfaz)

### Fixes da re-auditoria aplicados

| # | Fix |
|---|---|
| **P1** | Engine extraída para `lib/flow-engine.ts` + delay retoma fluxo de verdade (era stub ⏳) |
| **P2/1.3** | sends retornam boolean → `flow_node_events.failed` com `error_msg` real |
| **P3/3.3** | `recompute_all_flow_conversions` agora é 1 UPDATE com JOIN |
| **1.2** | `_doSave()` interno → `publishFlowAction` não duplica parse + rate-limit |
| **1.7** | `EDGE_SCHEMA.sourceHandle` apertado para `number().min(0).max(20)` |
| **3.1** | `contacts.flow_version` populado e usado para carregar snapshot |
| **3.4 / 7.1** | `NODE_SCHEMA` discriminated union por `type` (16 shapes específicos) |
| **6.2** | Cron `cleanup-flow-events` (TTL 30d) + RPC `cleanup_flow_node_events` |
| **6.1** | Dashboard analytics por fluxo (`/dashboard/flows/[id]/analytics`) |
| **7.3** | Webhook rate-limit por `bot_id:telegram_id` (60/min) |
| **7.4** | CHECK em `contacts.flow_vars` (64 KB) |
| **B1** | Busca/filtro (status, bot) + ordenação na `FlowsList` |
| **B3** | Atalho `N` → `Shift+N` (evita criação acidental) |
| **B4** | TestRunnerModal: dropdown por nó "buttons" para escolher opção |
| **B5** | TestRunnerModal: campo para testar keyword trigger (match/no-match) |
| **B6** | Resolvido com fix 1.2 |
| **UX** | Modal de atalhos (tecla `?`) + ImportExport whitelist contra nodeTypes |
| **perf** | FlowNode/FlowEdges com React.memo + modais via dynamic import |

### Pendências conhecidas (backlog)

| Item | Prioridade |
|---|---|
| Heatmap de nós (cor por taxa de conversão) no canvas | 🟢 Baixa |
| Marketplace de templates da comunidade | 🟢 Baixa |
| Webhook out (POST para URL externa) | 🟢 Baixa |
| A/B test entre duas versões de fluxo | 🟢 Baixa |
| Sistema real de handoff humano (atendimento) | 🟡 Média |
| Documentação para usuário em `/docs/12-fluxos/` | ✅ Implementado (12 artigos) |
| Hooks `useFlowEditorState/Shortcuts/AutoSave/Validation` (refactor 1.4) | 🟢 Baixa |
| Inspector dividido por componente (refactor 1.5) | 🟢 Baixa |

---

## 21b. MÓDULO INSTAGRAM SCHEDULER

Agendador de posts/reels/carrosséis no Instagram Business via Meta Graph API v19.0.

### Arquivos — estrutura em 4 abas

```
app/dashboard/instagram/
  ├── layout.tsx                # Auth guard + header "Instagram" + <InstagramTabs />
  ├── page.tsx                  # Redirect → /dashboard/instagram/posts
  │                             # Exporta interfaces compartilhadas: RawIgAccount, RawIgPost, IgStats
  ├── posts/page.tsx            # SSR Posts: instagram_posts (limit 200, order scheduled_at desc)
  │                             # + accounts + RPC instagram_stats em paralelo
  ├── schedule/page.tsx         # SSR Agendar: instagram_accounts WHERE is_active=true
  ├── accounts/page.tsx         # SSR Contas: instagram_accounts + RPC instagram_stats
  └── settings/page.tsx         # SSR Configurações: accounts + flags de env (META/CRON_SECRET)

components/instagram/
  ├── InstagramTabs.tsx         # Nav com 4 abas — usePathname + border-bottom no ativo
  ├── shared/
  │   ├── Toast.tsx             # Toast reutilizável (success/error, auto-close 4s)
  │   └── Badge.tsx             # Badge com 6 tons (success/danger/warning/info/primary/muted)
  ├── accounts/
  │   ├── AccountsClient.tsx    # Realtime canal 'instagram-accounts-realtime',
  │   │                         # OAuth feedback via useSearchParams (?success=connected | ?error=...)
  │   ├── AccountCard.tsx       # Card por conta com ExpiryBadge + disconnect inline (confirmação)
  │   ├── AccountStats.tsx      # 4 KPI cards (compartilhado por Accounts + Posts)
  │   └── ConnectButton.tsx     # Botão gradient IG (purple→red→yellow) → /api/auth/instagram/connect
  ├── schedule/
  │   ├── ScheduleClient.tsx    # Form: account picker + MediaUpload + caption 2200ch + datetime min+3min
  │   │                         # → schedulePostAction → redirect /posts após sucesso
  │   │                         # Empty state quando accounts.length === 0
  │   ├── MediaUpload.tsx       # Drag&drop + click (até 10 arquivos), grid preview com remove,
  │   │                         # exporta UploadedMedia
  │   └── PostPreview.tsx       # Preview estilo IG (header avatar/username, square media,
  │                             # ações fake Heart/Comment/Send/Bookmark, caption, schedule footer)
  ├── posts/
  │   ├── PostsClient.tsx       # Orquestrador: 3 modos (Cards/Tabela/Calendário) + filtros + Realtime
  │   │                         # canal 'instagram-posts-realtime' (INSERT/UPDATE/DELETE filter user_id)
  │   ├── PostStats.tsx         # 4 KPI cards (contas / agendados / publicados 30d / falhas 30d)
  │   ├── PostFilters.tsx       # Chips de status com contagens + dropdown conta + busca legenda
  │   ├── PostsTable.tsx        # Tabela com menu de ações (detalhes/abrir no IG/cancelar/apagar)
  │   ├── PostCards.tsx         # Grid de cards (1/2/3/4 cols responsivo) com badges sobre a mídia
  │   ├── PostsCalendar.tsx     # Calendário mensal com nav prev/next/hoje, contagem por dia,
  │   │                         # +N mais quando >3 posts/dia, padding 6 semanas (42 células)
  │   └── PostDetailsModal.tsx  # Modal completo: mídia + info + erros + logs de publicação
  │                             # (getPostLogsAction lazy on mount, sem auto-refresh)
  └── settings/
      └── AccountSettings.tsx   # Status integração (envs), limites IG, contas (ExpiryBadge +
                                # Reconectar + Disconnect inline), URL do webhook Meta, docs

app/actions/instagram.ts        # 5 Server Actions (inalteradas):
                                # schedulePostAction (Zod), cancelPostAction, deletePostAction,
                                # disconnectAccountAction, getPostLogsAction

lib/instagram/
  ├── auth.ts               # OAuth Meta: buildAuthUrl, exchangeCodeForToken, getLongLivedToken,
  │                         # getFacebookPages, getInstagramBusinessAccount (Graph API v19.0)
  ├── publish.ts            # publishImage / publishReel / publishCarousel / publishPost (router);
  │                         # waitForVideoProcessing (polling 5s × 120 tentativas = 10 min);
  │                         # MetaAPIError + META_ERROR_MESSAGES (10 códigos)
  └── tokens.ts             # refreshLongLivedToken (renova p/ +60 dias via fb_exchange_token)

app/api/auth/instagram/
  ├── connect/route.ts      # GET → CSRF state cookie httpOnly + redirect p/ Meta OAuth
  └── callback/route.ts     # GET ← Meta: code→token curto→token longo (60d)→pages→IG Business
                            #   → upsert criptografado AES-256-GCM + activity_event

app/api/cron/
  ├── publish-instagram/route.ts          # GET 1x/min (cron-job.org): busca 20 scheduled,
  │                                       # CAS lock (scheduled→publishing), publishPost,
  │                                       # NON_RETRYABLE_CODES = {190, 200, 368, 100},
  │                                       # token expirado (190) → desativa conta + alert critical
  ├── refresh-instagram-tokens/route.ts   # GET 1x/12h: renova tokens expirando em <30d
  └── cleanup-instagram-logs/route.ts     # GET 1x/dia 07:00: RPC cleanup_instagram_logs(30)

app/api/instagram/upload/route.ts # POST multipart: bucket instagram-medias (Supabase Storage)
                                  # Pasta {user_id}/{uuid}.{ext}, max 8MB img / 500MB vídeo,
                                  # rate-limit 30/min, RLS por pasta user_id

app/api/webhooks/instagram/route.ts # GET handshake (hub.mode + hub.verify_token + hub.challenge)
                                    # POST recebe eventos: valida X-Hub-Signature-256 (HMAC sha256)
                                    # com META_APP_SECRET, persiste em instagram_webhook_events
                                    # (mig 107) com field/entry_id/payload. Retorna sempre 200
                                    # mesmo em erro de insert (Meta faz retry agressivo se não 2xx)
```

### Mapa das 4 abas

| Aba | Rota | Função principal | Componentes |
|---|---|---|---|
| **Posts** | `/dashboard/instagram/posts` | Listar todos os posts agendados/publicados em 3 visualizações (Cards/Tabela/Calendário) | `PostsClient` + `PostStats` + `PostFilters` + `PostsTable/Cards/Calendar` + `PostDetailsModal` |
| **Agendar** | `/dashboard/instagram/schedule` | Criar novo agendamento (upload + caption + datetime) | `ScheduleClient` + `MediaUpload` + `PostPreview` (sticky sidebar) |
| **Contas** | `/dashboard/instagram/accounts` | Listar contas conectadas, OAuth feedback, conectar nova, desconectar | `AccountsClient` + `AccountCard` + `AccountStats` + `ConnectButton` |
| **Configurações** | `/dashboard/instagram/settings` | Status das envs Meta/CRON_SECRET, limites IG, contas (Reconectar/Disconnect), URL do webhook, docs | `AccountSettings` |

- `/dashboard/instagram` raiz faz `redirect('/dashboard/instagram/posts')` — Posts é a aba padrão.
- O `layout.tsx` é compartilhado: faz auth guard, mostra o header "Instagram" + `<InstagramTabs />` e renderiza `{children}` abaixo. Todas as 4 abas reaproveitam o cabeçalho.
- `RawIgAccount`, `RawIgPost` e `IgStats` são exportados de `app/dashboard/instagram/page.tsx` e importados via `import type` por todos os Server Components das abas filhas e por todos os componentes em `components/instagram/**`.
- `_components/` antigo foi **removido** (commit `b5b4b74`) — todo componente IG agora vive em `components/instagram/{shared,accounts,schedule,posts,settings}/`.

### Banco — migração 106

| Item | Detalhe |
|---|---|
| `instagram_accounts` | user_id FK + ig_user_id UNIQUE + access_token/page_token (AES-256-GCM) + token_expires_at + is_active. RLS owner |
| `instagram_posts` | media_type (IMAGE/REELS/CAROUSEL) + media_urls text[] + caption + scheduled_at + status (draft/scheduled/publishing/published/failed/cancelled) + retry_count/max_retries=3 + ig_post_id. RLS owner. Índice `ig_posts_cron_idx (scheduled_at, status) WHERE status='scheduled'` |
| `instagram_publish_logs` | post_id FK + success bool + response JSONB + error_code + duration_ms. RLS owner SELECT. TTL 30d |
| RPC `instagram_stats(p_user_id)` | { accounts_count, scheduled_count, published_30d, failed_30d } |
| RPC `cleanup_instagram_logs(p_days=30)` | TTL chamada por cron diário |
| Storage `instagram-medias` | Bucket público (Meta precisa baixar), 500MB max, MIMEs imagem+vídeo, RLS por pasta `{user_id}/` |

### Fluxo OAuth

```
1. User clica "Conectar Instagram" → /api/auth/instagram/connect
   → CSRF state em cookie httpOnly (10 min) → redirect p/ Facebook OAuth

2. Facebook redireciona → /api/auth/instagram/callback?code&state
   → valida state cookie → exchangeCodeForToken (code → token curto 1h)
   → getLongLivedToken (token curto → token longo 60d)
   → getFacebookPages (lista páginas FB)
   → para cada página: getInstagramBusinessAccount → upsert
   → activity_event + redirect ?success=connected&count=N

3. Renovação automática: cron refresh-instagram-tokens (12h)
   → busca tokens expirando <30d → fb_exchange_token → atualiza
   → falha → is_active=false + alert critical "Instagram desconectado"
```

### Cron de publicação (worker)

```
GET /api/cron/publish-instagram (CRON_SECRET, 1x/min via cron-job.org)
├── SELECT 20 posts WHERE status='scheduled' AND scheduled_at <= now()
├── Para cada post:
│   ├── CAS lock: UPDATE status='publishing' WHERE status='scheduled' (idempotência)
│   ├── publishPost (IMAGE = container+publish; REELS/CAROUSEL = waitForVideoProcessing polling)
│   ├── Sucesso: status='published' + ig_post_id + activity_event
│   ├── Falha NON_RETRYABLE (190/200/368/100): status='failed' + (190: desativa conta + alert)
│   ├── Falha retryável: retry_count++ + status='scheduled' (até max_retries=3)
│   └── INSERT log em instagram_publish_logs (success/response/error_code/duration_ms)
└── Sentry.captureCheckIn monitor 'publish-instagram'
```

### Limites e validações

- Caption: 2200 chars (Instagram)
- Mídia: 8 MB imagem (JPG/PNG/WEBP) / 500 MB vídeo (MP4/MOV)
- Carrossel: 2 a 10 itens
- Reel: vídeo MP4 H.264 mín 720p, proporção 9:16
- Posts/dia: Instagram limita 50/conta (erro código 9)
- Schedule mínimo: 3 minutos no futuro (cron roda a cada 1 min)
- 500 posts por usuário (anti-spam)
- 30 agendamentos/min (rate-limit Upstash por user_id)

### Variáveis de ambiente

| Var | Descrição |
|---|---|
| `META_APP_ID` | App ID criado em developers.facebook.com (tipo Business) |
| `META_APP_SECRET` | App Secret (mostrado uma única vez) |
| `META_REDIRECT_URI` | `https://yourdomain.com/api/auth/instagram/callback` |

> **App Review obrigatório** para `instagram_content_publish` em produção. Em dev funciona apenas para test users.

### Crons configurados em cron-job.org

| Cron | Schedule | Auth |
|---|---|---|
| `/api/cron/publish-instagram` | A cada 1 minuto | Bearer CRON_SECRET |
| `/api/cron/refresh-instagram-tokens` | A cada 12 horas | Bearer CRON_SECRET |
| `/api/cron/cleanup-instagram-logs` | 1x/dia (07:00) | Bearer CRON_SECRET |

### Diferenças vs. doc original

| No doc | No Umbra Bot | Por quê |
|---|---|---|
| Cloudflare R2 | Supabase Storage (`instagram-medias`) | Já temos infra Supabase com RLS por pasta |
| `crypto-js` | `lib/crypto` (AES-256-GCM nativo) | Já temos lib criptografando tokens de bots |
| Stripe + plans | Sem billing (limite 500 posts/user) | Será integrado quando billing existir no projeto |
| pg_cron + pg_net | cron-job.org + CRON_SECRET | Padrão dos demais crons do projeto |
| Cron a cada minuto | Idem | Mesma frequência do doc |

---

## 22. MÓDULO DE REDIRECIONADORES

### Arquivos

```
app/dashboard/redirects/
  ├── page.tsx              # Server Component — SSR redirects + 4 queries paralelas
  │                         # currClicks (30d), prevClicks (30-60d), currUnique (RPC mig 066)
  │                         # clicksDelta: ((curr-prev)/prev)*100 — null se prev=0
  │                         # Props: initialRedirects, userId, appUrl, currClicks, currUnique, clicksDelta
  └── RedirectsClient.tsx   # Client Component — CRUD real, analytics lazy por período,
  │                           KPI cards 4 colunas, sparkline preload, 4 eventos PostHog

app/r/[slug]/route.ts       # Rota pública — prioridade: afiliado → redirecionador → APP_URL
```

### Fluxo de dados

```
RedirectsPage (Server Component)
  ├── Auth guard: if (!user) redirect('/login')
  ├── Promise.all com 4 queries em paralelo:
  │     ├── redirects: id, slug, destination, destination_label, clicks, unique_clicks,
  │     │              status, cloaking, decoy_url, utm, redirect_type, created_at
  │     │              order: created_at desc, filtrado por user_id
  │     ├── redirect_click_events: count(*) head:true — cliques nos últimos 30d
  │     ├── redirect_click_events: count(*) head:true — cliques de 30-60d atrás (delta)
  │     └── RPC redirect_unique_clicks_30d(user_id) — IPs distintos, excl. bots, 30d
  ├── clicksDelta = prevClicks > 0 ? round(((curr-prev)/prev)*1000)/10 : null
  └── passa como props: initialRedirects, userId, appUrl, currClicks, currUnique, clicksDelta

RedirectsClient (Client Component)
  ├── links state: initialRedirects.map(mapRaw) — zero mock
  ├── mapRaw(row, appUrl): url=`${appUrl}/r/${slug}`, clicks??0, unique_clicks??0
  ├── applyPatch(link, patch, appUrl): helper para optimistic update snake→camelCase sem cast
  ├── expanded state: id do link com row expandida (null = nenhum)
  ├── analyticsMap state: Record<"${id}:${period}", AnalyticsState>
  │     AnalyticsState = LinkAnalytics | 'loading' | 'error'
  │     chave composta por id + período: cache independente por link e janela
  ├── analyticsMapRef + inflightRef: refs para loadAnalytics estável (sem dep no state)
  ├── toast state: { msg, type: 'success'|'error' } — auto-fecha 3.5s
  │
  ├── loadAnalytics(id, period): estável (deps=[]) — lê state via analyticsMapRef
  │     inflightRef previne duplicatas mesmo com referência estável
  │     supabase.rpc('redirect_analytics', { p_redirect_id: id, p_days: period })
  │     setAnalyticsMap(prev => ({ ...prev, [`${id}:${period}`]: data }))
  │
  ├── pageItemIds = pageItems.map(l => l.id).join(',')
  │     useEffect([pageItemIds, loadAnalytics]):
  │       pageItems.forEach(l => loadAnalytics(l.id, 14))
  │       pré-carrega sparklines para todos os links visíveis sem expandir
  │
  ├── handleToggle(id): expande linha + loadAnalytics(id, 14) como garantia
  │
  ├── createLink(opts: CreateOpts):
  │     re-sanitiza slug defensivamente (segunda camada além do modal)
  │     INSERT { user_id, safeSlug, destination, destination_label, redirect_type: String(type),
  │              cloaking, decoy_url, utm: utmEnabled ? utm : null }
  │     → prepend ao state + track('redirect_created', { slug, cloaking, utm_enabled, redirect_type })
  │
  ├── saveLink(id, patch):
  │     optimistic update via applyPatch (snake→camelCase, sem cast frágil)
  │     invalida cache de analytics se slug mudou (Object.keys filter)
  │     UPDATE .eq('id', id).eq('user_id', userId) — IDOR duplo
  │     → track('redirect_updated', { slug })
  │
  ├── changeStatus(id, status):
  │     aceita 'active' | 'paused' | 'archived' — todos os 3 estados suportados no DB
  │     UPDATE status .eq('user_id', userId) — optimistic + rollback
  │     toast com label (ativado/pausado/arquivado)
  │     → track('redirect_status_changed', { status })
  │
  ├── deleteLink(id):
  │     DELETE .eq('user_id', userId)
  │     limpa cache do link em analyticsMap (Object.keys filter por prefixo)
  │     → track('redirect_deleted', {})
  │
  ├── handleExport():
  │     CSV com BOM: Link curto | Rótulo | Destino | Cliques | Únicos | Status | Tipo | Criado
  │     nome: redirecionadores_YYYY-MM-DD.csv
  │     → track('csv_exported', { section: 'redirects', rows })
  │
  ├── KPI Cards (4 colunas):
  │     "Links ativos" — totals.active / totals.total (live count)
  │     "Cliques (30 dias)" — currClicks com delta vs 30-60d e subtitle "vs. 30-60d anteriores"
  │     "Únicos (30 dias)" — currUnique via RPC, subtitle "IPs distintos, excl. bots"
  │     "Top link" — topLink.clicks com subtitle "r/slug · total acumulado" (all-time, não windowed)
  │
  ├── LinkRow: linha expansível com sparkline auto-carregada (pré-load via pageItemIds effect)
  │     sparkline usa sempre 14d para consistência visual na tabela
  │     sparkState = analyticsMap[`${link.id}:14`] — loading → animate-pulse; loaded → svg
  │
  ├── LinkStats: seletor de período (7/14/30d) + gráfico BarChart + totais + taxa
  │     useEffect([link.id, period, onLoadAnalytics]) — busca dados ao montar e ao trocar período
  │     estado de erro com botão "Tentar novamente"
  │
  ├── DetailsCard: confirmação inline antes de pausar (evita ação acidental)
  │     link.status === 'active' → botão "Pausar" → confirmação "Pausar o link? Confirmar/Cancelar"
  │     link.status === 'paused' → "Retomar" (direto, sem confirmação)
  │     active ou paused → "Arquivar" (ghost, sem confirmação)
  │     archived → "Ativar" (primary, sem confirmação)
  │     "Testar link" → window.open(link.url) — abre /r/slug
  │     "Abrir destino" → window.open(link.destination) — abre URL final
  │
  ├── CloakingSection: aviso inline de risco + campo decoy_url + checkbox de ciência
  ├── LinkFormFields: campos Destino + Rótulo (opcional) + Slug + Avançados (301/302, UTM, Cloaking)
  ├── CreateLinkModal / EditLinkModal / DeleteConfirmModal
  └── Aviso global de cloaking no topo quando links.cloaking > 0
```

### Interfaces TypeScript

```typescript
interface RawRedirect {
  id: string; slug: string; destination: string; destination_label: string | null
  clicks: number; unique_clicks: number
  status: 'active' | 'paused' | 'archived'   // 'archived' suportado pelo DB
  cloaking: boolean; decoy_url: string | null; utm: UtmParams | null
  redirect_type: string; created_at: string
}

interface LinkItem {
  id: string; slug: string; url: string       // url derivada de ${appUrl}/r/${slug}
  destination: string; destinationLabel: string
  clicks: number; uniqueClicks: number; createdAt: number
  status: 'active' | 'paused' | 'archived'
  cloaking: boolean; decoyUrl: string
  utm: UtmParams | null; redirectType: string
}

type AnalyticsState = LinkAnalytics | 'loading' | 'error'

interface LinkAnalytics {
  period_clicks: number; period_unique: number
  by_day:    Array<{ day: string; clicks: number }>   // 'DD/MM'
  by_source: Array<{ name: string; value: number }>
  by_device: Array<{ name: string; value: number }>
}

interface UtmParams { source: string; medium: string; campaign: string }

interface CreateOpts {
  destination: string; destinationLabel: string; slug: string; redirectType: number
  utm: UtmParams | null; cloaking: boolean; decoyUrl: string
}

interface RedirectsClientProps {
  initialRedirects: RawRedirect[]
  userId: string; appUrl: string
  currClicks: number; currUnique: number; clicksDelta: number | null
}
```

### Schema do banco (migração 065)

```sql
-- Alterações na tabela redirects (préexistente)
-- status já tinha check ('active','paused','archived') na migration 008
alter table public.redirects
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.redirects alter column user_id set not null;
alter table public.redirects alter column utm drop not null, alter column utm set default null;
alter table public.redirects drop column if exists url;  -- coluna redundante

-- RLS corrigida (open → owner)
drop policy if exists "redirects_open"  on public.redirects;
drop policy if exists "redirects_owner" on public.redirects;
create policy "redirects_owner" on public.redirects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists redirects_user_id_idx on public.redirects (user_id);

-- Tabela de eventos de clique
create table if not exists public.redirect_click_events (
  id          uuid        primary key default gen_random_uuid(),
  redirect_id uuid        not null references public.redirects(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  ip_hash     text,
  referrer    text,
  device_type text        check (device_type in ('mobile','desktop','tablet','bot','unknown')),
  clicked_at  timestamptz not null default now()
);
-- Índices: rce_redirect_clicked_idx (redirect_id, clicked_at desc)
--          rce_user_clicked_idx (user_id, clicked_at desc)
-- RLS: rce_owner_select — auth.uid() = user_id (SELECT only)
```

### RPCs

```sql
-- migration 065: record_redirect_click(p_redirect_id, p_ip_hash, p_referrer, p_device_type) → void
-- security definer, grant to anon, authenticated
-- Resolve user_id via redirects (status='active')
-- v_is_unique: ip_hash não nulo e nunca viu este redirect_id
-- INSERT em redirect_click_events
-- UPDATE redirects SET clicks++, unique_clicks += (1 se único)

-- migration 065: redirect_analytics(p_redirect_id, p_days default 14) → json
-- security definer, grant to authenticated
-- Verifica propriedade (auth.uid() = user_id) — retorna null se não for dono
-- Exclui device_type='bot' de todos os contadores
-- by_day: generate_series + LEFT JOIN, agrupado por America/Sao_Paulo
-- by_source: mapeia referrer → Instagram/Google/YouTube/TikTok/WhatsApp/Facebook/Twitter/Direto/Outros
-- by_device: agrupa device_type (exclui bot + unknown)

-- migration 066: redirect_unique_clicks_30d(p_user_id uuid) → bigint
-- security invoker, grant to authenticated
-- count(distinct ip_hash) em redirect_click_events
-- WHERE user_id = p_user_id AND clicked_at >= now()-30d AND device_type != 'bot'
-- Usado no KPI "Únicos (30 dias)" da página SSR
```

### Rota /r/[slug] — prioridade dupla (migração 065)

```
GET /r/{slug}

1. Tenta afiliado:
   supabase.rpc('track_affiliate_click', { p_slug }) → se found → cookie + redirect

2. Tenta redirecionador:
   admin.from('redirects').select(...).eq('slug', slug).eq('status', 'active').maybeSingle()
   Se encontrado:
     hashIp(rawIp): SHA-256('umbra:'+ip).slice(0,16)
     detectDevice(ua): bot|tablet|mobile|desktop|unknown
     parseReferrer(referer): hostname do header Referer
     cloaking: redirect.cloaking && isBot
               ? (redirect.decoy_url || appUrl)   ← appUrl é fallback se decoy_url nulo
               : redirect.destination
     await admin.rpc('record_redirect_click', { ... }) — await para serverless
     redirect_type '301' → status 301; senão 302

3. Fallback: redirect para APP_URL
```

### Eventos PostHog do módulo

| Evento | Quando | Props |
|---|---|---|
| `redirect_created` | ao criar redirecionador | `{ slug, cloaking, utm_enabled, redirect_type }` |
| `redirect_updated` | ao salvar edição | `{ slug }` |
| `redirect_status_changed` | ao pausar/retomar/arquivar | `{ status: 'active'\|'paused'\|'archived' }` |
| `redirect_deleted` | ao confirmar exclusão | `{}` |
| `csv_exported` | ao exportar CSV | `{ section: 'redirects', rows }` |

### Segurança

- RLS `redirects_owner`: `auth.uid() = user_id` — isola dados entre usuários
- Todo UPDATE/DELETE usa `.eq('user_id', userId)` — IDOR duplo (código + RLS)
- `createLink` re-sanitiza slug antes do INSERT (segunda camada além da validação do modal)
- `record_redirect_click` com `security definer` — permite INSERT sem sessão de usuário
- `redirect_analytics` verifica propriedade — retorna null se não for dono (sem cross-user leak)
- IP nunca armazenado em texto claro — SHA-256 truncado (16 chars hex), LGPD-safe
- Cloaking null-safe: se `decoy_url` nulo, bots recebem `appUrl` (nunca o destino real)
- `createAdminClient()` usado apenas na rota pública `/r/[slug]` — sem sessão de usuário

---

## 23. MÓDULO DE DISPARADOR (BROADCASTS)

### Arquivos

```
app/dashboard/broadcasts/
  ├── page.tsx            # Server Component — SSR broadcasts (limit 50) + bots + RPC counts em paralelo
  └── BroadcastsClient.tsx # Client Component — listagem com KPIs/filtros + editor completo
```

### Fluxo de dados

```
BroadcastsPage (Server Component)
  ├── Auth guard: if (!user) redirect('/login')
  ├── Promise.all em paralelo:
  │     ├── broadcasts: id, title, bot_id, bot, audience, audience_count, status,
  │     │               sent, delivered, failed, scheduled_for, started_at, finished_at,
  │     │               failure_reason, message, media, buttons, filters, created_at, updated_at
  │     │               order: created_at desc, limit 50, filtrado por user_id
  │     ├── bots: id, name, username, color — order: added_at desc
  │     └── RPC broadcasts_audience_counts(p_user_id): { all, leads, buyers, tags }
  │           fallback seguro: {} → zeroes se RPC ainda não aplicada
  └── passa como props:
        initialBroadcasts: RawBroadcast[]
        bots: RawBotOption[]
        audienceCounts: AudienceCounts
        userId: string
        initialHasMore: boolean (initialBroadcasts.length >= 50)

BroadcastsClient (Client Component)
  ├── broadcasts state: initialBroadcasts.map(mapRaw)
  ├── editingId state: string | null — null = BroadcastList; string = BroadcastEditor
  ├── now state: Date.now() — tick a cada 30s (timestamps relativos corretos)
  ├── hasMore / loadingMore state + offsetRef: controle de paginação server-side
  │
  ├── audienceOptions useMemo: [all, leads, buyers, ...tag:X] a partir de audienceCounts
  │
  ├── Supabase Realtime ('broadcasts-realtime'):
  │     UPDATE → mapRaw(row) + stale-draft guard:
  │       if (b.status in [sending|done|failed|canceled] && next.status === 'draft') → ignora
  │       (impede evento antigo do saveBroadcast de reverter um broadcast já disparado)
  │     INSERT → prepend se id ainda não existe no state
  │
  ├── createBroadcast():
  │     INSERT { user_id, title='Novo disparo', bot_id=bots[0].id, audience='leads',
  │              audience_count=audienceCounts.leads, message='', buttons=[], status='draft',
  │              sent=0, delivered=0, failed=0, filters={} }
  │     retorna id real → setEditingId(id)
  │
  ├── saveBroadcast(updated):
  │     optimistic local update → DB UPDATE com .eq('user_id', userId)
  │     mapToDb() inclui user_id + todos os campos → IDOR duplo
  │
  ├── sendBroadcastNow(updated): → string | null (null = sucesso)
  │     1. saveBroadcast(updated) — persiste estado atual
  │     2. Otimista: setBroadcasts → status='sending', startedAt=Date.now()
  │        (roda antes de qualquer evento Realtime do saveBroadcast)
  │     3. fetch POST /api/broadcasts/send { broadcast_id } com AbortController 20s
  │        res.ok=false → reverte status para 'draft', retorna msg de erro
  │        AbortError (timeout) → audiência grande, Realtime cuida do progresso
  │
  ├── scheduleBroadcast(updated):
  │     saveBroadcast({ ...updated, status: 'scheduled' })
  │
  ├── cancelBroadcast(id):
  │     sending → canceled (+ finishedAt=now); scheduled → draft (+ scheduledFor=null)
  │     optimistic + DB UPDATE
  │
  ├── deleteBroadcast(id):
  │     remove do state + DELETE .eq('user_id')
  │
  ├── duplicateBroadcast(id):
  │     INSERT cópia com title + "(cópia)", status='draft', preserva message/media/buttons/filters/botId
  │     retorna row completa → prepend ao state (sem INSERT duplicado via Realtime: dedup por id)
  │
  └── loadMore():
        .range(offsetRef.current, offsetRef.current + 49) → acumula em broadcasts
        offsetRef avança +N, setHasMore(data.length === 50)
```

### BroadcastList (sub-componente — listagem)

```
BroadcastList
  ├── filters state: { search: string, status: string, bot: string }
  │     (estado local — não persiste em localStorage)
  │     search: filtra por title.includes(q) || message.includes(q)
  │     status: compara STATUS_MAP[b.status].label
  │     bot: compara b.botId via botIdByDisplay Map
  ├── creating state: boolean — botão "Novo disparo" com Loader2
  ├── bestOpen state: boolean — abre BestPracticesModal
  │
  ├── KPI cards (4 colunas):
  │     "Disparos no mês"    — broadcasts criados/iniciados nos últimos 30d
  │     "Mensagens enviadas" — SUM(sent) de todos os broadcasts
  │     "Taxa de entrega"    — SUM(delivered) / SUM(sent) × 100% (highlight verde ≥ 95%)
  │     "Em andamento"       — count(status='sending') com pulse animation
  │
  ├── Banner informativo quando sendingCount > 0:
  │     "N disparos em andamento — progresso atualizado em tempo real via Supabase Realtime"
  │
  ├── FilterBar: busca + select status + select bot + botão Limpar + contador "N disparos"
  │
  ├── Tabela com 6 colunas: Título/Bot | Público-alvo | Agendamento | Status | Progresso | Ações
  │     BroadcastRow: linha clicável → abre editor
  │       Ações:
  │         sending   → "Cancelar"
  │         scheduled → "Desagendar"
  │         done/draft/failed/canceled → "Copiar" (duplicateBroadcast)
  │
  ├── Estado vazio:
  │     sem broadcasts → "Crie seu primeiro broadcast" + botão Novo disparo
  │     com filtros ativos sem resultados → "Tente limpar os filtros"
  │
  ├── "Carregar mais disparos" quando hasMore=true
  └── BestPracticesModal → 6 dicas (segmentação, personalização, horário, limite TG, teste, frequência)
```

### BroadcastEditor (sub-componente — editor)

```
BroadcastEditor
  ├── editable: status === 'draft' || status === 'scheduled'
  │
  ├── Estado local:
  │     title, botId, audience, message, media, buttons (padrão do broadcast)
  │     scheduleMode: 'now' | 'later'
  │     scheduledFor: timestamp (padrão: now + 1h)
  │     regAfter, regBefore: strings ISO date (filtros avançados)
  │     localCounts: AudienceCounts | null — re-fetched via RPC ao trocar botId
  │
  ├── localCounts re-fetch:
  │     useEffect([botId]) → supabase.rpc('broadcasts_audience_counts', { p_user_id, p_bot_id })
  │     effectiveOptions: usa localCounts se disponível, senão audienceOptions do prop
  │     (garante contagens corretas para o bot selecionado, não o global)
  │
  ├── buildPatch(extra?): monta Broadcast com estado atual
  │     filters: { registered_after?, registered_before? } — só inclui se preenchido
  │     audienceCount: audOpt?.count do effectiveOptions (contagem real do bot)
  │
  ├── handleSaveDraft(): valida título → onSave(buildPatch({ status:'draft' }))
  ├── handleSchedule():  valida título + mensagem → onSchedule(buildPatch({ scheduledFor }))
  ├── handleSendNow():   valida botId + mensagem → confirmOpen=true → onSendNow(buildPatch())
  ├── handleCancel():    onCancel(broadcast.id)
  ├── handleDelete():    onDelete(broadcast.id) → onBack()
  │
  ├── Topbar sticky (h-60px):
  │     ← Disparos | título editável | Badge status
  │     Ações: Excluir (draft) | Salvar rascunho | Enviar agora / Agendar envio
  │             Cancelar envio (se sending)
  │
  ├── Layout xl: grid [1fr 380px]
  │     Coluna esquerda:
  │       BotPicker: card grid de bots (cor + @handle + radio)
  │       AudiencePicker: all/leads/buyers/tag:X com contagem badge
  │       MessageComposer: texto + mídia + botões
  │       Filtros avançados: registered_after + registered_before (date inputs)
  │       SchedulePicker: agora ou datetime-local — estimativa de tempo
  │     Coluna direita (sticky top-80px):
  │       PreviewBroadcast: prévia visual com {nome}→João, {produto}→'Mentoria Premium', etc.
  │       SummaryCard: bot / público / alcance / envio / estimativa
  │
  ├── SendingStatusCard (só quando status='sending'):
  │     Barra de progresso (sent / audienceCount)
  │     Grid 3: entregues (%) | falhas (%) | velocidade ~28/s
  │     ETA: remaining / 1800 min (1800 = 30 msg/s × 60s)
  │     Info tip: "Telegram limita ~30 msgs/segundo"
  │
  ├── Modal confirmar envio: público / contatos / bot / ETA
  └── Modal confirmar exclusão (só para drafts)
```

### MessageComposer (sub-componente)

```
MessageComposer
  ├── Textarea: 4096 chars max, placeholder "Olá {nome}, …", resize-none
  ├── Botões de variável: {nome} {produto} {valor} {bot} {data}
  │     insertVar(): insere no cursor (selectionStart/End) + requestAnimationFrame restore focus
  │
  ├── Mídia (opcional):
  │     MediaUrlInput quando media=null:
  │       Selector: Imagem | Vídeo | Documento
  │       Input URL: https://… + botão "Adicionar"
  │       Suporte: Telegram CDN, S3, Cloudflare R2
  │     MediaPreview quando media!=null:
  │       Ícone do tipo + label + URL truncada + botão X (remove)
  │       Se kind='image' e url: tenta <img> com onError fallback
  │
  └── Botões inline (até 3):
        Adicionar botão → grows list
        Cada botão: [label input] [url input] [trash button]
        "+ Adicionar outro botão" quando length < 3
```

### SchedulePicker (sub-componente)

```
SchedulePicker
  ├── 'now':   "Enviar agora"  — inicia imediatamente após confirmar
  └── 'later': "Agendar envio" — datetime-local input, min=now, valor inicial now+1h
```

### Status dos broadcasts

| status | Label | tom | Descrição |
|---|---|---|---|
| `draft` | Rascunho | muted | Não enviado — editável |
| `scheduled` | Agendado | warning | Aguarda cron process-broadcasts — editável |
| `sending` | Enviando | primary + pulse | Em andamento — cancellable |
| `done` | Concluído | success | Finalizado |
| `failed` | Falhou | danger | Interrompido com erro |
| `canceled` | Cancelado | muted | Cancelado pelo usuário |

### /api/broadcasts/send (rota de envio imediato)

```
POST /api/broadcasts/send { broadcast_id }
├── Auth + rate limit 5/hora
├── Busca broadcast + bot (token criptografado)
├── Filtra contatos por audience (all/leads/buyers/tag:XYZ) + bot_id
│     se filters.registered_after:  .gte('created_at', date)
│     se filters.registered_before: .lte('created_at', date)
├── Rate limit 35ms/msg (Telegram: ~28 msgs/s máximo seguro)
├── substituteVars(text, contact): {nome}/{produto}/{valor}/{bot}/{data}
├── sendTelegramMessage() + (mídia e botões se presentes)
├── Atualiza sent/delivered/failed no banco a cada mensagem
├── Cancellation check a cada 50 msgs: SELECT status — se 'canceled' → break
└── Atualiza status='done' + finished_at ao concluir
```

### /api/cron/process-broadcasts (cron de agendamentos)

```
GET /api/cron/process-broadcasts (CRON_SECRET, cron-job.org a cada 15 min)
├── CAS lock: UPDATE broadcasts SET status='sending' WHERE status='scheduled'
│            AND scheduled_for <= now() LIMIT 1 RETURNING *
│   (evita duplo-processamento: só 1 broadcast por rodada de cron)
├── Segmentação idêntica ao /api/broadcasts/send
├── Rate limit 35ms/msg, cancellation check a cada 50 msgs
└── Registra no cron_log (fire-and-forget) + Sentry captureCheckIn
```

### /api/cron/register-webhooks (utilitário admin)

```
GET /api/cron/register-webhooks (CRON_SECRET)
├── Busca todos os bots com token cadastrado (createAdminClient)
├── Para cada bot: decryptToken → Telegram setWebhook(url, secret_token)
├── Atualiza status='online' + webhook_url + last_sync se bem-sucedido
└── Retorna { registered: N, results: [{ bot, ok, detail }] }
Útil para recuperar webhook após deploy, mudança de URL ou rotação de secret.
```

### Tipos internos

```typescript
interface RawBroadcast {
  id, title, bot_id, bot, audience, audience_count, status
  sent, delivered, failed, scheduled_for, started_at, finished_at, failure_reason
  message, media: MediaAttachment | null, buttons: BroadcastButton[], filters, created_at, updated_at
}

interface Broadcast { /* camelCase version */
  id, title, botId, bot, audience, audienceCount, status: BroadcastStatus
  sent, delivered, failed, scheduledFor, startedAt, finishedAt, failureReason
  message, media, buttons, createdAt, filters
}

interface MediaAttachment { kind: 'image' | 'video' | 'file'; label: string; url?: string }
interface BroadcastButton  { label: string; url: string }
interface AudienceCounts   { all: number; leads: number; buyers: number; tags: Record<string, number> }
type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'done' | 'failed' | 'canceled'
```

### RPC broadcasts_audience_counts (migração 070)

```sql
-- Retorna contagens segmentadas para um user_id e bot_id opcionais
broadcasts_audience_counts(p_user_id uuid, p_bot_id uuid default null) → json
  { all, leads, buyers, tags: Record<string, number> }
  -- all:    count(contacts WHERE user_id = p_user_id [AND bot_id = p_bot_id])
  -- leads:  count WHERE orders_count IS NULL OR orders_count = 0
  -- buyers: count WHERE orders_count > 0
  -- tags:   object com count por tag (JSONB tags)
```

### Segurança

- Toda operação DB usa `.eq('user_id', userId)` — IDOR duplo (código + RLS)
- `mapToDb()` sempre inclui `user_id` no payload de INSERT/UPDATE
- `sendBroadcastNow` valida `botId` e `message` antes de chamar a API
- Rate limit 5 disparos/hora por usuário em `/api/broadcasts/send`

---

## 24. MÓDULO DE GATEWAYS

### Arquivos

```
app/dashboard/gateways/
  ├── page.tsx          # Server Component — SSR gateways + bank_accounts + RPC gateways_stats em paralelo
  │                     # aceita searchParams { mp_connected?, mp_error? } do callback OAuth
  │                     # passa hasMpOAuth=!!MERCADOPAGO_CLIENT_ID ao Client
  └── GatewaysClient.tsx # Client Component — catálogo, KPIs, modais de conexão/teste/config/desconexão
  │                       # Realtime canal 'gateways-realtime' (INSERT/UPDATE por user_id)
  │                       # ExpiryBadge: indicador de dias até expiração do token OAuth
  │                       # RenewModal: renovação de token OAuth sem desconectar

app/actions/gateways.ts  # 5 Server Actions (todas autenticadas + rate-limit)
  ├── validateGatewayCredentialsAction(provider, apiKey) → chama API do gateway; MP: GET /v1/users/me
  ├── connectGatewayAction(provider, apiKey, bankAccountId) → valida (defesa em profundidade) + encryptToken + upsert
  ├── disconnectGatewayAction(gatewayId) → UPDATE connected=false, credentials={}, account=null, token_expires_at=null
  ├── updateGatewayAction(gatewayId, bankAccountId) → UPDATE account + account_id (sem alterar token)
  └── testGatewayConnectionAction(gatewayId) → decryptToken + callGatewayApi (sem expor token)

app/api/payments/mercadopago-oauth/route.ts          # GET — inicia OAuth
app/api/payments/mercadopago-oauth/callback/route.ts # GET — callback OAuth
                                                      # Salva token_expires_at = now() + 180 dias
```

### Fluxo de dados

```
GatewaysPage (Server Component)
  ├── Auth guard + await searchParams
  ├── Promise.all em paralelo:
  │     ├── gateways: id, name, connected, account, account_id, provider, status,
  │     │              updated_at, processed_volume, processed_tx, token_expires_at
  │     ├── bank_accounts: id, label, kind
  │     └── RPC gateways_stats(p_user_id): { [provider]: { volume_30d, tx_30d, avg_fee_pct } }
  └── passa como props:
        initialGateways / bankAccounts / gatewayStats / userId
        hasMpOAuth: boolean (!!MERCADOPAGO_CLIENT_ID)
        mpConnected: boolean (params.mp_connected === '1')
        mpError: string | null

GatewaysClient (Client Component)
  ├── gateways state: mergeGateways(initialGateways, gatewayStats)
  │     mergeGateways: junta catálogo estático + dados do banco + stats RPC por provider
  │     avgFeePct: Number(stats.avg_fee_pct ?? 0)  ← usa RPC, não estimativa estática
  │     tokenExpiresAt: row.token_expires_at → getTime() ms | undefined (se manual)
  ├── now state: Date.now() — tick a cada 60s (base para cálculo de dias até expiração)
  ├── oauthHandledRef: evita double-fire do useEffect de OAuth
  ├── useEffect(mpConnected, mpError):
  │     mpConnected → toast sucesso + track('gateway_connected', { gateway: 'mercadopago' })
  │     mpError     → toast erro com mensagem do MP_OAUTH_ERRORS
  │     router.replace('/dashboard/gateways') — limpa URL
  ├── Realtime (useEffect[userId]):
  │     canal 'gateways-realtime', event INSERT + UPDATE, tabela gateways
  │     filtro: user_id=eq.${userId}
  │     applyRealtimeRow(prev, row): preserva stats RPC ao aplicar atualização do banco
  │       preserva avgFeePct/volume30d/tx30d (vindos da RPC, não da row do DB)
  │       atualiza connected, account, accountId, lastSync, tokenExpiresAt
  ├── KPI cards (4 colunas):
  │     "Gateways conectados" (N/total)
  │     "Volume processado (30d)" — soma volume30d dos conectados
  │     "Transações (30d)" — soma tx30d dos conectados
  │     "Taxa média" — média ponderada pelo volume (avgFee*volume/totalVolume)
  │                    fallback: média simples das taxas do catálogo se volume=0
  ├── Seção "Conectados": GatewayCard com Verificar / Configurar / Desconectar / Renovar token
  ├── Seção "Disponíveis": GatewayCard com "Conectar {name}"
  ├── ConnectModal: OAuth (Globe azul) ou token manual — link externo dinâmico por provider
  ├── TestModal: abre → testGatewayConnectionAction() → status loading/ok/error
  ├── DisconnectModal: confirmação → disconnectGatewayAction()
  │     patchGateway local: limpa connected/account/accountId/tokenExpiresAt
  ├── ConfigureModal: AccountPicker → updateGatewayAction()
  └── RenewModal: renovação OAuth sem desconectar (só para gateways com tokenExpiresAt)
        AccountPicker → window.location.href = /api/payments/mercadopago-oauth?bank_account_id=
```

### GATEWAY_CATALOG (único provider ativo)

```typescript
// Apenas Mercado Pago funcional; outros serão re-adicionados quando integração for construída
const GATEWAY_CATALOG = {
  mercadopago: {
    name: 'Mercado Pago', initial: 'M', color: 'oklch(0.62 0.16 240)',
    description: 'Gateway tradicional com Pix, cartão (até 12x) e boleto. Antifraude integrado.',
    methods: ['Pix', 'Cartão', 'Boleto'],
    fee: { pix: 0.99, card: 4.99, boleto: 3.49 },
    feeText: 'A partir de 0,99%',
    externalUrl:   'https://www.mercadopago.com.br/developers/panel',  // ← dinâmico por provider
    externalLabel: 'Painel MP',
  },
}
```

### GatewayItem — interface interna

```typescript
interface GatewayItem {
  provider:       string
  name:           string
  connected:      boolean
  account?:       string
  accountId?:     string
  status:         string
  lastSync:       number        // timestamp ms
  volume30d:      number
  tx30d:          number
  avgFeePct:      number        // avg_fee_pct real das transações (RPC gateways_stats)
  fee:            Record<string, number>  // taxas do catálogo (fallback)
  description:    string
  methods:        string[]
  feeText:        string
  externalUrl:    string        // URL do painel do provider (dinâmico por provider)
  externalLabel:  string        // label do link externo
  tokenExpiresAt?: number       // timestamp ms — só OAuth; undefined = conexão manual
}
```

### ExpiryBadge — indicador de expiração do token OAuth

```typescript
function daysUntilExpiry(ts: number, now: number): number {
  return Math.ceil((ts - now) / (24 * 60 * 60 * 1000))
}

function ExpiryBadge({ expiresAt, now }: { expiresAt: number; now: number }) {
  const days = daysUntilExpiry(expiresAt, now)
  if (days <= 0)  return <Badge tone="danger"><AlertCircle />Token expirado</Badge>
  if (days <= 7)  return <Badge tone="danger"><Clock />Expira em {days}d</Badge>
  if (days <= 30) return <Badge tone="warning"><Clock />Expira em {days}d</Badge>
  return <Badge tone="muted"><Clock />OAuth · {days}d</Badge>
}
// Exibido no cabeçalho do GatewayCard para gateways OAuth (tokenExpiresAt definido)
// Banner de aviso dentro do card quando days <= 30 (link inline "Renovar")
// Borda do card muda para warning quando days <= 30
```

### RenewModal — renovação de token OAuth

```typescript
function RenewModal({ open, onClose, g, bankAccounts }) {
  // Mostra aviso de expiração + ExpiryBadge + AccountPicker
  // handleRenew() → window.location.href = /api/payments/mercadopago-oauth?bank_account_id=
  // Não desconecta: o callback OAuth faz upsert onConflict → substitui o token expirado
}
// Ativado pelo botão "Renovar token" (warning style) no GatewayCard
// Exibido apenas quando g.tokenExpiresAt está definido (conexão OAuth)
```

### applyRealtimeRow — atualização Realtime preservando stats RPC

```typescript
function applyRealtimeRow(prev: GatewayItem[], row: RawGateway): GatewayItem[] {
  return prev.map(g => {
    if (g.provider !== row.provider) return g
    return {
      ...g,  // preserva avgFeePct, volume30d, tx30d (vindos da RPC — não na row do DB)
      connected:      row.connected,
      account:        row.account ?? undefined,
      accountId:      row.account_id ?? undefined,
      lastSync:       new Date(row.updated_at).getTime(),
      tokenExpiresAt: row.token_expires_at
        ? new Date(row.token_expires_at).getTime()
        : undefined,
    }
  })
}
```

### ConnectModal — fluxo OAuth vs manual

```
ConnectModal props: { g, bankAccounts, hasMpOAuth, onConnected }

showOAuth = hasMpOAuth && g.provider === 'mercadopago'
mode state: 'oauth' | 'manual'  (default = 'oauth' se showOAuth, else 'manual')

Modo OAuth (showOAuth=true, mode='oauth'):
  1. AccountPicker — seleciona conta bancária de recebimento
  2. Botão azul "Conectar com Mercado Pago" (Globe icon)
     → handleOAuthRedirect(): window.location.href = /api/payments/mercadopago-oauth?bank_account_id=xxx
  3. Info: "token tem validade de 180 dias"
  4. Link externo dinâmico: g.externalLabel → g.externalUrl (ex: "Painel MP" → mercadopago.com.br/developers/panel)
  5. Link: "Prefiro inserir o Access Token manualmente" → setMode('manual')

Modo Manual (mode='manual'):
  1. AccountPicker
  2. Input password (Access Token)
  3. handleValidate() → validateGatewayCredentialsAction() → se ok, setStep('split')
  4. Link: "Usar OAuth (recomendado)" → setMode('oauth')

Step 'split': SplitExplanation (visual do split por venda)
Step 'done':  ícone check verde + "Pagamentos já podem ser processados"
```

### OAuth Mercado Pago — fluxo completo

```
1. GET /api/payments/mercadopago-oauth?bank_account_id=xxx
   ├── Auth: supabase.auth.getUser()
   ├── IDOR: verifica bank_account.user_id === user.id
   ├── Gera state: randomBytes(20).toString('hex') — proteção CSRF
   ├── Seta cookies httpOnly (sameSite='lax', maxAge=600, secure em prod):
   │     mp_oauth_state = state
   │     mp_oauth_bank  = bankAccountId
   └── Redireciona → https://auth.mercadopago.com/authorization?client_id&response_type=code&state&redirect_uri

2. Mercado Pago redireciona → GET /api/payments/mercadopago-oauth/callback?code=xxx&state=xxx
   ├── Verifica error param → redirect ?mp_error=authorization_denied
   ├── CSRF: compara state com cookie mp_oauth_state → redirect ?mp_error=invalid_state se diferente
   ├── Limpa cookies: delete mp_oauth_state + mp_oauth_bank
   ├── Auth: supabase.auth.getUser()
   ├── POST https://api.mercadopago.com/oauth/token (grant_type=authorization_code)
   │     → access_token, refresh_token?, expires_in?, user_id?
   ├── GET  https://api.mercadopago.com/v1/users/me → email ou nickname (accountInfo)
   ├── Resolve label da conta bancária (SELECT bank_accounts WHERE id + user_id)
   ├── encryptToken(accessToken) → AES-256-GCM
   ├── token_expires_at = now() + 180 dias (limite do MP OAuth)  ← migração 075
   ├── UPSERT gateways { connected:true, status:'active',
   │     credentials:{token,account_info,oauth:true}, token_expires_at }
   │     ON CONFLICT (user_id, provider)
   ├── activity_event fire-and-forget (type='newBot', title='Mercado Pago conectado via OAuth')
   └── Redireciona → /dashboard/gateways?mp_connected=1

3. GatewaysClient.tsx
   ├── useEffect([mpConnected, mpError]):
   │     mpConnected=true → toast sucesso + track('gateway_connected', { gateway: 'mercadopago' })
   │     mpError         → toast erro com MP_OAUTH_ERRORS[code] ?? mensagem genérica
   │     router.replace('/dashboard/gateways') — remove ?mp_connected=1 da URL
   └── MP_OAUTH_ERRORS: mapa code → mensagem em português
       { authorization_denied, invalid_state, token_timeout, token_exchange_failed, db_save_failed }
```

### SplitExplanation — cálculo do split por venda

```typescript
const UMBRA_FEE_PCT = 3  // 3% por transação

// Exemplo para venda de R$ 100 via Pix (taxa MP: 0,99%)
gFee = 100 * 0.99 / 100 = 0.99   // Taxa gateway
pFee = 100 * 3    / 100 = 3.00   // Comissão Umbra Bot
net  = 100 - 0.99 - 3.00 = 96.01 // Você recebe
// Visualizado como barra colorida: azul(MP) | roxo(Umbra) | verde(você)
```

### GatewayCard — stats grid 3 colunas

```
Stats grid (só quando conectado, layout 3-col):
  "Volume (30d)"   — fmtBRL(g.volume30d)
  "Transações"     — g.tx30d
  "Taxa real"      — g.avgFeePct.toFixed(2)%  (avg_fee_pct da RPC — dado real das transações)
                     (fallback: g.feeText do catálogo quando avgFeePct === 0)

Cabeçalho do card:
  ExpiryBadge quando g.tokenExpiresAt está definido (só OAuth)

Banner de aviso no card quando daysLeft <= 30:
  "Token expira em Nd. Renovar agora?" + link "Renovar" → abre RenewModal

Borda do card: warning quando daysLeft <= 30; danger quando daysLeft <= 0

Botão "Renovar token" (warning, só quando g.tokenExpiresAt definido):
  → abre RenewModal
```

### Taxa média ponderada — KPI

```typescript
const avgFee = useMemo(() => {
  const total = connected.reduce((s, g) => s + g.volume30d, 0)
  if (total > 0) {
    // Média ponderada pelo volume real de cada gateway
    return connected.reduce((s, g) => s + (g.avgFeePct * g.volume30d), 0) / total
  }
  if (connected.length === 0) return 0
  // Fallback: média simples das taxas Pix do catálogo (sem dados de transações ainda)
  const fees = connected.map(g => g.fee.pix ?? g.fee.card ?? 2.99)
  return fees.reduce((s, v) => s + v, 0) / fees.length
}, [connected])
```

### migração 074 — alterações na tabela gateways

```sql
-- RLS corrigida: open (using true) → owner (auth.uid() = user_id)
-- UNIQUE constraint: UNIQUE (user_id, provider) — permite upsert onConflict
-- Nova coluna: account_id uuid references bank_accounts(id) on delete set null
-- RPC: gateways_stats(p_user_id) → json { [provider]: { volume_30d, tx_30d, avg_fee_pct } }
```

### migração 075 — token_expires_at

```sql
-- Tokens do Mercado Pago via OAuth expiram em 180 dias.
-- Preenchida pelo callback OAuth; zerada ao desconectar; NULL = token manual.
alter table public.gateways
  add column if not exists token_expires_at timestamptz;
```

### Segurança

- `connectGatewayAction` re-valida credenciais server-side (defesa em profundidade)
- OAuth: CSRF via state cookie (httpOnly, sameSite=lax, maxAge=600) — state destruído após uso
- IDOR: bank_account verificado com `.eq('user_id', user.id)` antes de iniciar OAuth
- `testGatewayConnectionAction`: descriptografa + chama API no servidor — token nunca vai ao browser
- Rate limit: validate 15/h, connect 10/h (por user_id via Upstash Redis)
- `disconnectGatewayAction`: limpa `credentials: {}` e `token_expires_at: null` — sem dados residuais
- Realtime: filtro `user_id=eq.${userId}` no canal — usuário só recebe eventos dos próprios gateways

### Variáveis de ambiente necessárias para OAuth

```
MERCADOPAGO_CLIENT_ID      # Número da aplicação no portal MP developers
MERCADOPAGO_CLIENT_SECRET  # Client Secret (aba Credenciais do app MP)
# Redirect URI a configurar no app MP: {APP_URL}/api/payments/mercadopago-oauth/callback
# hasMpOAuth = !!MERCADOPAGO_CLIENT_ID — botão OAuth oculto se não configurado
```

### Eventos PostHog do módulo

| Evento | Quando | Props |
|---|---|---|
| `gateway_connected` | ao conectar via token manual OU via OAuth (callback) | `{ gateway: provider }` |
| `gateway_disconnected` | ao desconectar gateway | `{ gateway: provider }` |
| `gateway_configured` | ao salvar conta bancária de recebimento | `{ gateway: provider }` |
| `gateway_connection_tested` | ao verificar conexão | `{ gateway: provider, success: boolean }` |

---

## 25. MÓDULO DE TRACKEAMENTO

### Arquivos

```
app/dashboard/tracking/
  ├── page.tsx          # Server Component — SSR pixels + RPC pixels_stats em paralelo
  │                     # exporta RawPixelRow e PixelStats (usadas pelo TrackingClient)
  └── TrackingClient.tsx # Client Component — catálogo de providers, cards, modais, UTM, snippets

app/actions/pixels.ts   # 4 Server Actions (todas autenticadas + rate-limit)
  ├── savePixelAction(provider, patch)    → upsert pixels (onConflict user_id,provider) + retorna { id }
  ├── testPixelAction(pixelDbId)         → verifica conexão via API do provider
  │                                        + persiste status='healthy'/'warning' no banco (fire-and-forget)
  ├── sendTestPixelEvent(pixelDbId)      → envia evento de teste real + atualiza last_test_at
  └── fetchPixelStats()                  → re-busca pixels_stats RPC (auto-refresh)

lib/capi.ts             # Disparo automático de eventos de conversão server-side
  └── fireCapiPurchase(data: CapiPurchaseData) → void
        Lê pixels com capi=true do banco (admin client); Promise.allSettled por provider
        Meta CAPI:             POST /v19.0/{pixelId}/events — event_id=txId (deduplicação)
        TikTok Events API:     POST /open_api/v1.3/pixel/track/ — pixel_code ?? pixel_id
        Google Measurement:    POST /mp/collect — client_id=txId, evento purchase
        sha256hex() em email/nome antes de enviar para Meta e TikTok (PII hashing)
        Sentry.captureException() por provider — 1 falha não bloqueia as demais
```

### Fluxo de dados

```
TrackingPage (Server Component)
  ├── Auth guard: if (!user) redirect('/login')
  ├── Promise.all em paralelo:
  │     ├── pixels: id, provider, pixel_id, pixel_code, access_token, status, events, capi,
  │     │           last_test_at, created_at, updated_at — filtrado por user_id, order: created_at asc
  │     └── RPC pixels_stats(p_user_id): { events_sent_today, events_matched, last_event }
  └── passa como props:
        initialPixels: RawPixelRow[]
        initialStats: PixelStats
        userId: string

TrackingClient (Client Component)
  ├── pixels state: PIXEL_CATALOG.map(mapRaw via initialPixels) — sempre 3 entries (sem NoDataState)
  ├── stats state: initialStats — { events_sent_today, events_matched, last_event }
  │
  ├── Auto-refresh a cada 5 min:
  │     setInterval → fetchPixelStats() → setStats(fresh)
  │     recalcula status dos pixels com base em last_event fresco
  │
  ├── Realtime dual-channel:
  │     Canal 1 — 'pixels-tracking': event UPDATE, table pixels, filter user_id=eq.${userId}
  │       → atualiza pixel inline no state (status, pixelId, pixelCode, hasToken, events, capi, lastTestAt)
  │     Canal 2 — 'checkout-events-tracking': event INSERT, table checkout_events, filter user_id=eq.${userId}
  │       → incrementa events_sent_today em 1 (contador ao vivo sem re-fetch)
  │
  ├── PIXEL_CATALOG (estático, 3 providers):
  │     meta:    idLabel='Meta Pixel ID', tokenLabel='Access Token da Conversions API', capiLabel='CAPI'
  │     tiktok:  idLabel='TikTok Advertiser ID', tokenLabel='Access Token da Events API', capiLabel='Events API'
  │              codeLabel='TikTok Pixel Code'  ← campo extra para envio de eventos
  │     google:  idLabel='ID de Medição (G-XXXXXXXX)', tokenLabel='API Secret do Measurement Protocol',
  │              capiLabel='Envio server-side (Measurement Protocol)'
  │
  ├── mergePixels(rows, stats, now): constrói PixelItem[]
  │     hasToken: !!row.access_token  (token criptografado, nunca exposto ao client)
  │     pixelCode: row.pixel_code     (TikTok Pixel Code, null para outros providers)
  │     lastTestAt: row.last_test_at → Date.getTime() | null
  │     dbStatus: row.status          (status persistido no banco — 'healthy' após testPixelAction)
  │     status computado por computeStatus(pixelId, dbStatus, lastEventMs, now):
  │       'inactive' se !pixelId
  │       'healthy'  se !lastEventMs && dbStatus === 'healthy'  ← pixel verificado, ainda sem eventos
  │       'waiting'  se pixelId mas sem lastEventMs (e dbStatus ≠ 'healthy')
  │       'healthy'  se lastEventMs < 30 min atrás
  │       'warning'  se lastEventMs entre 30–60 min
  │       'error'    se lastEventMs > 60 min
  │     eventsSentToday / matchRate: das stats globais (ver nota arquitetural)
  │
  ├── PixelCard (1 por provider — grid de 3 sempre visível):
  │     Cabeçalho: logo provider + nome + status badge (tooltip via HTML title + cursor-help)
  │     Stats: events_sent_today ("0" quando configurado mas sem eventos, não "—") + match_rate
  │     Match rate tip: quando matchRate < 70 e !pixel.hasToken → aviso inline
  │     "Último teste": se lastTestAt → exibe tempo relativo (ex: "há 2h")
  │     Botão "Configurar" / "Editar" → abre EditPixelModal
  │     Botão "Verificar" → abre VerifyPixelModal (só quando pixel.id existe)
  │
  ├── EditPixelModal (novo — separado do PixelCard inline):
  │     Campos: Pixel ID + validação de formato inline
  │       FORMAT_REGEX por provider: meta /^\d{10,16}$/, tiktok /^\d{7,20}$/, google /^G-[A-Z0-9]{4,12}$/i
  │       formatErr: borda vermelha + mensagem FORMAT_HINT ao perder o foco
  │       salvar bloqueado se formatErr=true
  │     TikTok: campo extra "Pixel Code" (pixel_code) — distinto do Advertiser ID
  │     Access Token: input password com toggle show/hide
  │     Eventos CAPI / toggle server-side
  │     save(): valida formato → onSave(provider, patch) → re-throw em erro (modal não fecha em falha)
  │
  ├── VerifyPixelModal (com abas):
  │     Aba "Verificar":
  │       running state + log state (linhas de feedback)
  │       runTest(): testPixelAction(pixel.id) → append ao log → verdict ok/error
  │         track('pixel_verified', { provider, status: 'ok'|'error' })
  │       runTestEvent() (botão "Enviar evento de teste"):
  │         sendTestPixelEvent(pixel.id) → append ao log → verdict + atualiza lastTestAt
  │         track('pixel_test_sent', { provider })
  │         canSendTest: pixel.pixelId && pixel.id && pixel.hasToken && !running && !sendingTest
  │       Log: lista scrollável com ícones ✓/✗ + latência
  │     Aba "Payload Preview":
  │       buildSamplePayload(provider, pixelId, pixelCode): JSON educativo de um evento Purchase
  │       Meta:   CAPI /events body com user_data, custom_data, test_event_code
  │       TikTok: Events API /pixel/track/ body com pixel_code, event, context, properties
  │       Google: Measurement Protocol /mp/collect body com client_id, events[purchase]
  │       Exibido em <pre> com copy button
  │
  ├── Auto-open VerifyPixelModal após salvar pixel novo:
  │     pendingVerifyRef: { current: PixelItem | null }
  │     handleSavePixel(provider, patch):
  │       wasNew = !editing.id antes de salvar
  │       resultado = await savePixelAction → result.id real
  │       se wasNew && patch.pixelId → pendingVerifyRef.current = provisionalPixel
  │     useEffect([editing]): quando editing→null (modal fechou) → setVerifying(pendingVerify.current)
  │
  ├── Export JSON:
  │     botão "Exportar JSON" (só quando hasAnyPixelConfigured)
  │     JSON com provider, pixel_id, pixel_code, capi, events, lastTestAt — SEM access_token
  │     nome: pixel_config_YYYY-MM-DD.json
  │
  ├── UTMBuilderCard:
  │     Inputs: URL base, source, medium, campaign, content, term
  │     isValidUrl(s): new URL(s) + check http/https protocol → false mostra borda vermelha
  │     resultado exibido em textarea readonly
  │     handleCopy(): navigator.clipboard.writeText + track('utm_link_copied', { has_utm })
  │
  ├── SnippetCard (visível apenas quando hasAnyPixelConfigured):
  │     buildBrowserSnippet(provider, pixelId, pixelCode?): gera snippet HTML pronto para o <head>
  │       Meta:   fbevents.js (snippet oficial) com fbq('init', pixelId)
  │       TikTok: ttq.load(pixelCode ?? pixelId) — usa Pixel Code se disponível
  │       Google: gtag.js com gtag('config', measurementId)
  │     Exibe 1 bloco por provider configurado (pixelId != null)
  │     Cada bloco: logo+nome+pixelId chip + botão "Copiar" (isCopied toggle) + <pre> com snippet
  │     Seção "Instalação browser-side" com separador h2
  │
  ├── Banner global (sempre visível, mesmo sem pixels configurados):
  │     Exibe stats (events_sent_today, matched, last_event) ou texto de orientação
  │     Explica que stats são compartilhados (checkout_events não tem coluna por provider)
  │
  └── Link "Documentação": /dashboard/docs/07-analytics/visao-geral-analytics
```

### Interfaces TypeScript

```typescript
export interface RawPixelRow {
  id:           string
  provider:     string
  pixel_id:     string | null
  pixel_code:   string | null  // TikTok Pixel Code (distinto do Advertiser ID) — migração 077
  access_token: string | null  // criptografado — indica hasToken; nunca descriptografado no client
  status:       string
  events:       Record<string, boolean>
  capi:         boolean
  last_test_at: string | null  // ISO timestamp do último evento de teste enviado — migração 077
  created_at:   string
  updated_at:   string
}

export interface PixelStats {
  events_sent_today: number
  events_matched:    number
  last_event:        string | null  // ISO timestamp
}

export interface PixelPatch {
  pixelId:    string | null
  pixelCode:  string | null  // TikTok Pixel Code (distinto do Advertiser ID) — migração 077
  newToken:   string | null  // null = usuário não digitou nada
  clearToken: boolean        // true = usuário limpou o campo explicitamente
  events:     Record<string, boolean>
  capi:       boolean
}

export interface TestResult {
  ok:      boolean
  message: string
  latency: number | null
}

interface PixelItem {
  provider:       string
  name:           string       // do PIXEL_CATALOG
  id:             string | undefined   // UUID do banco (undefined = não salvo ainda)
  pixelId:        string | null
  pixelCode:      string | null        // TikTok Pixel Code — migração 077
  hasToken:       boolean
  dbStatus:       string               // status do banco — 'healthy' após testPixelAction ok
  status:         'healthy' | 'waiting' | 'warning' | 'error' | 'inactive'
  events:         Record<string, boolean>
  capi:           boolean
  lastTestAt:     number | null        // ms timestamp — migração 077
  eventsSentToday: number
  matchRate:      number
}
```

### Server Actions (app/actions/pixels.ts)

```typescript
// savePixelAction(provider, patch): upsert na tabela pixels — RETORNA { id: string }
// userId sempre do servidor (IDOR-safe), rate limit 20/min
// access_token: encryptToken(newToken) se digitou; null se clearToken; mantém se não tocou
// pixel_code: salvo junto (TikTok Pixel Code) — migração 077
// status: 'warning' se pixelId preenchido (aguardando teste); 'inactive' se vazio
// .select('id').single() → retorna o UUID da row (novo ou existente)

// testPixelAction(pixelDbId): verifica conexão com API do provider
// rate limit 10/min; decryptToken(access_token); userId validado (.eq 'user_id', user.id)
// Meta:   GET graph.facebook.com/v19.0/{pixelId}?fields=id,name → verifica data.id
// TikTok: GET business-api.tiktok.com/open_api/v1.3/pixel/list/?advertiser_id={pixelId} → code===0
//         param: advertiserId (Advertiser ID em pixel_id); não usa pixel_code
// Google: valida formato /^G-[A-Z0-9]{4,12}$/i (sem chamada de API — formato basta)
// Após obter resultado: UPDATE pixels SET status='healthy'|'warning' (fire-and-forget)
//   → Realtime propaga o novo status para o client → card exibe 'healthy' mesmo sem eventos

// sendTestPixelEvent(pixelDbId): envia evento real de teste ao provider
// rate limit 5/min; requer pixel_id + access_token; busca pixel_code também (migração 077)
// Meta:   POST /v19.0/{pixelId}/events com test_event_code='TEST00001'
//           evento Purchase, currency=BRL, value=1.00 — visível no Gerenciador de Eventos
// TikTok: POST /open_api/v1.3/pixel/track/ com test_event_code='TEST_EVENT'
//           evento CompletePayment — usa pixel.pixel_code ?? pixel.pixel_id (pixel_code prioritário)
// Google: POST /debug/mp/collect (NÃO polui dados de produção — endpoint de validação)
//           evento purchase; retorna validationMessages — ok se vazio
// Após envio bem-sucedido: UPDATE pixels SET last_test_at = now() (fire-and-forget)

// fetchPixelStats(): re-busca RPC pixels_stats para auto-refresh no client
// rate limit implícito pelo Supabase; retorna { events_sent_today, events_matched, last_event }
```

### Tabela pixels — schema completo (migração 076 + 077)

```sql
-- Migração 076: criou o schema correto
create table public.pixels (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  provider     text        not null check (provider in ('meta', 'tiktok', 'google')),
  pixel_id     text,
  access_token text,   -- criptografado AES-256-GCM (enc:<iv>:<tag>:<cipher>)
  status       text    not null default 'inactive'
                         check (status in ('healthy', 'warning', 'error', 'inactive')),
  events       jsonb   not null default '{}',
  capi         boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint   pixels_user_provider_key unique (user_id, provider)
);
-- Índices: pixels_user_id_idx, pixels_status_idx
-- Trigger: pixels_updated_at (chama set_updated_at())
-- RLS: pixels_owner → auth.uid() = user_id (for all)

-- Migração 077: adiciona colunas para TikTok Pixel Code e histórico de testes
alter table public.pixels
  add column if not exists pixel_code   text,       -- TikTok Pixel Code (distinto do Advertiser ID em pixel_id)
  add column if not exists last_test_at timestamptz; -- Timestamp do último evento de teste enviado
-- Comentários adicionados para documentar a distinção dos campos TikTok
```

**Problemas corrigidos pela migração 076:**
- PK era `text` (`'meta'|'tiktok'|'google'`) → colisão entre usuários (IDOR crítico)
- RLS `pixels_open` (`using true`) → qualquer autenticado via SDK direto podia ler pixels alheios
- `access_token` em plain text → agora criptografado AES-256-GCM pela app antes de salvar
- Sem `UNIQUE(user_id, provider)` → múltiplos rows impossíveis por design mas não garantido

**TikTok — distinção de campos:**
- `pixel_id`: Advertiser ID — usado para verificar a conta via `/pixel/list/?advertiser_id=`
- `pixel_code`: Pixel Code — usado para enviar eventos via `/pixel/track/` (campo `pixel_code`)
- São valores diferentes no painel TikTok Business; ambos necessários para integração completa

### RPC pixels_stats (migração 076)

```sql
create or replace function public.pixels_stats(p_user_id uuid)
returns json language sql stable security invoker
-- Retorna: { events_sent_today, events_matched, last_event }
-- events_sent_today: count de checkout_events nas últimas 24h para o user
-- events_matched: subset com contato que tem email ou phone (atribuíveis)
-- last_event: MAX(created_at) de checkout_events para o user
-- Nota: stats são globais por usuário (todos os providers recebem os mesmos eventos de checkout)
-- grant execute to authenticated
```

### Status dos pixels — 5 estados

| status | Label | Condição |
|---|---|---|
| `inactive` | Inativo | pixel_id não configurado |
| `waiting` | Aguardando evento | pixel_id configurado, sem eventos e dbStatus ≠ 'healthy' |
| `healthy` | Ativo | último evento < 30 min **OU** dbStatus='healthy' sem eventos (verificado manualmente) |
| `warning` | Volume baixo | último evento entre 30–60 min |
| `error` | Sem eventos | último evento > 60 min |

O estado `waiting` é distinto de `warning` — indica que o pixel está configurado mas ainda não recebeu seu primeiro evento de checkout. Após o `testPixelAction` retornar ok, o banco é atualizado para `status='healthy'` e o card passa a mostrar 'healthy' mesmo sem eventos reais de checkout, refletindo que a conexão foi verificada com sucesso.

### Stats globais — nota arquitetural

A tabela `checkout_events` não tem coluna `provider`, portanto os stats exibidos em cada `PixelCard` são idênticos (o mesmo pool de eventos de checkout). O banner explicativo e o `note="global"` no `StatT` deixam isso claro para o usuário. Para stats por provider seria necessário adicionar uma coluna `provider` à tabela `checkout_events` e filtrar na RPC.

### Payload Preview — buildSamplePayload()

Função client-side (sem chamada real) que gera JSON educativo de um evento Purchase de exemplo:

| Provider | Endpoint | Evento de exemplo |
|---|---|---|
| Meta | POST /v19.0/{pixelId}/events | `Purchase` com `test_event_code='TEST00001'` |
| TikTok | POST /open_api/v1.3/pixel/track/ | `CompletePayment` com `test_event_code='TEST_EVENT'` |
| Google | POST /mp/collect | `purchase` via Measurement Protocol |

O JSON inclui apenas campos educativos — tokens e dados reais nunca expostos no preview.

### Segurança

- `access_token` nunca incluído na leitura do `page.tsx` sem ser descriptografado (só `!!row.access_token` chega ao client como `hasToken`)
- Export JSON exclui `access_token` — apenas configurações não-sensíveis exportadas
- `savePixelAction` e `testPixelAction` leem `userId` do servidor via `supabase.auth.getUser()` — IDOR-safe
- `testPixelAction` valida `.eq('user_id', user.id)` antes de descriptografar — cross-user prevented
- Rate limits separados: save 20/min, test 10/min, test_event 5/min
- Tokens criptografados AES-256-GCM com `BOT_TOKEN_ENCRYPTION_KEY` (mesma chave dos bots)

### Eventos PostHog do módulo

| Evento | Quando | Props |
|---|---|---|
| `pixel_configured` | ao salvar configuração de um pixel | `{ provider, has_capi, events_enabled_count }` |
| `pixel_verified` | ao verificar conexão via API | `{ provider, status: 'ok' \| 'error' }` |
| `pixel_test_sent` | ao enviar evento de teste (CAPI/Events API) | `{ provider }` |
| `utm_link_copied` | ao copiar link UTM gerado | `{ has_utm: boolean }` |

---

## 26. MÓDULO DE CHECKOUT

### Arquivos

```
app/dashboard/checkout/
  ├── page.tsx          # Server Component — SSR checkouts + gateways + pixels + coupons em paralelo
  │                     # exporta RawCheckout (inclui success_url, guarantee_days, countdown_end,
  │                     # order_bump, logo_image, two_step, upsell, visitor_tracking)
  │                     # exporta RawGateway, RawPixel, RawCoupon
  └── CheckoutClient.tsx # Client Component — editor completo + lista com analytics drill-down
                         # OrderBumpSection, UpsellSection, CouponSection wired no editor
                         # logo_image field na aba Identidade; two_step + visitor_tracking na aba Layout

app/c/[slug]/
  ├── page.tsx          # Server Component público (admin client, sem auth do comprador)
  │                     # Busca checkout por slug (status='published') + pixels do dono
  │                     # PublicCheckout: success_url, guarantee_days, countdown_end,
  │                     # order_bump, logo_image, two_step, upsell, visitor_tracking
  │                     # Pixels: provider, pixelId, pixelCode (sem access_token)
  ├── CheckoutPageClient.tsx # Client Component público — formulário de compra completo
  │                          # logo_image, contador visitantes (Realtime Presence), 2 etapas,
  │                          # cupom de desconto (preview via /validate-coupon), order bump, upsell
  └── PixelScripts.tsx  # Snippets de pixel injetados no <head> da página pública
                         # step: 'form'|'payment'|'success'|'upsell'|'error'
                         # Purchase dispara em step==='success' || step==='upsell'

app/api/checkout/
  ├── pay/route.ts      # POST: cria pagamento PIX (sem auth) — admin client
  │                     # Suporte a CPF (11 dígitos) e CNPJ (14 dígitos)
  │                     # Aceita coupon_code (validate_and_apply_coupon RPC, incremento atômico)
  │                     # Aceita order_bump boolean; totalPrice = (price−desconto) + bumpPrice
  │                     # Persiste checkout_id + customer_phone na transaction (mig 079)
  ├── validate-coupon/route.ts  # GET: preview de cupom SEM incrementar uses
  │                              # Público, rate-limit 30/min por IP; admin client
  │                              # Retorna { valid, coupon_id, type, value, discount, final }
  └── track/route.ts    # POST: registra eventos de funil (visited/cart_added/payment_initiated)
                        # Usa RPC track_checkout_event (security definer, mig 041)
```

### Fluxo de dados — Editor (dashboard)

```
CheckoutPage (Server Component)
  ├── Auth guard: if (!user) redirect('/login')
  ├── Promise.all em paralelo:
  │     ├── checkouts: todos os campos incluindo success_url, guarantee_days, countdown_end
  │     ├── gateways: id, provider, account (connected=true)
  │     └── pixels: id, provider, pixel_id, capi
  └── passa como props:
        initialCheckouts: RawCheckout[]
        userId: string
        connectedGateways: RawGateway[]
        configuredPixels: RawPixel[]
        appUrl: string

CheckoutClient (Client Component)
  ├── checkouts state: initialCheckouts.map(mapRaw)
  ├── editing state: Checkout | null — null = lista; Checkout = editor
  │
  ├── Lista de checkouts:
  │     CheckoutCard: nome, status, visits/conversions/conversion
  │     Funil lazy (analytics drill-down) por checkout:
  │       funnels state: Record<id, CheckoutFunnel>
  │       loadFunnel(id): busca em paralelo:
  │         checkout_events COUNT WHERE checkout_id=id AND event_type='visited'
  │         checkout_events COUNT WHERE checkout_id=id AND event_type='cart_added'
  │         transactions COUNT WHERE checkout_id=id AND status='approved'
  │       FunnelBar: barra de progresso 3 etapas (Visitou / Carrinho / Pago) ao expandir card
  │
  ├── Editor (quando editing !== null):
  │     Abas: Identidade | Produto | Pagamento | Campos | Layout | Avançado
  │
  │     Aba Produto:
  │       product_image: input URL + upload para Supabase Storage (bucket checkout-images)
  │         Pasta: {userId}/{checkoutId}.{ext}, max 2 MB
  │         Preview ao vivo após upload bem-sucedido
  │
  │     Aba Avançado (seção "Configurações avançadas"):
  │       success_url: input URL — validado com new URL() antes de salvar
  │         Exibe preview do domínio ao digitar URL válida
  │       guarantee_days: input number — exibe badge "<N> dias de garantia" ao vivo
  │         <Shield> icon com cor primary quando preenchido
  │       countdown_end: datetime-local input — exibe "⏳ Ativo até ..." quando futuro
  │         Indicador "Expirado" quando no passado
  │
  │     PreviewPanel (lado direito do editor):
  │       toggle Desktop/Mobile no topo do painel
  │       Desktop: CheckoutPreview em largura normal
  │       Mobile: frame de celular (border-4 rounded-[32px], max-width 375px, max-height 640px overflow-y-auto)
  │
  ├── createCheckout(): INSERT com user_id + success_url/guarantee_days/countdown_end = null
  ├── saveCheckout(updated): UPDATE com novos campos + success_url/guarantee_days/countdown_end
  ├── duplicateCheckout(id): copia com slug = original.slug + '-copia-' + newId.slice(0,4)
  │     copia também success_url, guarantee_days, countdown_end
  ├── publishCheckout / archiveCheckout / deleteCheckout: padrão com .eq('user_id')
  └── Realtime canal 'checkouts-realtime', filtrado por user_id
```

### Fluxo de dados — Página pública /c/[slug]

```
PublicCheckoutPage (Server Component)
  ├── Admin client (sem sessão do comprador)
  ├── Busca checkout pelo slug WHERE status='published'
  │     Campos: id, slug, name, product_name, product_desc, product_image, price,
  │             installments, gateway, primary_color, bg_variant, font, logo, badge,
  │             fields, methods, layout, user_id, success_url, guarantee_days, countdown_end
  ├── Busca pixels do dono (sem access_token — apenas provider, pixel_id, pixel_code)
  └── Passa checkout + pixels + utmParams ao CheckoutPageClient

CheckoutPageClient (Client Component)
  ├── Registra visita ao montar: fetch POST /api/checkout/track { checkout_id, event_type:'visited' }
  │     (ou RPC track_checkout_visit se disponível)
  │
  ├── Header: logo_image sobrescreve logo texto quando c.logo_image definido
  │     contador "🔴 N pessoas vendo agora" quando visitor_tracking=true e visitCount > 1
  │     (Supabase Realtime Presence: canal por checkout_id, sync a cada join/leave)
  │
  ├── countdown_end: timer de urgência no topo (formato DD:HH:MM:SS)
  │     Oculto quando countdown_end é null ou já expirou
  │     useEffect com setInterval 1s; clearInterval no unmount
  │
  ├── guarantee_days: badge "<N> dias de garantia" no rodapé do formulário
  │     <Shield> icon + "Garantia de N dias"
  │     Oculto quando guarantee_days é null ou 0
  │
  ├── Formulário de compra (two_step=false: 1 página | two_step=true: 2 etapas):
  │     Etapa 1 (personal): nome, email, CPF/CNPJ, telefone, etc.
  │     Etapa 2 (payment):  método + cupom + order bump
  │     Indicador de progresso (Etapa 1 de 2 / 2 de 2) quando two_step=true
  │     CPF/CNPJ: sempre exibido (campo always: true) — label 'CPF / CNPJ'
  │       Máscara automática: 000.000.000-00 (CPF) ↔ 00.000.000/0000-00 (CNPJ)
  │       Troca de máscara ao atingir 11 dígitos numéricos
  │     Demais campos: renderizados conforme checkout.fields (name, email, phone, cep, address)
  │
  ├── Cupom de desconto (quando checkout tem coupons ativos):
  │     Input + botão "Aplicar" → GET /api/checkout/validate-coupon (sem incremento)
  │     Exibe desconto ao vivo no resumo de preço se válido
  │     handleApplyCoupon: setCouponResult({ valid, discount, final, type, value })
  │     coupon_code enviado no POST /api/checkout/pay (incremento acontece na API)
  │
  ├── Order Bump (quando c.order_bump definido):
  │     Checkbox acima do botão de pagamento
  │     orderBumpSelected boolean → soma c.order_bump.price ao efectivePrice
  │     efectivePrice = max(0, price − discount) + bumpAmount
  │
  ├── Após submit:
  │     POST /api/checkout/pay { ...campos, coupon_code, order_bump } →
  │       { transaction_id, pix_qr_code, pix_copy_paste, expires_at, amount }
  │     Exibe tela PIX com QR code + copia-e-cola + countdown 30 min
  │
  ├── Countdown PIX 30 min:
  │     expires_at retornado pela API → calcula segundos restantes
  │     Atualiza a cada segundo; mostra "Código expirado" quando chega a zero
  │
  ├── Polling de status PIX (recursive setTimeout, 4s, MAX_ATTEMPTS=120):
  │     GET /api/checkout/status?tx_id=...&checkout_id=... → { status }
  │     Padrão recursive setTimeout (não setInterval) — evita sobreposição de requests async
  │     flag `active` + `clearTimeout` no cleanup → seguro para unmount
  │     'approved' → verifica c.upsell → se definido: step='upsell'; senão: redireciona/confirma
  │     'cancelled' → exibe mensagem de expiração + step='error'
  │     `paidAmountRef.current` capturado no `handleSubmit` antes do submit → usado no
  │     `useEffect` de `checkout_pay_success` sem depender de `effectivePrice` (temporal dead zone)
  │
  ├── Upsell pós-pagamento (step='upsell', quando c.upsell definido):
  │     Modal com título, descrição, preço e CTA do upsell
  │     Botão CTA: window.open(c.upsell.link) → navega para oferta
  │     Botão "Não, obrigado": avança para success_url ou confirmação inline
  │     PixelScripts: Purchase dispara em step==='upsell' também
  │
  ├── Aviso legal (abaixo do botão Pagar, apenas em step='form'):
  │     Texto: "Ao clicar em 'Pagar R$X', eu declaro que (i) estou ciente que a Umbra Bot está processando
  │     essa compra em nome de {sellerName} e que não possui responsabilidade pelo conteúdo, oferta, e nem
  │     faz controle prévio do infoproduto; (ii) que li e concordo com os Termos de Compra, Termos de Uso
  │     e Política de Privacidade."
  │     + Link "Denunciar esse produto" (mailto:contato@umbra.bot?subject=...)
  │     + Nota "*Parcelamento com acréscimo" (visível apenas quando c.installments > 1)
  │     + "Este site está protegido pelo Google reCAPTCHA. Política de Privacidade e Termos de Serviço."
  │     sellerName: prop string vinda do Server Component (profiles.name do vendedor, fallback 'o vendedor')
  │
  └── Sucesso:
        Se success_url configurado: window.location.href = success_url (comprador sai do checkout)
        Se não configurado: exibe tela de confirmação inline com ícone ✓
```

### Interfaces TypeScript

```typescript
// RawCheckout — exportada de page.tsx do dashboard
export interface RawCheckout {
  id, name, slug, product_name, product_desc, product_image: string | null
  price, installments
  gateway, pixel, primary_color, bg_variant, font, logo
  badge: string | null
  fields, methods: Record<string, boolean>
  layout: 'two_col' | 'one_col'
  status: 'published' | 'draft' | 'archived'
  visits, conversions, conversion
  created_at, updated_at
  success_url: string | null     // migração 081
  guarantee_days: number | null  // migração 081
  countdown_end: string | null   // migração 081
  /* migração 085 */
  order_bump:       { title: string; desc: string; price: number; image: string | null } | null
  logo_image:       string | null
  two_step:         boolean
  upsell:           { title: string; desc: string; price: number; cta: string; link: string } | null
  visitor_tracking: boolean
}

// RawCoupon — exportada de page.tsx do dashboard
export interface RawCoupon {
  id: string
  code: string
  type: 'percent' | 'fixed'
  value: number
  max_uses: number | null
  uses: number
  valid_until: string | null
  active: boolean
}

// Checkout — interface interna (camelCase)
interface Checkout {
  id, name, slug, productName, productDesc, productImage: string | null
  price, installments
  gateway, pixel, primaryColor, bgVariant, font, logo
  badge: string | null
  fields, methods: Record<string, boolean>
  layout: 'two_col' | 'one_col'
  status: 'published' | 'draft' | 'archived'
  visits, conversions, conversion
  createdAt, updatedAt
  successUrl: string            // '' quando null no banco
  guaranteeDays: number | null
  countdownEnd: string | null   // ISO string ou ''
}

// CheckoutFunnel — funil lazy por checkout
interface CheckoutFunnel {
  visited: number
  cart:    number
  paid:    number
}

// PublicCheckout — exportada de page.tsx público
export interface PublicCheckout {
  id, slug, name, product_name, product_desc, product_image: string | null
  price, installments, gateway, primary_color, bg_variant, font, logo
  badge: string | null
  fields, methods: Record<string, boolean>
  layout: 'two_col' | 'one_col'
  user_id
  success_url: string | null
  guarantee_days: number | null
  countdown_end: string | null
  /* migração 085 */
  order_bump:       { title: string; desc: string; price: number; image: string | null } | null
  logo_image:       string | null
  two_step:         boolean
  upsell:           { title: string; desc: string; price: number; cta: string; link: string } | null
  visitor_tracking: boolean
}
```

### API /api/checkout/pay — melhorias

```typescript
// Suporte a CNPJ (migração 079)
customer_cpf: z.string()
  .transform((v) => v.replace(/\D/g, ''))
  .pipe(z.string().refine(
    (v) => v.length === 11 || v.length === 14,
    'CPF deve ter 11 dígitos ou CNPJ 14 dígitos.',
  ))

const docType = customer_cpf.length === 14 ? 'CNPJ' : 'CPF'

// Cupom + order bump (migração 086 / 085)
coupon_code: z.string().max(50).nullish()
order_bump:  z.boolean().nullish()

// 1. valida e aplica cupom (incrementa uses atomicamente)
if (couponCodeClean) {
  const { data } = await admin.rpc('validate_and_apply_coupon', {
    p_user_id: checkout.user_id, p_code: couponCodeClean, p_price: Number(checkout.price),
  })
  if (data?.valid) discountAmount = Number(data.discount ?? 0)
}
// 2. calcula totalPrice
const basePrice  = Math.max(0, Number(checkout.price) - discountAmount)
const bumpPrice  = order_bump ? Number((checkout.order_bump as {price:number}|null)?.price ?? 0) : 0
const totalPrice = basePrice + bumpPrice

// Persiste checkout_id na transaction (migração 079)
await admin.from('transactions').insert({
  // ... campos existentes ...
  checkout_id: checkout_id,        // string UUID do checkout
  customer_phone: customerPhone,   // número de telefone (opcional)
  amount: totalPrice,              // preço efetivo (com desconto e bump)
})
```

### Migrações do módulo

| Migração | O que fez |
|---|---|
| 078 | Adicionou `checkout_id text FK → checkouts(id)` em `checkout_events`; trigger `trg_sync_checkout_stats` (visits++ e conversions++ automáticos); RPC `track_checkout_visit(p_slug, ...)` — security definer, grant to anon |
| 079 | Adicionou `checkout_id text FK → checkouts(id)` e `customer_phone text` em `transactions`; RPC `checkout_tx_status(p_tx_id, p_checkout_id)` — retorna apenas `{ status }`, grant to anon |
| 080 | Adicionou `product_image text` em `checkouts`; bucket `checkout-images` (público, 2 MB, jpg/png/webp/gif, RLS por pasta user_id) |
| 081 | Adicionou `success_url text`, `guarantee_days integer`, `countdown_end timestamptz` em `checkouts` |
| 082 | RLS `checkouts_owner` (`auth.uid() = user_id`) — substituiu `checkouts_open` (IDOR crítico resolvido) |
| 085 | Adicionou 5 colunas em `checkouts`: `order_bump jsonb`, `logo_image text`, `two_step boolean default false`, `upsell jsonb`, `visitor_tracking boolean default false` |
| 086 | Criou tabela `checkout_coupons` (RLS owner, `UNIQUE(user_id, code)`); RPC `validate_and_apply_coupon(p_user_id, p_code, p_price)` — security definer, incremento atômico de `uses`, grant to authenticated/anon |

### Segurança

- `admin client` na página pública `/c/[slug]` — necessário pois o comprador não tem sessão; segurança pela natureza dos dados (checkout publicado, pixels sem token)
- `checkout_tx_status`: retorna apenas `{ status }` — sem QR code, sem dados do comprador (zero leak)
- `track_checkout_visit`: security definer resolve user_id via slug — caller (anon) não precisa informar user_id
- Upload de imagem: RLS de storage valida `auth.uid()` no path (pasta `{user_id}/`) — sem IDOR
- `/api/checkout/pay`: rate limit 20/min por IP; `checkout_id` e `user_id` buscados do banco (IDOR-safe)
- CPF/CNPJ: apenas dígitos enviados à API do Mercado Pago (`replace(/\D/g, '')` antes do envio)

### Eventos PostHog do módulo

| Evento | Quando | Props |
|---|---|---|
| `checkout_created` | ao criar checkout (blank ou template) | `{}` |
| `checkout_published` | ao publicar checkout | `{}` |
| `checkout_deleted` | ao confirmar exclusão | `{}` |
| `checkout_duplicated` | ao duplicar checkout | `{}` |

---

## 27. MÓDULO DE PERFIL

### Arquivos

```
app/dashboard/profile/
  ├── page.tsx          # Server Component — busca profiles + team_members + MFA factors +
  │                     # get_pending_invites_for_user em Promise.all
  └── ProfileClient.tsx # Client Component — todas as abas do perfil
```

### Fluxo de dados

```
ProfilePage (Server Component)
  ├── Promise.all em paralelo:
  │     ├── profiles: name, phone, avatar_url, avatar_color, avatar_initials,
  │     │             timezone, language, workspace, two_fa_enabled, two_fa_enabled_at, created_at
  │     ├── team_members: id, name, email, avatar, color, role, status, last_seen, joined_at, self, user_id
  │     │   .eq('user_id', user.id) — membros do workspace do usuário logado
  │     ├── supabase.auth.mfa.listFactors()  — fatores TOTP para 2FA
  │     └── RPC get_pending_invites_for_user(p_email) — convites recebidos pelo e-mail do usuário
  └── passa como props:
        initialProfile: RawProfile | null
        initialMembers: RawMember[]
        initialPendingInvites: RawPendingInvite[]
        userId: string
        userEmail: string
        hasMfa: boolean
        mfaFactorId: string | null
```

### getInitials — fallback para e-mail

```typescript
function getInitials(name: string, email?: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  // Nome vazio — usa os 2 primeiros chars do local-part do e-mail
  if (email) {
    const local = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')
    if (local.length >= 2) return local.slice(0, 2).toUpperCase()
    if (local.length === 1) return local.toUpperCase()
  }
  return '?'
}
// Exemplo: getInitials('', 'monetizarcomia7@gmail.com') → 'MO'
// Usado em: profileToAccount, mapMember, ownerMember, onSaved, InviteModal
```

### Papéis de equipe

| Papel | Label | Descrição | Controle de acesso |
|---|---|---|---|
| `owner` | Proprietário | Acesso total | ✅ Implementado (dono do workspace) |
| `admin` | Administrador | Pode gerenciar bots, fluxos, finanças e equipe | ⏳ Pendente |
| `editor` | Editor | Pode editar fluxos e disparos. Sem acesso a finanças | ⏳ Pendente |
| `analyst` | Analista | Acesso somente leitura — análises e relatórios | ⏳ Pendente |

> **Nota:** Os papéis têm labels e descrições na UI mas o controle de acesso real (permitir que membros acessem o workspace do dono) não está implementado. Membros aceitam o convite → aparecem na lista → mas acessam apenas o próprio workspace. Implementação futura requer: RLS multi-tenant + contexto de workspace no dashboard + filtro de rotas por papel.

### Convites de equipe in-app (migração 093)

```
Fluxo completo:
  1. Dono abre InviteModal → preenche e-mail + papel → clica Convidar
  2. supabase.rpc('invite_team_member', { p_owner_id, p_id, p_name, p_email, p_avatar,
                                          p_color, p_role, p_joined_at })
     ├── INSERT em team_members (status='invited')
     └── Se o convidado tem conta (auth.users lookup por e-mail):
           INSERT em alerts (type='team_invite', user_id=invitee_id,
                             source='team_invite:{invite_id}')
  3. Convidado entra no Perfil → vê PendingInvitesCard no topo (via get_pending_invites_for_user)
  4. Clica "Aceitar":
     supabase.rpc('accept_team_invite', { p_invite_id, p_user_id })
     ├── UPDATE team_members SET status='active', last_seen=now()
     └── UPDATE alerts SET resolved=true, resolved_by='aceito pelo convidado'
  5. Clica "Recusar":
     supabase.rpc('reject_team_invite', { p_invite_id, p_user_id })
     ├── DELETE FROM team_members WHERE id=invite_id
     └── UPDATE alerts SET resolved=true, resolved_by='recusado pelo convidado'
```

### RPCs de convite (migração 093)

Todas `SECURITY DEFINER`, `search_path = public`, `grant to authenticated`:

| RPC | Descrição |
|---|---|
| `invite_team_member(p_owner_id, p_id, p_name, p_email, p_avatar, p_color, p_role, p_joined_at)` | Insere convite + cria alerta in-app para o convidado se ele tiver conta |
| `get_pending_invites_for_user(p_email)` | Retorna convites `status='invited'` onde `lower(email) = lower(p_email)` + dados do dono |
| `accept_team_invite(p_invite_id, p_user_id)` | Ativa convite + resolve alerta |
| `reject_team_invite(p_invite_id, p_user_id)` | Remove convite + resolve alerta |

### PendingInvitesCard

Renderizado no topo do ProfileClient quando `pendingInvites.length > 0`. Exibe:
- Avatar do dono (cor + iniciais)
- Nome do dono e workspace
- Papel oferecido (badge colorido)
- Data do convite
- Botões **Aceitar** / **Recusar** (cada um chama a RPC correspondente e remove da lista local)

### AlertsClient — tipos estendidos

`'webhookFailed'` e `'team_invite'` adicionados ao `AlertType` union e ao `ALERT_TYPES` map:
- `webhookFailed`: ação navega para `/dashboard/webhooks`
- `team_invite`: ação navega para `/dashboard/profile`

### Migrações do módulo

| Migração | O que fez |
|---|---|
| 092 | Adicionou `avatar_initials text` em `profiles`; adicionou `user_id uuid FK → auth.users(id)` em `team_members` + RLS `team_members_owner` (`auth.uid() = user_id`) |
| 093 | Estendeu CHECK `alerts.type` para incluir `'webhookFailed'` e `'team_invite'`; criou 4 RPCs SECURITY DEFINER: `invite_team_member`, `get_pending_invites_for_user`, `accept_team_invite`, `reject_team_invite` |

> ⚠️ **Migrações 092 e 093 precisam ser aplicadas no Supabase SQL Editor para ativar o sistema em produção.**

---

## 28. MÓDULO GUIA DA PLATAFORMA

### Arquivos

```
app/dashboard/guide/
  ├── page.tsx          # Server Component — SSR guide_articles + guide_faqs em paralelo (ISR revalidate=3600)
  │                     # Exporta RawGuideArticle e RawGuideFaq; busca apenas artigos published,
  │                     # ordenados por category e order_in_category
  └── GuideClient.tsx   # Client Component — busca client-side, filtros por categoria,
                        # ArticlePanel com body Markdown→HTML lazy, TOC, votos, views,
                        # FAQ accordion, CTAs de suporte (WhatsApp/Telegram), 5 PostHog eventos

app/actions/guide.ts    # 4 Server Actions (todas autenticadas)
  ├── getArticleBodyAction(articleId)   → body Markdown→HTML + TOC + helpful_yes/no + views
  │   fire-and-forget: void .then({error}) para increment_article_views — NUNCA .catch()
  │   (PostgrestFilterBuilder não tem .catch — apenas .then)
  ├── voteArticleAction(articleId, helpful)  → toggle via RPC vote_article + rate limit 10/60s
  ├── getUserVoteAction(articleId)           → boolean | null via RPC get_article_vote
  └── logGuideSearchAction(query, count)     → INSERT guide_search_logs se query ≥ 2 chars
```

### Fluxo de dados

```
GuidePage (Server Component — ISR revalidate=3600)
  ├── Auth guard: if (!user) redirect('/login')
  ├── Promise.all em paralelo:
  │     ├── guide_articles: id, slug, category, icon, icon_color, title, excerpt,
  │     │   read_min, views, featured, helpful_yes, helpful_no, tags,
  │     │   order_in_category, updated_at   WHERE status='published'
  │     │   ORDER BY category, order_in_category
  │     └── guide_faqs: id, question, answer, order_num   ORDER BY order_num
  └── passa como props:
        initialArticles: RawGuideArticle[]
        initialFaqs: RawGuideFaq[]

GuideClient (Client Component)
  ├── articles state: initialArticles — nunca mock
  ├── faqs state: initialFaqs — nunca mock
  ├── search state: string — filtra título/excerpt/tags (client-side, sem debounce de DB)
  ├── selectedCategory state: string | 'all'
  ├── selectedArticleId state: string | null — null = lista; string = ArticlePanel aberto
  │
  ├── Categorias derivadas: Array.from(new Set(articles.map(a => a.category)))
  │
  ├── filteredArticles useMemo: filtra por search + selectedCategory
  │   logGuideSearchAction chamado quando search.trim().length ≥ 2 (debounce 600ms)
  │
  ├── ArticlePanel (quando selectedArticleId !== null):
  │     Abre com body lazy: getArticleBodyAction(selectedArticleId)
  │     Renderiza: bodyHtml + TOC (table of contents com links âncora para h2)
  │     Votos: estado local userVote + helpfulYes/helpfulNo
  │       handleVote(): voteArticleAction → atualiza contadores locais
  │       getUserVoteAction() ao abrir painel (carregado junto com o body)
  │     Views: exibido com +1 otimista (incremento real é fire-and-forget no servidor)
  │     CTAs de suporte: WhatsApp + Telegram deep link
  │     Navegação: botão Voltar → selectedArticleId = null
  │
  ├── FAQ Section (accordion):
  │     Cada RawGuideFaq: question (clicável) + answer (expandível)
  │     Estado local expandedFaq: string | null
  │
  └── CTAs de Suporte (fora do ArticlePanel — na área principal):
        Botão WhatsApp / Botão Telegram
        track('guide_support_clicked', { action: 'whatsapp' | 'telegram' })
```

### Interfaces TypeScript

```typescript
// Exportadas de app/dashboard/guide/page.tsx
export interface RawGuideArticle {
  id:                string
  slug:              string | null
  category:          string
  icon:              string
  icon_color:        string
  title:             string
  excerpt:           string
  read_min:          number
  views:             number
  featured:          boolean
  helpful_yes:       number
  helpful_no:        number
  tags:              string[]
  order_in_category: number
  updated_at:        string
}

export interface RawGuideFaq {
  id:        string
  question:  string
  answer:    string
  order_num: number
}

// TocItem — retornado por getArticleBodyAction
export interface TocItem {
  id:    string   // slugify do texto do h2
  label: string   // texto do h2
}
```

### Rendering Markdown → HTML (app/actions/guide.ts)

```typescript
// slugify(text): lowercase → NFD normalize → remove diacritics → replace non-alnum → trim → hyphenate
function slugify(text: string): string { ... }

// extractToc(markdown): regex /^## (.+)$/gm → TocItem[]
function extractToc(markdown: string): TocItem[] { ... }

// buildRenderer(): custom Renderer para marked
// Sobrescreve heading para depth===2: <h2 id="${slugify(text)}">${text}</h2>
// Outros levels → renderer padrão
function buildRenderer(): Renderer { ... }

// getArticleBodyAction(articleId):
// 1. Auth check
// 2. SELECT body, helpful_yes, helpful_no, views WHERE id=articleId AND status='published'
// 3. fire-and-forget: void supabase.rpc('increment_article_views', { p_article_id: articleId })
//      .then(({ error }) => { if (error) Sentry.captureException(error) })
// 4. toc = extractToc(body)
// 5. bodyHtml = marked.parse(body, { renderer }) as string
// 6. retorna { bodyHtml, toc, helpfulYes, helpfulNo, views: views + 1 }
//    (views + 1: otimista antes do DB propagar)
```

### Schema do banco (migração 070)

```sql
-- guide_articles (colunas existentes + novas da mig 070)
id              text        primary key  -- shortcode manual (ex: 'bots-conectar')
title           text        not null
excerpt         text
body            text
read_min        integer     not null default 3
views           integer     not null default 0
updated_at      timestamptz not null default now()
-- Colunas adicionadas na migração 070:
slug            text                             -- URL amigável (UNIQUE onde not null)
status          text        not null default 'published'
                              check (status in ('published','draft','archived'))
icon            text        not null default '📄'
icon_color      text        not null default 'blue'
helpful_yes     integer     not null default 0
helpful_no      integer     not null default 0
tags            text[]      not null default '{}'
order_in_category integer   not null default 0
-- RLS (migração 070): guide_articles_authenticated_select
--   (SELECT for role=authenticated — usando true → todos os usuários logados podem ler)
--   Substitui guide_articles_open (using true — expunha a anon key)

-- guide_faqs (nova tabela — migração 070)
id         uuid  primary key default gen_random_uuid()
question   text  not null
answer     text  not null
order_num  integer not null default 0
created_at timestamptz not null default now()
-- RLS: guide_faqs_authenticated_select (SELECT for authenticated)

-- guide_article_votes (nova tabela — migração 070)
id          uuid  primary key default gen_random_uuid()
article_id  text  not null references guide_articles(id) on delete cascade
user_id     uuid  not null references auth.users(id) on delete cascade
helpful     boolean not null
created_at  timestamptz not null default now()
UNIQUE (article_id, user_id)
-- RLS: guide_article_votes_owner (for all using auth.uid() = user_id)

-- guide_search_logs (nova tabela — migração 070)
id            uuid  primary key default gen_random_uuid()
user_id       uuid  not null references auth.users(id) on delete cascade
query         text  not null   -- truncado em 200 chars
results_count integer not null default 0
clicked       boolean not null default false
created_at    timestamptz not null default now()
-- RLS: INSERT policy → auth.uid() = user_id (sem SELECT policy — dados de telemetria)
```

### RPCs do módulo (migração 070)

```sql
-- increment_article_views(p_article_id text) → void
-- UPDATE guide_articles SET views = views + 1 WHERE id = p_article_id
-- grant to authenticated; security invoker
-- Chamada fire-and-forget — falha não bloqueia carregamento do artigo

-- vote_article(p_article_id text, p_helpful boolean) → void
-- Toggle: se voto igual → DELETE; se voto diferente → UPDATE; se sem voto → INSERT
-- Recalcula helpful_yes e helpful_no: UPDATE guide_articles SET
--   helpful_yes = (SELECT count WHERE helpful=true),
--   helpful_no  = (SELECT count WHERE helpful=false)
-- grant to authenticated; security definer

-- get_article_vote(p_article_id text) → boolean | null
-- SELECT helpful FROM guide_article_votes WHERE article_id=p_article_id AND user_id=auth.uid()
-- Retorna boolean se votou, null se nunca votou
-- grant to authenticated; security invoker
```

### ISR — estratégia de cache

- `export const revalidate = 3600` no `page.tsx` — artigos/FAQs rehidratados do banco a cada 1 hora
- Artigos individuais (body): carregados via Server Action `getArticleBodyAction` a cada abertura — sem cache de borda
- Views: incremento fire-and-forget + otimismo no client (`views + 1`) para UX imediata

### Eventos PostHog do módulo

| Evento | Quando | Props |
|---|---|---|
| `guide_article_opened` | ao abrir artigo no ArticlePanel | `{ article_id, article_title, category }` |
| `guide_article_helpful` | ao votar em artigo (sim ou não) | `{ article_id, helpful: boolean }` |
| `guide_search_performed` | ao realizar busca (≥ 2 chars, debounce 600ms) | `{ query, results_count }` |
| `guide_support_clicked` | ao clicar em CTA de suporte (WhatsApp/Telegram) | `{ action: 'whatsapp' \| 'telegram' }` |
| `guide_category_viewed` | ao filtrar por categoria | `{ category: string }` |

### Segurança

- Auth check em todas as Server Actions — retorna erro se `!user`
- `voteArticleAction`: rate limit `guide_vote:${user.id}` 10 requests / 60 segundos (Upstash Redis)
- `logGuideSearchAction`: silencia qualquer exceção (try/catch vazio) — operação de telemetria não crítica
- fire-and-forget de `increment_article_views`: usa `void .then({error})` em vez de `.catch()` — `PostgrestFilterBuilder` não implementa `.catch()` nativo
- Artigos: RLS `authenticated` garante que visitantes sem sessão (anon key direta) não acessam

---

## 30. IDENTIDADE VISUAL E ASSETS ⏳ Em progresso

### Marca — SVG path canônico

```svg
<!-- Símbolo "U" em viewBox 0 0 100 100 -->
<path d="M 18 18 V 60 A 32 32 0 0 0 82 60 V 18 H 64 V 60 A 14 14 0 0 1 36 60 V 18 Z" fill="#f4f4f8"/>
<rect x="14" y="42" width="72" height="3.5" rx="2" fill="#7C5CFF"/>  <!-- barra accent -->
```

Variantes da barra accent por contexto:
- `fill="#7C5CFF"` — ícone isolado (fundo escuro transparente)
- `fill="rgba(0,0,0,0.65)"` — ícone com fundo roxo sólido (sidebar, changelog)
- `fill="rgba(0,0,0,0.6)"` — ícone em badge pequeno dentro de div roxa (auth pages)

Cores da marca:
- Accent: `#7C5CFF` (alias: `var(--primary)`)
- Fundo escuro: `#0E0F13`
- Surface escuro: `#15171C`
- Texto claro: `#f4f4f8`

### Arquivos criados

#### `app/` — detecção automática pelo Next.js

| Arquivo | Uso |
|---|---|
| `app/icon.svg` | Favicon detectado automaticamente pelo App Router |
| `app/apple-icon.svg` | Apple Touch Icon 180×180 |

#### `public/` — assets estáticos

| Arquivo | Uso |
|---|---|
| `favicon.svg` | Fallback favicon + referenciado em `app/layout.tsx` e `public/sw.js` |
| `og-image.svg` | Open Graph 1200×630 (fundo escuro + glow + headline) |
| `logo.svg` | Lockup horizontal — fundo escuro |
| `logo-dark.svg` | Lockup horizontal — fundo claro |
| `logo-mark.svg` | Símbolo isolado |
| `logo-mark-purple.svg` | Símbolo em círculo roxo |
| `android-chrome-192x192.svg` | PWA icon 192px |
| `android-chrome-512x512.svg` | PWA icon 512px |
| `site.webmanifest` | PWA manifest (theme `#0E0F13`, display `standalone`) |

### Componentes atualizados

Todos os 7 locais que usavam o path errado (estrela/diamante `M16 6.5 L18 13.5…`) foram corrigidos para o símbolo "U" canônico:

| Arquivo | Contexto |
|---|---|
| `components/dashboard/Sidebar.tsx` | Logo na sidebar (28×28, fundo `var(--primary)`) |
| `app/(auth)/login/page.tsx` | Logo no cabeçalho da auth (18×18, dentro de div roxa) |
| `app/(auth)/register/page.tsx` | Logo no cabeçalho da auth |
| `app/(auth)/forgot-password/page.tsx` | Logo no cabeçalho da auth |
| `app/auth/reset-password/page.tsx` | Logo no cabeçalho da auth |
| `app/changelog/page.tsx` | Logo no header público (24×24, com rounded rect + fundo primary) |
| `app/api/push/notify/route.ts` | `icon` no payload push: `/favicon.ico` → `/favicon.svg` |

### `app/layout.tsx` — metadata completo

```tsx
export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: 'Umbra Bot — Venda no Telegram no automático', template: '%s — Umbra Bot' },
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
           apple: [{ url: '/apple-touch-icon.svg', type: 'image/svg+xml', sizes: '180x180' }],
           shortcut: '/favicon.svg' },
  manifest: '/site.webmanifest',
  openGraph: { type: 'website', locale: 'pt_BR', siteName: 'Umbra Bot',
               images: [{ url: '/og-image.svg', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', images: ['/og-image.svg'] },
}
export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: dark)',  color: '#0E0F13' },
               { media: '(prefers-color-scheme: light)', color: '#F7F8FA' }],
}
```

### Status ⏳ Em progresso

- Atualizações adicionais de ícones ainda serão feitas nesta área
- Possíveis próximos passos: ícones nas páginas públicas de checkout e bio link, favicon.png para compatibilidade máxima

### Landing page (`app/page.tsx`) — Tailwind v4 color fix

**IMPORTANTE:** Dentro do wrapper `.lp` em `app/page.tsx`, **não usar classes Tailwind de cor** como `text-accent`, `bg-accent`, `text-success`, `text-danger`, `text-accent-fg`. Usar sempre **inline `style`** com variáveis CSS diretas.

**Motivo:** O Tailwind v4 indirece `text-accent` → `color: var(--color-accent)` → `var(--accent)`. O `.lp` sobrescreve `--accent` para roxo (`oklch(0.55 0.22 292)`), mas essa cadeia de indireção pode falhar em alguns contextos, tornando elementos invisíveis em modo claro ou escuro.

**Padrão correto dentro de `.lp`:**
```tsx
// ✅ Correto — resolve direto pelo cascade CSS
<span style={{ color: 'var(--accent)' }}>texto</span>
<span style={{ background: 'var(--success)' }}>badge</span>
<Icon style={{ color: 'var(--danger)' }} />

// ❌ Errado — pode falhar dentro de .lp
<span className="text-accent">texto</span>
<span className="bg-success">badge</span>
<Icon className="text-danger" />
```

**Fix aplicado no commit `6e3cdc1`:** 20+ instâncias substituídas — avatares, ícones, SectionEyebrow, comparação Before/After, checkmarks, badges de pricing. O componente `Icon` recebeu prop `style?: React.CSSProperties` para repassar ao Lucide.

**Estrutura de seções da landing page (`app/page.tsx`):**

| Seção | Componente / função | Descrição |
|---|---|---|
| Header | inline | Navbar com logo + links + CTA "Criar conta grátis" |
| Hero | inline | Chat widget animado, dois CTAs, preview de bot |
| SaleTickerSection | inline | Ticker de vendas em tempo real (animação marquee) |
| Highlights | inline | Marquee de 16 highlights em loop (ícones + texto) |
| BeforeAfter | inline | Comparação colunada "Antes do Umbra" vs "Com o Umbra" |
| Features | inline | Grid de 16 funcionalidades em cards |
| HowItWorks | inline | 3 passos animados |
| Integrations | inline | Logos das integrações (Telegram, MP, Meta, etc.) |
| Pricing | inline | R$ 1,00 fixo por transação — tabela "Veja na prática" com 4 exemplos |
| FAQ | inline | 8 perguntas accordion |
| FinalCTA | inline | Bloco de chamada final + formulário |
| Footer | inline | Links legais + redes sociais |

**Componente `UmbraLogo`:** renderiza o SVG canônico do símbolo "U" inline — não usa arquivo externo. Aceita `size`, `className` e `style` props.

### Landing page — Scroll-reveal e barra de progresso de leitura

#### `Reveal` — animação de entrada por scroll (IntersectionObserver)

Componente wrapper reutilizável que anima qualquer elemento quando ele entra na viewport. Pode ser usado diretamente como item de grid/flex sem elemento extra no DOM.

```tsx
function Reveal({
  children,
  delay = 0,
  className,
  style,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.12 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'translateY(0)' : 'translateY(22px)',
        transition: `opacity 0.55s ${delay}ms ease, transform 0.55s ${delay}ms ease`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
```

**Seções com Reveal aplicado e delays usados:**

| Seção | Elementos envolvidos | Delays (ms) |
|---|---|---|
| BeforeAfter | cabeçalho + tabela | 0 / 180 |
| Features | cabeçalho + cada card | 0 / (i%4)×70 |
| HowItWorks | cabeçalho + cada passo + CTA | 0 / i×100 / 300 |
| Integrations | coluna esquerda + coluna direita | 0 / 150 |
| Pricing | cabeçalho + card principal + card comparação | 0 / 150 / 250 |
| FAQ | cabeçalho + lista de perguntas | 0 / 150 |
| FinalCTA | logo+h2+p + botões+nota | 0 / 200 |

**Regras de implementação:**
- `threshold: 0.12` — 12% do elemento visível dispara a entrada
- `obs.disconnect()` após a primeira entrada — anima apenas uma vez
- Deltas de delay em múltiplos de 70–100 ms para cascata suave em grids
- 15 pares `<Reveal>...</Reveal>` no total; todos balanceados

#### `ScrollProgress` — barra de leitura fixa

Elemento independente com `position: fixed` que cresce na largura conforme o usuário rola a página. **Não pode estar dentro do `<header>`** pois `position: relative` no header override `position: fixed`.

```tsx
function ScrollProgress() {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    function onScroll() {
      const el = document.documentElement
      const scrolled = el.scrollTop || document.body.scrollTop
      const total = el.scrollHeight - el.clientHeight
      setPct(total > 0 ? (scrolled / total) * 100 : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div
      aria-hidden
      style={{
        position:      'fixed',
        top:           64,          // exatamente abaixo do header h-16
        left:          0,
        height:        2,
        width:         `${pct}%`,
        background:    'linear-gradient(90deg, var(--accent), color-mix(in oklab, var(--accent) 70%, #a78bfa))',
        transition:    'width 0.08s linear',
        pointerEvents: 'none',
        zIndex:        51,          // acima do header (z-50)
      }}
    />
  )
}
```

**Posição no JSX:** imediatamente após `<Header .../>`, fora do elemento `<header>`:
```tsx
<Header theme={currentTheme} toggleTheme={toggleTheme} mounted={mounted} />
<ScrollProgress />
<main>
```

**Bug crítico evitado:** adicionar `relative` ao `<header>` para que um filho `absolute` funcionasse fez o `position: fixed` do header ser sobrescrito por `relative` → navbar desaparecia ao rolar. Solução: `ScrollProgress` usa `position: fixed` independente, e o header **não** tem classe `relative`.

#### Pricing — modelo real (R$ 1,00 fixo por transação)

A seção de preços foi reescrita com o modelo definitivo. **Não usar `[PREÇO/TAXA — PREENCHER]` ou qualquer placeholder de preço.**

**Estrutura do card principal:**
```
Badges: "Sem mensalidade" | "Sem cartão de crédito" | "pay-as-you-sell"
Preço:  R$ 1,00  — exibido com tipografia display (text-[100px] font-black)
        "fixo por transação / independente do valor da venda"

Tabela "Veja na prática":
  Venda R$ 47,00  → paga R$ 1,00 → fica 97,9%
  Venda R$ 97,00  → paga R$ 1,00 → fica 99,0%
  Venda R$ 197,00 → paga R$ 1,00 → fica 99,5%
  Venda R$ 997,00 → paga R$ 1,00 → fica 99,9%
  "Quanto mais vende, mais você economiza em relação a qualquer percentual."
```

**FAQ atualizado:** a resposta "Vou pagar mensalidade?" agora diz explicitamente "R$ 1,00 fixo por venda, independente do valor que você cobrar" — sem placeholders.

### Landing page — Animação de conversa do Hero (commit `7bf16a3`)

O chat widget do Hero foi convertido de JSX estático para componente React animado com sequência de mensagens em loop.

#### Componentes e constantes adicionadas em `app/page.tsx`

**`TypingIndicator`** — indicador de digitação com 3 pontos saltitantes:
```tsx
function TypingIndicator({ side }: { side: 'left' | 'right' }) {
  const isRight = side === 'right'
  return (
    <div className={`flex ${isRight ? 'justify-end' : 'justify-start'}`}
      style={{ animation: 'chatIn 0.18s ease both' }}>
      <div className="rounded-2xl px-3 py-2.5"
        style={isRight
          ? { background: 'var(--accent)' }
          : { background: 'var(--surface-2)', border: '1px solid var(--border)' }
        }
      >
        <div className="flex gap-1 items-center" style={{ height: 12 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              display: 'block', width: 6, height: 6, borderRadius: '50%',
              background: isRight ? 'var(--accent-fg)' : 'var(--text-muted)',
              animation: `typingDot 1.1s ${i * 0.18}s ease-in-out infinite`,
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

**`CHAT_STEPS`** — 6 passos com lado, duração do typing e pausa pós-mensagem:
```tsx
const CHAT_STEPS: Array<{ side: 'left' | 'right'; typingMs: number; pauseAfter: number }> = [
  { side: 'left',  typingMs: 950,  pauseAfter: 450 },
  { side: 'right', typingMs: 480,  pauseAfter: 380 },
  { side: 'left',  typingMs: 1150, pauseAfter: 380 },
  { side: 'left',  typingMs: 1050, pauseAfter: 380 },
  { side: 'right', typingMs: 680,  pauseAfter: 380 },
  { side: 'left',  typingMs: 920,  pauseAfter: 3800 },  // pausa longa antes do loop
]
```

**`HeroVisual`** convertido para componente stateful:
```tsx
function HeroVisual() {
  const [visibleCount, setVisibleCount] = useState(0)
  const [typing, setTyping] = useState<'left' | 'right' | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    function runStep(stepIndex: number) {
      if (stepIndex >= CHAT_STEPS.length) {
        setVisibleCount(0)
        setTyping(null)
        timer = setTimeout(() => runStep(0), 500)  // 500ms de tela vazia antes de repetir
        return
      }
      const step = CHAT_STEPS[stepIndex]
      setTyping(step.side)
      timer = setTimeout(() => {
        setTyping(null)
        setVisibleCount(stepIndex + 1)
        timer = setTimeout(() => runStep(stepIndex + 1), step.pauseAfter)
      }, step.typingMs)
    }

    timer = setTimeout(() => runStep(0), 600)  // delay inicial de 600ms
    return () => clearTimeout(timer)
  }, [])

  // Mensagens reveladas com: {visibleCount >= N && <div style={chatStyle}>...</div>}
  // Typing indicator: {typing && <TypingIndicator side={typing} />}
  // Container com minHeight: 220 para evitar layout jump ao resetar
}
```

#### Keyframes adicionados em `app/globals.css`

```css
@keyframes typingDot {
  0%, 60%, 100% { transform: translateY(0);    opacity: 0.4; }
  30%            { transform: translateY(-4px); opacity: 1;   }
}

@keyframes chatIn {
  from { opacity: 0; transform: translateY(6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
}
```

#### Timing do loop

| Fase | Duração aproximada |
|---|---|
| Delay inicial | 600 ms |
| 6 mensagens (typing + pausa) | ~6 s |
| Pausa final (pós mensagem 6) | 3.8 s |
| Tela vazia antes de repetir | 500 ms |
| **Ciclo total** | **~11 s** |

#### Regras de implementação

- `runStep(N >= CHAT_STEPS.length)`: a pausa longa (`pauseAfter: 3800`) já foi consumida **antes** de chamar `runStep` com índice fora do range — não usar `setTimeout` extra no handler de overflow.
- `minHeight: 220` no container de mensagens — evita salto de layout ao resetar `visibleCount=0`.
- Dentro de `TypingIndicator`: usar `style={{ background: 'var(--accent)' }}` (não `className="bg-accent"`) — regra `.lp` color fix.

---

## 29. MÓDULO SISTEMA EDUCACIONAL (ACADEMY)

### Arquivos

```
app/dashboard/academy/
  ├── page.tsx          # Server Component — SSR courses + enrollments + progress + certificates em paralelo
  │                     # export const dynamic = 'force-dynamic'
  └── AcademyClient.tsx # Client Component — toda a UI, modais, progresso real, certificados

supabase/migrations/
  ├── 094_courses_rls_and_enrollments.sql  # RLS corrigida em courses + tabela course_enrollments + RPC enroll_in_course
  ├── 095_course_progress.sql              # Tabela course_progress + RPCs upsert_lesson_progress + get_course_progress
  ├── 096_course_certificates.sql          # Tabela course_certificates + RPCs issue_certificate + get_user_certificates
  └── 097_course_modules_lessons.sql       # Tabelas course_modules + course_lessons + RPCs get/import modules
```

### Fluxo de dados

```
AcademyPage (Server Component)
  ├── Auth guard: if (!user) redirect('/login')
  ├── Promise.all com 4 queries em paralelo:
  │     ├── courses: todos os campos, order: featured desc
  │     ├── course_enrollments: course_id, enrolled_at — filtrado por user_id
  │     ├── course_progress: course_id, lesson_id, done, watched_sec, done_at — filtrado por user_id
  │     └── course_certificates: course_id, issued_at, certificate_url — filtrado por user_id
  └── passa como props via as unknown as Type[] (tabelas não no Supabase generated types):
        initialCourses: RawDbCourse[]
        initialEnrollments: RawDbEnrollment[]
        initialProgress: RawDbProgress[]
        initialCertificates: RawDbCertificate[]

AcademyClient (Client Component)
  ├── mapCourses(courses, enrollments, progress, certificates): Course[]
  │     Monta estrutura completa: done por lesson_id, enrolledAt, progressPct, hasCert
  │     modules[].lessons[].done derivado do progressMap (Record<lesson_id, boolean>)
  ├── courses state: mapCourses(props) — nunca usa MOCK_COURSES
  ├── activeCourse state: Course | null — null = grade; Course = detalhe/player
  ├── certsOpen state: boolean — abre CertificatesPanel modal
  ├── certs state: Certificate[] — mapeado de initialCertificates
  │
  ├── ensureEnrolled(courseId): async
  │     supabase.rpc('enroll_in_course', { p_course_id }) — idempotente (ON CONFLICT DO NOTHING)
  │     atualiza enrolledAt no courses state local
  │
  ├── handleProgress(courseId, lessonId, done): async
  │     fire-and-forget: supabase.rpc('upsert_lesson_progress', { p_course_id, p_lesson_id, p_done })
  │     atualiza lesson.done no courses state local (otimista)
  │     recalcula progressPct: doneCount / totalLessons * 100
  │     se done=true: chama issue_certificate(courseId) → se issued: adiciona cert ao certs state
  │
  ├── openCourse(courseId): seta activeCourse + chama ensureEnrolled
  │
  ├── "Meus certificados" badge: certs.length como contador real
  │     abre CertificatesPanel (modal com lista de certificados emitidos)
  │
  ├── Grade de cursos (activeCourse === null):
  │     CourseCard: título, thumbnail, progresso, hasCert (Award icon quando certificado)
  │     FeaturedCard: mostra curso em andamento (tem enrolledAt + progressPct > 0 + progressPct < 100)
  │     Estado vazio quando courses.length === 0 (sem mock)
  │
  ├── CourseDetail (activeCourse !== null):
  │     Módulos accordion + aulas com checkbox
  │     toggleDone(): muda done local + chama handleProgress
  │     markDoneAndNext(): marca done + navega para próxima aula + chama handleProgress
  │     Banner de certificado quando hasCertificate = true
  │     Descrição da aula exibida quando disponível
  │
  ├── CertificatesPanel: modal com lista de Certificate[] (name, issuedAt, courseTitle)
  │     Botão "Baixar" quando certificate_url definido
  │
  └── VideoPlayer: player básico (iframe) para video_url da aula selecionada
```

### Interfaces TypeScript exportadas

```typescript
// De AcademyClient.tsx — usadas pelo page.tsx como tipos dos props
export interface RawDbCourse {
  id: string; title: string; subtitle: string; description: string
  thumbnail: string; duration_h: number; level: string; language: string
  instructor_name: string; instructor_bio: string; instructor_avatar: string
  featured: boolean; status: string
  modules: Array<{          // JSONB — estrutura monolítica (migração pré-097)
    id: string; title: string
    lessons: Array<{
      id: string; title: string; description: string
      duration_min: number; video_url: string
    }>
  }>
}

export interface RawDbEnrollment { course_id: string; enrolled_at: string }
export interface RawDbProgress   { course_id: string; lesson_id: string; done: boolean; watched_sec: number; done_at: string | null }
export interface RawDbCertificate { course_id: string; issued_at: string; certificate_url: string | null }

// Tipos internos do AcademyClient
interface Lesson       { id: string; title: string; description: string; duration_min: number; video_url: string; done: boolean }
interface Module       { id: string; title: string; lessons: Lesson[] }
interface Course       { /* todos os campos de RawDbCourse */ modules: Module[]; progressPct: number; enrolledAt: string | null }
interface FlatLesson   { lesson: Lesson; module: Module; lessonIndex: number; moduleIndex: number }
interface Certificate  { courseId: string; courseTitle: string; issuedAt: string; certificateUrl: string | null }
```

### Tabelas do banco

```sql
-- courses (existente — migração 001)
-- RLS CORRIGIDA na migração 094:
--   ANTES: "courses_open" using (true) — qualquer auth (e anon via admin) lia tudo
--   DEPOIS: "courses_select" for select using (auth.role() = 'authenticated')
-- Dados gerenciados pelo admin via Supabase Dashboard ou SQL

-- course_enrollments (migração 094)
create table public.course_enrollments (
  user_id      uuid        not null references auth.users(id)    on delete cascade,
  course_id    text        not null references public.courses(id) on delete cascade,
  enrolled_at  timestamptz not null default now(),
  primary key (user_id, course_id)
);
-- RLS: enrollments_owner (auth.uid() = user_id)

-- course_progress (migração 095)
create table public.course_progress (
  user_id      uuid        not null references auth.users(id)    on delete cascade,
  course_id    text        not null references public.courses(id) on delete cascade,
  lesson_id    text        not null,   -- ID da aula (vem do JSONB modules para cursos legados)
  done         boolean     not null default false,
  watched_sec  integer     not null default 0,
  done_at      timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, course_id, lesson_id)
);
-- RLS: progress_owner (auth.uid() = user_id)
-- Trigger: course_progress_updated_at (chama set_updated_at())

-- course_certificates (migração 096)
create table public.course_certificates (
  id              text        primary key default gen_random_uuid()::text,
  user_id         uuid        not null references auth.users(id)    on delete cascade,
  course_id       text        not null references public.courses(id) on delete cascade,
  issued_at       timestamptz not null default now(),
  certificate_url text,
  unique (user_id, course_id)
);
-- RLS: certificates_owner (auth.uid() = user_id)

-- course_modules (migração 097 — camada relacional opcional)
create table public.course_modules (
  id         text        primary key default gen_random_uuid()::text,
  course_id  text        not null references public.courses(id) on delete cascade,
  title      text        not null default '',
  order_num  integer     not null default 0,
  created_at timestamptz not null default now()
);
-- RLS: modules_select for select using (auth.role() = 'authenticated')

-- course_lessons (migração 097 — camada relacional opcional)
create table public.course_lessons (
  id           text        primary key default gen_random_uuid()::text,
  module_id    text        not null references public.course_modules(id) on delete cascade,
  course_id    text        not null references public.courses(id)        on delete cascade,
  title        text        not null default '',
  description  text        not null default '',
  duration_min integer     not null default 5,
  video_url    text        not null default '',
  order_num    integer     not null default 0,
  created_at   timestamptz not null default now()
);
-- RLS: lessons_select for select using (auth.role() = 'authenticated')

-- course_progress (migração 097 — campo adicional)
-- lesson_db_id text references public.course_lessons(id) on delete set null
-- Nullable: ID relacional da aula (null para cursos com dados apenas em JSONB)
```

### RPCs do módulo

```sql
-- enroll_in_course(p_course_id text) → void
-- security definer, grant to authenticated
-- INSERT em course_enrollments ON CONFLICT DO NOTHING — idempotente
-- Garante matrícula antes de salvar progresso; chamado ao abrir qualquer curso

-- upsert_lesson_progress(p_course_id, p_lesson_id, p_done, p_watched_sec default 0) → void
-- security definer, grant to authenticated
-- Chama enroll_in_course internamente (garante matrícula)
-- ON CONFLICT: done = excluded.done
--              watched_sec = GREATEST(atual, novo) — nunca retrocede
--              done_at: seta apenas ao marcar como done pela primeira vez; limpa ao desmarcar

-- get_course_progress(p_course_id text) → table(lesson_id, done, watched_sec, done_at)
-- security definer, grant to authenticated
-- SELECT de course_progress WHERE user_id = auth.uid() AND course_id = p_course_id
-- Usado para carregar progresso de um curso específico (lazy, sob demanda)

-- issue_certificate(p_course_id text) → json
-- security definer, grant to authenticated
-- Conta aulas totais via JSONB: SUM(jsonb_array_length(m -> 'lessons')) FROM courses.modules
-- Conta aulas done em course_progress WHERE user_id=auth.uid() AND course_id AND done=true
-- Se done_count >= total_count > 0 AND sem certificado: INSERT em course_certificates
-- Retorna: { issued: bool, certificate_id: text|null, already_existed: bool }
-- Também retorna { progress, total } quando não elegível (debug)

-- get_user_certificates() → table(certificate_id, course_id, course_title, course_subtitle, issued_at, certificate_url)
-- security definer, grant to authenticated
-- JOIN course_certificates + courses para o usuário logado, order by issued_at desc

-- get_course_with_modules(p_course_id text) → json
-- security definer, grant to authenticated
-- Tenta buscar dados das tabelas relacionais course_modules + course_lessons
-- Se course_modules está vazio para o curso: faz fallback para JSONB em courses.modules
-- Retorna: { source: 'relational'|'jsonb', modules: [...] }

-- import_course_modules_from_jsonb(p_course_id text) → json
-- security definer, SEM grant to authenticated — apenas service role (admin)
-- Lê JSONB de courses.modules e popula course_modules + course_lessons relacionais
-- Retorna: { modules_imported: N, lessons_imported: N }
-- Usar via Supabase SQL Editor (admin) para migrar cursos existentes para a camada relacional
```

### Lógica de progressPct

```typescript
function calcProgress(course: Course): number {
  const flat = course.modules.flatMap(m => m.lessons)
  if (flat.length === 0) return 0
  return Math.round(flat.filter(l => l.done).length / flat.length * 100)
}
// Atualizado no state local após cada handleProgress
// Atualizado pelo mapCourses na montagem (dados do SSR)
```

### Emissão de certificado — fluxo completo

```
1. Usuário marca última aula como done (checkbox ou "Próxima aula")
2. AcademyClient: handleProgress(courseId, lessonId, true) →
   a. Atualiza lesson.done=true no state local (otimista)
   b. fire-and-forget: upsert_lesson_progress (grava no banco)
   c. supabase.rpc('issue_certificate', { p_course_id })
3. Se result.issued === true: certs state recebe novo Certificate → badge "Meus certificados" incrementa
4. CourseDetail: hasCertificate=true → banner verde "🎓 Certificado disponível!" exibido

Verificação anti-fraude (no SQL):
- issue_certificate conta aulas done DIRETAMENTE da tabela course_progress (não do state React)
- Só emite se v_total_lessons > 0 AND v_done_lessons >= v_total_lessons AND NOT v_exists
- Idempotente: segundo clique retorna already_existed=true sem duplicar
```

### Abordagem JSONB vs Relacional — decisão de arquitetura

| Camada | Quando usar | Status |
|---|---|---|
| JSONB (`courses.modules`) | Cursos legados ou inseridos manualmente via Dashboard | ✅ Padrão atual |
| Relacional (`course_modules` + `course_lessons`) | Cursos novos gerenciados por admin panel futuro | ✅ Tabelas criadas (populáveis via RPC admin) |
| RPC `get_course_with_modules` | Leitura unificada (tenta relacional → fallback JSONB) | ✅ Implementada |

O `AcademyClient` usa `courses.modules` (JSONB) diretamente (vem no SSR com `select('*')`). A camada relacional é usada quando o admin migrar os dados via `import_course_modules_from_jsonb`.

### Segurança

- Auth check em `page.tsx`: `if (!user) redirect('/login')`
- Todas as RPCs: `security definer` + `auth.uid()` para IDOR-safe — usuário só acessa/modifica dados próprios
- Nenhum dado de progresso ou certificado de outros usuários é exposto (RLS `auth.uid() = user_id`)
- `import_course_modules_from_jsonb`: sem `grant to authenticated` — exclusivo para service role (admin)
- `courses`: RLS corrigida de `open` (qualquer auth) para `authenticated SELECT only` — sem modificação pelo usuário

### Seeding de cursos

A tabela `courses` é gerenciada pelo admin (sem painel de CRUD no dashboard do usuário). Para adicionar cursos:

```sql
-- Via Supabase SQL Editor ou Dashboard:
INSERT INTO public.courses (id, title, subtitle, description, thumbnail, duration_h, level, language,
  instructor_name, instructor_bio, instructor_avatar, featured, status, modules)
VALUES (
  'curso-exemplo',
  'Título do Curso',
  'Subtítulo curto',
  'Descrição completa...',
  'https://url-da-thumbnail.com/img.jpg',
  4, 'Iniciante', 'pt-BR',
  'Nome do Instrutor', 'Bio do instrutor', 'https://avatar-url.com/img.jpg',
  true, 'published',
  '[
    {
      "id": "modulo-1", "title": "Módulo 1 — Introdução",
      "lessons": [
        { "id": "aula-1-1", "title": "Aula 1", "description": "Descrição", "duration_min": 10, "video_url": "https://..." },
        { "id": "aula-1-2", "title": "Aula 2", "description": "Descrição", "duration_min": 15, "video_url": "https://..." }
      ]
    }
  ]'::jsonb
);
```

### Estado do módulo

| Funcionalidade | Status |
|---|---|
| SSR courses + enrollments + progress + certs (4 queries paralelas) | ✅ Implementado |
| RLS corrigida em `courses` (SELECT-only autenticados) | ✅ Implementado (migração 094) |
| `course_enrollments` — matrícula automática ao abrir curso | ✅ Implementado |
| `course_progress` — progresso real por aula (done + watched_sec) | ✅ Implementado |
| `course_certificates` — emissão automática ao 100% | ✅ Implementado |
| Camada relacional `course_modules` + `course_lessons` (opcional) | ✅ Tabelas e RPCs criadas |
| RPC `get_course_with_modules` (relacional com fallback JSONB) | ✅ Implementada |
| RPC `import_course_modules_from_jsonb` (utilitário admin) | ✅ Implementada |
| Progresso persistido otimisticamente (estado local primeiro) | ✅ Implementado |
| Certificado emitido ao completar 100% (fire-and-forget RPC) | ✅ Implementado |
| Badge "Meus certificados" com contagem real | ✅ Implementado |
| Empty state quando sem cursos cadastrados (sem mock) | ✅ Implementado |
| Seeding de cursos via migração 098 (seed "Dominando o Umbra Bot", 4 módulos, 13 aulas, `ON CONFLICT DO NOTHING`) | ✅ Implementado |
| Player de vídeo real: YouTube iframe / Vimeo iframe / Bunny.net iframe / direct `<video>` tag / placeholder "Vídeo em breve" | ✅ Implementado |
| VideoPlayer: `getVideoKind(url)` detecta tipo → extrai ID YouTube/Vimeo → URL de embed correta | ✅ Implementado |
| Busca de cursos: input de texto filtra por título/instrutor — `course_searched` PostHog via useEffect | ✅ Implementado |
| Filtro por nível (Todos + dinâmico dos dados) — `course_filtered` PostHog ao clicar | ✅ Implementado |
| 5 PostHog events: course_opened / lesson_completed / certificate_issued / course_searched / course_filtered | ✅ Implementado |
| activity_event `courseCompleted` inserido ao emitir certificado (migração 098 adicionou ao CHECK constraint) | ✅ Implementado |
| CHECK constraint `activity_events_type_check` inclui `courseCompleted` (migração 098 — DROP + ADD) | ✅ Implementado |
| Conteúdo gerenciado pelo admin: cursos criados no Supabase Dashboard; vídeos no YouTube → video_url no JSONB | ✅ Documentado |
| Supabase Realtime para progresso (múltiplas abas) | ⏳ Não iniciado |
