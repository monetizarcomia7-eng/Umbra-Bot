# INTEGRATIONS.md — Umbra Bot

> **Leia este arquivo no início de cada sessão de desenvolvimento.**
> Ele documenta todas as integrações externas do Umbra Bot com base no código real.
> Nada aqui é inventado: cada afirmação tem origem em um arquivo do repositório.

---

## 1. VISÃO GERAL

| Integração | Categoria | Status | Onde no código |
|---|---|---|---|
| Vercel | Hospedagem / Deploy | ✅ Em uso | `vercel.json`, `next.config.ts` |
| Supabase Postgres | Banco de dados | ✅ Em uso | `lib/supabase/`, todas as pages/actions |
| Supabase Auth | Autenticação | ✅ Em uso | `app/(auth)/`, `middleware.ts`, `app/auth/callback/` |
| Supabase Storage | Armazenamento de arquivos | ✅ Em uso | bucket `avatars` (perfis), bucket `checkout-images`, bucket `bio-avatars` |
| Supabase Realtime | Eventos em tempo real | ✅ Em uso | BotsClient, BroadcastsClient, AlertsClient, etc. |
| Telegram Bot API | Bots / Mensageria | ✅ Em uso | `lib/telegram.ts`, `app/api/telegram/`, `app/actions/bots.ts` |
| Mercado Pago (PIX) | Gateway de pagamento | ✅ Em uso | `app/api/payments/pix/`, `app/api/checkout/pay/` |
| Mercado Pago (Webhook) | Confirmação de pagamento | ✅ Em uso | `app/api/payments/mercadopago-webhook/` |
| Mercado Pago (OAuth) | Autenticação per-tenant | ✅ Em uso | `app/api/payments/mercadopago-oauth/` |
| Upstash Redis | Rate limiting distribuído | ✅ Em uso (com fallback) | `lib/rate-limit.ts` |
| web-push (VAPID) | Notificações push browser | ✅ Em uso | `app/api/push/`, `public/sw.js` |
| Sentry | Monitoramento de erros | ✅ Configurado | `sentry.*.config.ts`, `instrumentation.ts` |
| PostHog | Product analytics | ✅ Em uso | `hooks/use-analytics.ts`, `lib/analytics-server.ts` |
| Vercel Analytics | Analytics de tráfego | ✅ Ativo | `app/layout.tsx` |
| Vercel Speed Insights | Performance | ✅ Ativo | `app/layout.tsx` |
| Meta CAPI | Conversions API (server-side) | ✅ Em uso | `lib/capi.ts` |
| TikTok Events API | Server-side pixel | ✅ Em uso | `lib/capi.ts` |
| Google Measurement Protocol | Server-side GA4 | ✅ Em uso | `lib/capi.ts` |
| Google reCAPTCHA v2 | Anti-bot / formulários | ✅ Em uso | `lib/recaptcha.ts`, `components/ReCaptchaWidget.tsx` |
| Telegram MTProto (GramJS) | Upload de foto de bot | ✅ Dependência instalada | `package.json` — `telegram@^2.26.22` |
| PushinPay | Gateway de pagamento | ❌ Não iniciado | Apenas no `GATEWAY_CREDENTIAL` do Onboarding |
| Pagar.me | Gateway de pagamento | ❌ Não iniciado | Apenas no `GATEWAY_CREDENTIAL` do Onboarding |
| Stripe | Gateway de pagamento | ❌ Não iniciado | Apenas no `GATEWAY_CREDENTIAL` do Onboarding |
| cron-job.org | Cron externo | ✅ Em uso (externo) | Configura process-remarketing e process-broadcasts |

---

## 2. INFRAESTRUTURA E DEPLOY

### Hospedagem — Vercel

- **Framework detectado:** Next.js 15 (App Router)
- **Build command:** `next build` (padrão)
- **Configuração:** `vercel.json` + `next.config.ts`
- **Sentry integrado ao build:** `withSentryConfig` em `next.config.ts` com `automaticVercelMonitors: true`
- **Source maps Sentry:** desabilitados (`sourcemaps: { disable: true }`)
- **Images remotas permitidas:** `picsum.photos` e `*.supabase.co/storage/v1/object/public/**`
- **Pacotes transpilados:** `motion` (Framer Motion v12)

### Cron Jobs — vercel.json

> **Atenção:** O plano Hobby da Vercel executa apenas os **2 primeiros** crons da lista.
> Os dois últimos (check-bots, cleanup-alerts) requerem plano Pro ou são executados externamente.

| Rota | Schedule (UTC) | Função | Autenticação |
|---|---|---|---|
| `/api/cron/process-withdrawals` | `0 6 * * *` (06:00 diário) | Marca saques pendentes há +24h como `completed` | `Authorization: Bearer CRON_SECRET` |
| `/api/cron/cleanup-activity` | `0 2 * * *` (02:00 diário) | Deleta `activity_events` com +90 dias | `Authorization: Bearer CRON_SECRET` |
| `/api/cron/check-bots` | `0 8 * * *` (08:00 diário) | Verifica conectividade dos bots via Telegram `getWebhookInfo` | `Authorization: Bearer CRON_SECRET` |
| `/api/cron/cleanup-alerts` | `0 4 * * *` (04:00 diário) | Deleta alertas resolvidos com +30 dias | `Authorization: Bearer CRON_SECRET` |

> **Nota:** O CLAUDE.md descreve `check-bots` como executando a cada 30 min (`*/30 * * * *`), mas o `vercel.json` registra `0 8 * * *` (uma vez ao dia). A frequência real depende do valor em `vercel.json`.

### Cron Jobs — cron-job.org (externos)

Configurados manualmente no cron-job.org, não estão no `vercel.json`:

| Rota | Frequência | Função |
|---|---|---|
| `/api/cron/process-remarketing` | 1x/hora | Enfileira contatos e envia mensagens de remarketing |
| `/api/cron/process-broadcasts` | A cada 15 min | Processa broadcasts agendados (1 por rodada) |

Ambos usam `Authorization: Bearer CRON_SECRET`.

---

## 3. BANCO DE DADOS E AUTENTICAÇÃO

### Supabase Postgres

- **Instância:** definida por `NEXT_PUBLIC_SUPABASE_URL`
- **Clientes no código:**
  - `lib/supabase/server.ts` — `createClient()` com anon key + cookies (Server Components, API Routes autenticadas)
  - `lib/supabase/client.ts` — `createClient()` browser (Client Components)
  - `lib/supabase/admin.ts` — `createAdminClient()` com service role key (webhooks externos, cron jobs — bypassa RLS)
- **Total de arquivos de migração:** 97 arquivos `.sql` (numerados 000–097 + timestamps)
- **Migrações auxiliares (não executáveis diretamente):** `_combined.sql`, `_pending_analytics_037_to_041.sql`, `_pending_run_now.sql`

### Supabase Auth

| Provider | Status | Arquivo |
|---|---|---|
| E-mail / Senha | ✅ Em uso | `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx` |
| Google OAuth | ✅ Em uso | Configurado via Supabase Dashboard; callback em `app/auth/callback/route.ts` |
| Recuperação de senha | ✅ Em uso | `app/(auth)/forgot-password/page.tsx` + `app/auth/reset-password/page.tsx` |

**Callback OAuth:** `GET /auth/callback` — troca o code por sessão, detecta novo usuário (`created_at === last_sign_in_at`) e dispara evento PostHog `user_registered`.

**Redirect após login:** `middleware.ts` redireciona `/login` → `/dashboard` quando sessão ativa.

### Supabase Storage

| Bucket | Uso | RLS |
|---|---|---|
| `avatars` | Foto de perfil do usuário (upload em `/dashboard/profile`) | Por usuário (pasta `{user_id}/`) |
| `checkout-images` | Imagem do produto no editor de checkout | Por usuário (pasta `{user_id}/`) |
| `bio-avatars` | Avatar do Bio Link (upload no editor `/dashboard/biolink`) | Por usuário (pasta `{user_id}/`) |
| `push_subscriptions` | Armazenado na tabela, não no Storage | N/A |

### RLS (Row Level Security)

- **Estado geral:** habilitado em todas as tabelas com dados de usuário
- **Política padrão:** `auth.uid() = user_id` para leitura e escrita
- **Exceção documentada:** tabelas acessadas por `createAdminClient()` (service role bypassa RLS) — usado em webhook Telegram, cron check-bots, cron process-remarketing, cron process-broadcasts, checkout pay (busca dados do dono do checkout), route `/r/[slug]`
- **Funções com `security definer`:** `track_checkout_event`, `track_affiliate_click`, `submit_affiliate_application`, `get_public_affiliate_program`, `credit_affiliate_sale`, `record_redirect_click`, `redirect_analytics`, `validate_and_apply_coupon`, `checkout_tx_status`, `record_biolink_visit`, `record_biolink_link_click`, `enroll_in_course`, `upsert_lesson_progress`, `get_course_progress`, `issue_certificate`, `get_user_certificates`, `get_course_with_modules`

---

## 4. SERVIÇOS EXTERNOS DE TERCEIROS

### Telegram Bot API

**Para que serve:** Envio de mensagens, registro de webhook, consulta de webhookInfo, edição de perfil do bot.

**Onde é chamado:**
- `lib/telegram.ts` — `sendTelegramMessage()` — helper centralizado
- `app/api/telegram/webhook/route.ts` — recebe updates (sendMessage, sendPhoto, InlineKeyboard, answerCallbackQuery)
- `app/api/telegram/register/route.ts` — registra webhook via `setWebhook`
- `app/api/cron/check-bots/route.ts` — `getWebhookInfo` para verificar conectividade
- `app/actions/bots.ts` — `getMe`, `setWebhook`, `getMyDescription`, `getMyShortDescription`, `getMyCommands`, `setMyName`, `setMyDescription`, `setMyShortDescription`, `setMyCommands`, `getUserProfilePhotos`, `getFile`, `setMyPhoto`
- `app/api/broadcasts/send/route.ts` e `app/api/cron/process-broadcasts/route.ts` — `sendMessage` em lote (rate limit 35ms/msg)

**URL base:** `https://api.telegram.org/bot{token}/{method}`

**Variáveis de ambiente:** token de cada bot armazenado criptografado no banco (`bots.token`); nunca exposto em env var por bot.

**Segurança:** webhook protegido por `X-Telegram-Bot-Api-Secret-Token` header (comparado com `bot.webhook_secret` do banco).

**Status:** ✅ Em uso completo

---

### Mercado Pago

**Para que serve:** Criação de cobranças PIX, confirmação de pagamentos via webhook, autenticação OAuth por usuário.

#### Criação de PIX — `POST /api/payments/pix`

- Chamado por: operadores autenticados (fluxo manual via dashboard)
- Usa `getMercadoPagoToken()` de `lib/gateway.ts`:
  1. Busca credencial do próprio usuário na tabela `gateways` (per-tenant)
  2. Fallback: `MERCADOPAGO_ACCESS_TOKEN` (env var global)
- API chamada: `POST https://api.mercadopago.com/v1/payments`
- Taxa aplicada (provisória): 3,99% + R$0,40 (campo `fee` na transaction)

#### Criação de PIX — `POST /api/checkout/pay`

- Chamado por: compradores anônimos via página `/c/[slug]`
- Busca token do **dono do checkout** via `createAdminClient()` na tabela `gateways`
- Fallback: `MERCADOPAGO_ACCESS_TOKEN`
- Taxa aplicada: 0,99% flat (campo `fee` na transaction)
- Suporta `coupon_code` (desconto) e `order_bump` (produto adicional)

#### Webhook — `POST /api/payments/mercadopago-webhook`

- Recebido do Mercado Pago; verifica assinatura HMAC-SHA256
- Busca pagamento em `https://api.mercadopago.com/v1/payments/{id}` com `MERCADOPAGO_ACCESS_TOKEN` (global)
- **Atenção:** usa `createClient()` (não admin) para buscar a transação — requer que RLS permita acesso por `gateway_payment_id` ou que a sessão exista
- Ao aprovar: atualiza status, insere `checkout_event` 'paid', credita comissão de afiliado, dispara CAPI, insere `activity_event`, insere alerta, envia mensagem Telegram ao comprador

#### OAuth — `GET /api/payments/mercadopago-oauth` e `/callback`

- Inicia fluxo authorization_code
- Proteção CSRF via cookie `mp_oauth_state` (httpOnly, sameSite=lax, maxAge=600s)
- Token OAuth salvo criptografado com `encryptToken()`, `token_expires_at = now() + 180 dias`
- Upsert `onConflict(user_id, provider)` — nunca duplica

**Variáveis de ambiente:**

| Variável | Função |
|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | Token global de fallback (obrigatório em dev/demo) |
| `MERCADOPAGO_WEBHOOK_SECRET` | Segredo HMAC para verificar webhooks (obrigatório em prod) |
| `MERCADOPAGO_CLIENT_ID` | Client ID do app OAuth (opcional — habilita botão OAuth) |
| `MERCADOPAGO_CLIENT_SECRET` | Client Secret do app OAuth (obrigatório se CLIENT_ID definido) |

**Status:** ✅ Em uso — PIX real, webhook real, OAuth real

---

### Upstash Redis

**Para que serve:** Rate limiting distribuído em ambientes serverless multi-instância.

**Onde é chamado:** `lib/rate-limit.ts` — importado por todas as rotas de API que aplicam rate limit.

**Algoritmo:** Script Lua atômico (`INCR` + `EXPIRE` + `TTL`) em 1 round-trip — previne race condition.

**Fallback:** quando `UPSTASH_REDIS_REST_URL` não está configurado, usa `Map` em memória (inadequado para produção multi-instância).

**Variáveis de ambiente:**

| Variável | Função |
|---|---|
| `UPSTASH_REDIS_REST_URL` | URL REST do banco Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Token de autenticação Upstash |

**Status:** ✅ Em uso com fallback em memória para dev

---

### web-push (VAPID)

**Para que serve:** Notificações push para navegadores (mesmo com o app fechado).

**Onde é chamado:**
- `app/api/push/subscribe/route.ts` — salva `PushSubscription` na tabela `push_subscriptions`
- `app/api/push/notify/route.ts` — envia notificação usando `webpush.sendNotification()`
- `public/sw.js` — Service Worker que exibe a notificação e trata cliques

**Rate limit:** 30 notificações/min por usuário.

**Variáveis de ambiente:**

| Variável | Função |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Chave pública VAPID (exposta ao browser) |
| `VAPID_PRIVATE_KEY` | Chave privada VAPID (server-only) |
| `VAPID_EMAIL` | Email de contato para o servidor push |

**Gerar chaves:** `npx web-push generate-vapid-keys`

**Status:** ✅ Em uso

---

### Google reCAPTCHA v2

**Para que serve:** Proteção anti-bot em formulários públicos.

**Páginas protegidas:**
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `app/(auth)/forgot-password/page.tsx`
- `app/afiliar/[userId]/ApplicationForm.tsx`
- `app/c/[slug]/CheckoutPageClient.tsx`

**Fluxo:** Widget renderiza no browser → token enviado ao server → `verifyRecaptchaToken()` em `lib/recaptcha.ts` valida via `https://www.google.com/recaptcha/api/siteverify`.

**Server Action:** `app/actions/recaptcha.ts` — `verifyRecaptchaAction(token)` — para páginas de auth onde Supabase é chamado client-side.

**Comportamento sem configuração:** retorna `true` (dev-safe — não bloqueia).

**Variáveis de ambiente:**

| Variável | Função |
|---|---|
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Chave pública (exposta ao browser — widget) |
| `RECAPTCHA_SECRET_KEY` | Chave secreta (server-only — verificação) |

**Criar chaves:** https://www.google.com/recaptcha/admin/create → tipo **Challenge (v2)**

**Status:** ✅ Em uso

---

### Telegram MTProto / GramJS

**Para que serve:** Upload de foto de perfil do bot via API MTProto (Bot API não suporta `setMyPhoto` para bots, apenas MTProto).

**Dependência:** `telegram@^2.26.22` no `package.json`.

**Onde é chamado:** `app/actions/bots.ts` — `setBotPhotoAction(botId, photo: File)`.

**Variáveis de ambiente:**

| Variável | Função |
|---|---|
| `TELEGRAM_API_ID` | ID do app MTProto (my.telegram.org) |
| `TELEGRAM_API_HASH` | Hash do app MTProto (my.telegram.org) |

**Status:** ✅ Dependência instalada e Server Action implementada

---

## 5. OBSERVABILIDADE E ANALYTICS

### Sentry

**Configuração:** três arquivos de config separados:

| Arquivo | Ambiente | Configuração relevante |
|---|---|---|
| `sentry.client.config.ts` | Browser | `replaysSessionSampleRate: 0.05`, `replaysOnErrorSampleRate: 1.0`, `maskAllText: true` |
| `sentry.server.config.ts` | Node.js | `tracePropagationTargets: ['/api/payments/pix', '/api/telegram/webhook', '/api/broadcasts/send']` |
| `sentry.edge.config.ts` | Edge Runtime | Configuração mínima |

- **Integrado ao build** via `withSentryConfig` em `next.config.ts` com `automaticVercelMonitors: true`
- **Habilitado apenas em produção** (`enabled: process.env.NODE_ENV === 'production'`)
- **Carregado via** `instrumentation.ts` (hook Next.js)
- **`captureException` usado em:** MP webhook, PIX route, broadcasts, remarketing, checkout pay, etc.
- **`captureCheckIn` usado em:** cron process-broadcasts

**Variáveis de ambiente:**

| Variável | Função |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | DSN do projeto (exposto ao browser) |
| `SENTRY_ORG` | Organização Sentry (build) |
| `SENTRY_PROJECT` | Projeto Sentry (build) |
| `SENTRY_AUTH_TOKEN` | Token para upload de source maps (opcional) |

---

### PostHog

**Inicialização:** `providers/PostHogProvider.tsx` — `posthog.init()` com `capture_pageview: false` (pageview manual via `PageviewTracker`).

**Eventos client-side** (definidos em `hooks/use-analytics.ts`):

| Evento | Onde disparado |
|---|---|
| `bot_connected` | OnboardingWizard, após registrar webhook |
| `flow_created` | FlowsClient |
| `flow_published` | FlowsClient |
| `flow_deleted` | FlowsClient |
| `gateway_connected` | GatewaysClient (manual + OAuth callback) |
| `gateway_disconnected` | GatewaysClient |
| `gateway_configured` | GatewaysClient (salvar conta bancária) |
| `gateway_connection_tested` | GatewaysClient |
| `broadcast_sent` | BroadcastsClient |
| `onboarding_completed` | OnboardingWizard |
| `onboarding_step_completed` | OnboardingWizard (cada passo) |
| `pix_payment_created` | `/api/payments/pix` (server-side via `captureEvent`) |
| `avatar_updated` / `profile_avatar_updated` | `dashboard/profile/page.tsx` |
| `csv_exported` | FinanceDashboard, CustomersClient, ActivityClient, AnalyticsClient, RemarketingClient, RedirectsClient |
| `plan_upgraded` | (disponível no EventMap — não disparado ainda) |
| `user_registered` | `app/auth/callback/route.ts` (server-side) |
| `analytics_filter_changed` | AnalyticsClient |
| `analytics_cohort_error` | `analytics/page.tsx` (server-side) |
| `activity_filter_changed` | ActivityClient |
| `activity_live_toggled` | ActivityClient |
| `withdrawal_requested` | WithdrawModal |
| `bank_account_added` | WithdrawModal |
| `bank_account_deleted` | WithdrawModal |
| `finance_tab_changed` | FinanceDashboard |
| `finance_period_changed` | FinanceDashboard |
| `customer_filter_changed` | CustomersClient |
| `customer_profile_opened` | CustomersClient |
| `customer_tag_added` | CustomersClient |
| `customer_added` | CustomersClient |
| `customer_imported` | CustomersClient |
| `affiliate_added` | AffiliatesClient |
| `affiliate_status_changed` | AffiliatesClient |
| `affiliate_paid` | AffiliatesClient |
| `affiliate_config_saved` | AffiliatesClient |
| `affiliate_link_copied` | AffiliatesClient |
| `alert_resolved` | AlertsClient |
| `alert_reopened` | AlertsClient |
| `all_alerts_resolved` | AlertsClient |
| `alert_action_clicked` | AlertsClient |
| `redirect_created` | RedirectsClient |
| `redirect_updated` | RedirectsClient |
| `redirect_status_changed` | RedirectsClient |
| `redirect_deleted` | RedirectsClient |
| `campaign_created` | RemarketingClient |
| `campaign_saved` | RemarketingClient |
| `campaign_activated` | RemarketingClient |
| `campaign_paused` | RemarketingClient |
| `campaign_deleted` | RemarketingClient |
| `pixel_configured` | TrackingClient |
| `pixel_verified` | TrackingClient |
| `pixel_test_sent` | TrackingClient |
| `utm_link_copied` | TrackingClient |
| `checkout_created` | CheckoutClient |
| `checkout_published` | CheckoutClient |
| `checkout_deleted` | CheckoutClient |
| `checkout_duplicated` | CheckoutClient |
| `checkout_link_copied` | CheckoutClient (botão Copiar link no menu do card) |
| `checkout_pay_started` | CheckoutPageClient — ao clicar em Pagar |
| `checkout_pay_success` | CheckoutPageClient — pagamento confirmado via polling |
| `checkout_pay_failed` | CheckoutPageClient — erro de servidor ou rede |
| `checkout_pay_timeout` | CheckoutPageClient — (EventMap — não disparado ainda) |
| `coupon_applied` | CheckoutPageClient — ao aplicar cupom válido |
| `coupon_rejected` | CheckoutPageClient — cupom inválido/expirado |
| `order_bump_selected` | CheckoutPageClient — ao marcar order bump |
| `upsell_accepted` | CheckoutPageClient — ao clicar no CTA do upsell |
| `upsell_rejected` | CheckoutPageClient — ao clicar em "Não, obrigado" |
| `two_step_phase_advanced` | CheckoutPageClient — ao avançar de dados pessoais para pagamento |
| `guide_article_opened` | GuideClient — ao abrir artigo (article_id, article_title, category) |
| `guide_article_helpful` | GuideClient — ao votar em artigo (article_id, helpful: boolean) |
| `guide_search_performed` | GuideClient — ao realizar busca ≥ 2 chars (query, results_count) |
| `guide_support_clicked` | GuideClient — ao clicar em CTA de suporte (action: 'whatsapp'\|'telegram') |
| `guide_category_viewed` | GuideClient — ao filtrar por categoria (category: string) |
| `tool_opened` | (EventMap — módulo Ferramentas, não iniciado) |
| `test_message_sent` | (EventMap — módulo Ferramentas, não iniciado) |
| `token_validated` | (EventMap — não iniciado) |
| `qr_generated` / `qr_downloaded` | (EventMap — não iniciado) |
| `flow_previewed` / `flow_sim_completed` | (EventMap — não iniciado) |
| `config_exported` / `config_imported` | (EventMap — não iniciado) |
| `diagnostics_run` / `cache_cleared` | (EventMap — não iniciado) |
| `deep_link_generated` | (EventMap — não iniciado) |
| `lgpd_check_run` | (EventMap — não iniciado) |

**Eventos server-side** via `lib/analytics-server.ts` (`captureEvent`):
- `pix_payment_created` — `/api/payments/pix`
- `user_registered` — `app/auth/callback/`
- `analytics_cohort_error` — `app/dashboard/analytics/page.tsx`

**Variáveis de ambiente:**

| Variável | Função |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | Chave do projeto PostHog |
| `NEXT_PUBLIC_POSTHOG_HOST` | Host da API (`https://us.i.posthog.com`) |

---

### Vercel Analytics + Speed Insights

- **Vercel Analytics:** `<Analytics />` em `app/layout.tsx` via `@vercel/analytics/react`
- **Speed Insights:** `<SpeedInsights />` em `app/layout.tsx` via `@vercel/speed-insights/next`
- **Sem configuração adicional** — ativados automaticamente no projeto Vercel

---

## 6. ROTAS DE API INTERNAS

### Telegram

| Método | Caminho | Função | Autenticação | Rate limit |
|---|---|---|---|---|
| `POST` | `/api/telegram/webhook?bot_id=<uuid>` | Recebe updates do Telegram (mensagens, callback_query, /start) | `X-Telegram-Bot-Api-Secret-Token` (por bot) | Nenhum (Telegram controla) |
| `GET` | `/api/telegram/register` | Registra webhook no Telegram via `setWebhook` | Supabase session | Nenhum |

---

### Payments

| Método | Caminho | Função | Autenticação | Rate limit |
|---|---|---|---|---|
| `POST` | `/api/payments/pix` | Cria cobrança PIX (dashboard — operador autenticado) | Supabase session | 10 req/hora por user_id |
| `POST` | `/api/payments/mercadopago-webhook` | Recebe confirmação de pagamento do MP | HMAC-SHA256 (`MERCADOPAGO_WEBHOOK_SECRET`) | Nenhum |
| `GET` | `/api/payments/mercadopago-oauth` | Inicia fluxo OAuth MP → redireciona para MP | Supabase session | Nenhum |
| `GET` | `/api/payments/mercadopago-oauth/callback` | Callback OAuth MP — troca code por token | Cookie CSRF `mp_oauth_state` | Nenhum |

---

### Withdrawals e Bank Accounts

| Método | Caminho | Função | Autenticação | Rate limit |
|---|---|---|---|---|
| `POST` | `/api/withdrawals` | Solicita saque | Supabase session | 3 req/dia por user_id |
| `GET` | `/api/bank-accounts` | Lista contas bancárias | Supabase session | Nenhum |
| `POST` | `/api/bank-accounts` | Cria conta bancária | Supabase session | Nenhum |
| `DELETE` | `/api/bank-accounts/[id]` | Remove conta bancária | Supabase session | Nenhum |

---

### Finance

| Método | Caminho | Função | Autenticação | Rate limit |
|---|---|---|---|---|
| `GET` | `/api/finance/balance` | Retorna saldo via RPC `finance_summary` | Supabase session | Nenhum |
| `GET` | `/api/finance/transactions` | Paginação de transações (`?offset=N`) | Supabase session | Nenhum |

---

### Broadcasts

| Método | Caminho | Função | Autenticação | Rate limit |
|---|---|---|---|---|
| `POST` | `/api/broadcasts/send` | Envia broadcast imediato (rate 35ms/msg) | Supabase session | 5 req/hora por user_id |

---

### Push

| Método | Caminho | Função | Autenticação | Rate limit |
|---|---|---|---|---|
| `POST` | `/api/push/subscribe` | Registra subscription WebPush | Supabase session | Nenhum |
| `DELETE` | `/api/push/subscribe` | Remove subscription | Supabase session | Nenhum |
| `POST` | `/api/push/notify` | Envia notificação push | Supabase session | 30 req/min por user_id |

---

### Checkout (Públicas)

| Método | Caminho | Função | Autenticação | Rate limit |
|---|---|---|---|---|
| `POST` | `/api/checkout/pay` | Cria PIX via checkout público (comprador anônimo) | Nenhuma | 20 req/min por IP |
| `GET` | `/api/checkout/validate-coupon` | Preview de desconto sem incrementar uso | Nenhuma | 30 req/min por IP |
| `GET` | `/api/checkout/status` | Polling de status PIX (retorna apenas `{ status }`) | Nenhuma | 30 req/min por IP |
| `POST` | `/api/checkout/track` | Registra evento de funil (visited/cart_added) | Nenhuma (CORS `*`) | 60 req/min por IP |

**Página pública `/c/[slug]` (Server Component):**
- Usa `createAdminClient()` — sem sessão do comprador
- Busca checkout por slug + pixels do dono (sem `access_token`)
- **Busca `profiles.name` do vendedor** → passa como `sellerName` ao `CheckoutPageClient`
  - Fallback: `'o vendedor'` quando `profiles.name` está vazio
- `CheckoutPageClient` exibe rodapé legal abaixo do botão Pagar:
  - Declaração citando **Umbra Bot** e o **nome do vendedor** (dinâmico)
  - Links para Termos de Compra, Termos de Uso e Política de Privacidade (`umbra.bot/*`)
  - Link "Denunciar esse produto" (`mailto:contato@umbra.bot?subject=...`)
  - Nota de parcelamento com acréscimo (visível apenas quando `installments > 1`)
  - Aviso Google reCAPTCHA com links oficiais das políticas do Google

---

### Affiliates

| Método | Caminho | Função | Autenticação | Rate limit |
|---|---|---|---|---|
| `POST` | `/api/affiliates/apply` | Candidatura pública ao programa de afiliados | Nenhuma | 10 req/hora por IP |

---

### Admin e Migrations

| Método | Caminho | Função | Autenticação | Rate limit |
|---|---|---|---|---|
| `POST` | `/api/admin/migrate-tokens` | Re-encripta tokens legados (plain→AES) | `Authorization: Bearer ADMIN_MIGRATION_SECRET` | Nenhum |
| `GET/POST` | `/api/migrations` | Runner de migrações SQL (lista/executa arquivos) | Supabase session + `ADMIN_EMAIL` | Nenhum |

---

### Cron

| Método | Caminho | Função | Autenticação | Rate limit |
|---|---|---|---|---|
| `GET` | `/api/cron/process-withdrawals` | Processa saques pendentes +24h | `Authorization: Bearer CRON_SECRET` | Nenhum |
| `GET` | `/api/cron/cleanup-activity` | Deleta activity_events +90 dias | `Authorization: Bearer CRON_SECRET` | Nenhum |
| `GET` | `/api/cron/cleanup-alerts` | Deleta alertas resolvidos +30 dias | `Authorization: Bearer CRON_SECRET` | Nenhum |
| `GET` | `/api/cron/check-bots` | Verifica conectividade de todos os bots | `Authorization: Bearer CRON_SECRET` | Nenhum |
| `GET` | `/api/cron/process-remarketing` | Enfileira contatos + envia mensagens de remarketing | `Authorization: Bearer CRON_SECRET` | Nenhum |
| `GET` | `/api/cron/process-broadcasts` | Processa 1 broadcast agendado por rodada | `Authorization: Bearer CRON_SECRET` | Nenhum |
| `GET` | `/api/cron/register-webhooks` | Re-registra webhooks Telegram de todos os bots | `Authorization: Bearer CRON_SECRET` | Nenhum |

---

## 7. WEBHOOKS

### Recebidos

#### Telegram → `/api/telegram/webhook?bot_id=<uuid>`

**Fluxo completo:**

1. Telegram envia `POST` com `X-Telegram-Bot-Api-Secret-Token` no header
2. Rota busca bot pelo `bot_id` na tabela `bots` via `createAdminClient()`
3. Compara header com `bot.webhook_secret` — retorna 401 se inválido
4. **Update é `message` com texto `/start` (novo contato):**
   - Faz upsert do contato em `contacts`
   - Insere `activity_event` tipo `lead`
   - Insere `checkout_event` `conversation_started` (fire-and-forget)
   - Se bot tem `active_flow_id`: executa motor de fluxo (`executeFlowNode` recursivo, depth ≤ 20)
   - Senão: envia `welcome_message` com substituição de variáveis `{nome}/{bot}/{data}`
5. **Update é `message` com texto (contato com fluxo ativo):**
   - Salva resposta em `flow_vars[variavel_do_nó]`
   - Avança para próximo nó no fluxo
6. **Update é `callback_query` (botão pressionado):**
   - `answerCallbackQuery` para dispensar spinner
   - Identifica botão pelo índice em `flow_btn_{i}`
   - Avança fluxo pelo `sourceHandle` correspondente
7. **Mensagem sem fluxo ativo:** envia `fallback_message` se configurado
8. Sempre retorna 200 (Telegram não reenvia se receber 200)

**Tipos de nó executados:** `message`, `question`, `buttons`, `tag`, `delay` (pulado), `image`, `link`, `offer`, `condition` (pega primeiro branch), `end`/`handoff` (terminal).

---

#### Mercado Pago → `/api/payments/mercadopago-webhook`

**Fluxo completo:**

1. MP envia `POST` com header `x-signature: ts=<ts>,v1=<hmac>`
2. Rota ignora eventos que não são `type: "payment"`
3. Verifica assinatura HMAC-SHA256: `HMAC(secret, "id:{paymentId};request-id:{x-request-id};ts:{ts}")` — retorna 401 se inválida
4. Busca detalhes do pagamento em `GET https://api.mercadopago.com/v1/payments/{id}` com `MERCADOPAGO_ACCESS_TOKEN`
5. Localiza transação pelo `gateway_payment_id` na tabela `transactions` (via `createClient()`)
6. Se status já é o mesmo: retorna 200 sem processar (idempotência)
7. **Aprovado (`status = approved`):**
   - Atualiza `transactions.status = 'approved'`
   - Insere `checkout_event` tipo `paid` (fire-and-forget)
   - Credita comissão de afiliado via RPC `credit_affiliate_sale` (se `affiliate_id` preenchido)
   - Chama `fireCapiPurchase()` de `lib/capi.ts` (fire-and-forget)
   - Insere `activity_event` tipo `sale`
   - Insere `alert` tipo `sale` com context chips
   - Envia mensagem Telegram ao comprador (se `customer_telegram_id` e `bot_id` presentes)
8. **Cancelado/Expirado:** envia mensagem Telegram avisando que o PIX expirou
9. Sempre retorna 200

---

### Disparados (dashboard/webhooks)

**Status: ✅ Funcional** — Implementado com Server Component + Client Component real, Server Actions CRUD, HMAC-SHA256 e tabela `webhook_deliveries`.

**Arquivos:**
- `app/dashboard/webhooks/page.tsx` — Server Component: SSR webhooks do usuário + auth guard
- `app/dashboard/webhooks/WebhooksClient.tsx` — Client Component: KPI cards, tabela, delivery log lazy, Realtime
- `app/actions/webhooks.ts` — 8 Server Actions autenticadas com rate limit e IDOR protection
- `lib/webhooks.ts` — `dispatchWebhookEvent()` fire-and-forget, usado pelos route handlers de eventos
- `supabase/migrations/091_webhooks_real.sql` — schema real: `user_id`, RLS owner, `webhook_deliveries`, RPCs

**Server Actions (`app/actions/webhooks.ts`):**

| Action | Função | Rate limit |
|---|---|---|
| `generateSecretAction()` | Gera `whsec_` + 36 bytes hex via `crypto.randomBytes` | Nenhum |
| `createWebhookAction(payload)` | INSERT com `encryptToken(secret)` + SSRF validation | 10/hora por usuário |
| `updateWebhookAction(id, patch)` | UPDATE com `.eq('user_id')` + IDOR duplo | 20/hora por usuário |
| `deleteWebhookAction(id)` | DELETE com `.eq('user_id')` | Nenhum |
| `toggleWebhookAction(id, active)` | UPDATE active + status (healthy/paused) | Nenhum |
| `testWebhookAction(id)` | HTTP POST real + HMAC + persiste em `webhook_deliveries` + `sync_webhook_stats` RPC | 10/min por usuário |
| `loadDeliveryDetailAction(deliveryId)` | SELECT payload + response_body de entrega específica (lazy — só ao expandir) | Nenhum |
| `loadDeliveriesAction(webhookId, page)` | SELECT paginado de `webhook_deliveries` (20/página) | Nenhum |
| `resendDeliveryAction(deliveryId)` | HTTP POST real com payload original + nova assinatura HMAC | 10/min por usuário |

**Dispatcher (`lib/webhooks.ts`):**

```typescript
const MAX_ATTEMPTS    = 3
const RETRY_DELAYS_MS = [0, 1_000, 5_000]  // delay antes da tentativa 1, 2, 3

export function dispatchWebhookEvent(
  userId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
): void {
  void _dispatchAsync(userId, eventType, data)  // fire-and-forget — nunca lança
}
```

- Usa `createAdminClient()` para buscar webhooks (route handlers não têm sessão de usuário)
- Filtra por `active = true` e `events @> [eventType]`; seleciona `id, url, secret, name`
- **Retry automático:** `_sendWithRetry()` tenta até 3 vezes com backoff [0 ms, 1 s, 5 s]
  - Cada tentativa inserida individualmente em `webhook_deliveries` com campo `attempt` (1, 2 ou 3)
  - Loop interrompido ao primeiro sucesso (`res.ok = true`)
- Assina com HMAC-SHA256: `'sha256=' + createHmac('sha256', plainSecret).update(payload).digest('hex')`
- Headers: `X-Umbra-Signature-256`, `X-Umbra-Event`, `X-Umbra-Delivery`, `X-Umbra-Timestamp`, `X-Umbra-Retry: N` (N = attempt - 1; 0 = primeira tentativa), `User-Agent: Umbra-Bot-Webhook/1.0`
- AbortSignal.timeout(8000) por tentativa — nunca trava o thread
- Persiste resultado em `webhook_deliveries` por tentativa (success, response_status, response_body, duration_ms, attempt)
- Chama RPC `sync_webhook_stats` após todas as tentativas (atualiza deliveries_24h, success_rate, status)
- **Alerta proativo de falha:**
  - Se todas as 3 tentativas falharem: `_createFailureAlert()` cria `alert` do tipo `webhookFailed` (severity=warning) — só se não houver alerta aberto para aquele webhook
  - Se próxima entrega tiver sucesso: `_resolveFailureAlert()` auto-resolve o alerta com `resolved_by='sistema (auto)'`
  - Usa `.filter('context->>webhook_id', 'eq', webhookId)` para acessar o campo JSONB `context`

**Eventos disponíveis (`WebhookEventType`):**

| Evento | Disparado por |
|---|---|
| `sale.approved` | `app/api/payments/mercadopago-webhook/route.ts` — quando MP confirma pagamento |
| `sale.pending` | `app/api/payments/mercadopago-webhook/route.ts` — quando PIX é criado e aguarda pagamento |
| `sale.refunded` | (disponível — não disparado automaticamente ainda) |
| `sale.chargeback` | (disponível — não disparado automaticamente ainda) |
| `lead.created` | `app/api/telegram/webhook/route.ts` — quando novo contato inicia conversa (`/start`) |
| `lead.tagged` | (disponível — não disparado automaticamente ainda) |
| `lead.unsubscribed` | (disponível — não disparado automaticamente ainda) |
| `subscription.created` | (disponível — não disparado automaticamente ainda) |
| `subscription.canceled` | (disponível — não disparado automaticamente ainda) |
| `subscription.renewed` | (disponível — não disparado automaticamente ainda) |
| `bot.disconnected` | (disponível — não disparado automaticamente ainda) |
| `flow.completed` | (disponível — não disparado automaticamente ainda) |
| `test.ping` | `testWebhookAction` — evento de teste disparado pelo dashboard |

**Tabelas do banco:**

```sql
-- webhooks — webhooks de saída por usuário
-- Migração 091 adicionou: user_id, RLS owner, sync_webhook_stats RPC, webhooks_stats RPC

-- webhook_deliveries — histórico de entregas
create table public.webhook_deliveries (
  id              uuid        primary key default gen_random_uuid(),
  webhook_id      text        not null references public.webhooks(id) on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  event_type      text        not null,
  payload         jsonb       not null default '{}',
  response_status integer,
  response_body   text,
  duration_ms     integer,
  success         boolean     not null default false,
  attempt         integer     not null default 1,
  created_at      timestamptz not null default now()
);
```

**RPC `sync_webhook_stats(p_webhook_id text)`:**
- `security definer` — atualiza `deliveries_24h`, `success_rate` e `status` (failing se <80%, healthy se ≥80%)
- Chamada após cada entrega em `lib/webhooks.ts` e `testWebhookAction` / `resendDeliveryAction`

**RPC `webhooks_stats(p_user_id uuid)`:**
- Retorna `{ total, active, failing, deliveries_24h, success_rate }` — usado nos KPI cards do dashboard

**Segurança:**
- Secrets criptografados AES-256-GCM via `encryptToken()` antes de salvar — nunca expostos ao client
- SSRF protection na URL: bloqueia `localhost`, `127.0.0.1`, `169.254.x.x`, `10.x`, `192.168.x`
- RLS `webhooks_owner`: `auth.uid() = user_id` — sem cross-user leak
- `webhook_deliveries`: RLS SELECT only (`wd_owner`), INSERT via `security definer` functions
- `dispatchWebhookEvent` usa `createAdminClient()` — webhooks de route handlers não têm sessão

**PostHog events:** `webhook_created`, `webhook_tested`, `webhook_paused`, `webhook_resumed`, `webhook_deleted`, `webhook_secret_rotated`, `delivery_resent`

**Supabase Realtime:** canal `webhooks-realtime`, event `*`, filtro `user_id=eq.${userId}` — atualiza status/active/deliveries_24h/success_rate em tempo real no dashboard

**Payload preview no histórico:** `DeliveryRow` é um componente stateful com botão de expansão. Ao expandir, chama `loadDeliveryDetailAction(delivery.id)` para buscar `payload` (JSON) e `response_body` lazy — evita carregar dados pesados na listagem inicial. Campos `payload` e `response_body` são exibidos em `<pre>` formatado dentro de uma linha extra na tabela.

**Seção Integrações (WebhooksClient.tsx):** Componente `IntegrationsSection` exibido abaixo da tabela de webhooks. Apresenta 4 cards em grid `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` com guias passo a passo inline expansíveis:

| Plataforma | URL | Descrição |
|---|---|---|
| Zapier | zapier.com/apps/webhook/integrations | 7.000+ apps conectados |
| Make | make.com | Automação visual avançada |
| n8n | n8n.io | Open-source, self-hostável |
| ManyChat | manychat.com | Automação para Telegram e Instagram |

Cada card contém: logo inicial colorido, nome da plataforma, tagline, link "Abrir [Platform]" e botão chevron para expandir/colapsar os passos do guia. **Funcionamento E2E:** o usuário cria o webhook na plataforma externa (obtém a URL de destino), cola a URL no formulário do Umbra Bot, e a plataforma passa a receber eventos assinados via HMAC automaticamente.

---

## 8. GATEWAYS DE PAGAMENTO

### Modelo de token (per-tenant vs. global)

O sistema opera em **modo híbrido**:

**Rota `/api/payments/pix`** (operador autenticado):
- Usa `getMercadoPagoToken()` de `lib/gateway.ts`
- **Prioridade 1:** credencial do próprio usuário na tabela `gateways` (descriptografada via `decryptToken`)
- **Prioridade 2:** `MERCADOPAGO_ACCESS_TOKEN` env var global

**Rota `/api/checkout/pay`** (comprador anônimo — checkout público):
- Busca token do **dono do checkout** via `createAdminClient()` na tabela `gateways`
- **Prioridade 2:** `MERCADOPAGO_ACCESS_TOKEN` env var global

**Rota `/api/payments/mercadopago-webhook`** (confirmação):
- Busca pagamento no MP usando `MERCADOPAGO_ACCESS_TOKEN` global (não o token per-tenant)
- Isso significa que o webhook funciona apenas se o token global tiver acesso aos pagamentos de todos os tenants — **limitação conhecida do modelo multi-tenant**

---

### Status por gateway

| Gateway | Criar PIX | Webhook | OAuth | CRUD no dashboard |
|---|---|---|---|---|
| **Mercado Pago** | ✅ Em uso | ✅ Em uso | ✅ Em uso | ✅ Em uso |
| **PushinPay** | ❌ Não iniciado | ❌ Não iniciado | ❌ Não iniciado | ❌ Apenas UI no Onboarding |
| **Pagar.me** | ❌ Não iniciado | ❌ Não iniciado | ❌ Não iniciado | ❌ Apenas UI no Onboarding |
| **Stripe** | ❌ Não iniciado | ❌ Não iniciado | ❌ Não iniciado | ❌ Apenas UI no Onboarding |

---

## 9. TRACKEAMENTO E PIXELS

### Meta Conversions API (CAPI)

- **Implementação:** `lib/capi.ts` — função `fireMetaCapi()`
- **API chamada:** `POST https://graph.facebook.com/v19.0/{pixelId}/events`
- **Evento enviado:** `Purchase` com `event_id = txId` (deduplicação), `action_source = 'website'`
- **PII hashing:** `em` (email), `fn` (primeiro nome), `ln` (último nome) com SHA-256
- **Ativado quando:** pixel com `capi = true` e `access_token` preenchido (descriptografado via `decryptToken`)
- **Disparado por:** MP webhook ao aprovar pagamento (`fireCapiPurchase`, fire-and-forget)
- **Teste manual:** `app/actions/pixels.ts` — `sendTestPixelEvent()` com `test_event_code='TEST00001'`
- **Status:** ✅ Em uso

### TikTok Events API

- **Implementação:** `lib/capi.ts` — função `fireTikTokEvents()`
- **API chamada:** `POST https://business-api.tiktok.com/open_api/v1.3/pixel/track/`
- **Evento enviado:** `CompletePayment` com `pixel_code` (campo `pixel_code` da tabela) ou fallback `pixel_id`
- **PII hashing:** `sha256_email` com SHA-256
- **Disparado por:** mesmo fluxo do Meta CAPI
- **Teste manual:** `sendTestPixelEvent()` com `test_event_code='TEST_EVENT'`
- **Status:** ✅ Em uso

### Google Measurement Protocol (GA4)

- **Implementação:** `lib/capi.ts` — função `fireGoogleMp()`
- **API chamada:** `POST https://www.google-analytics.com/mp/collect`
- **Evento enviado:** `purchase` com `transaction_id = txId`, `client_id = txId`
- **Teste manual:** `sendTestPixelEvent()` usa endpoint `/debug/mp/collect` (não polui dados reais)
- **Status:** ✅ Em uso

### Browser-side pixels (snippets)

- **Implementação:** `app/c/[slug]/PixelScripts.tsx` — injeta snippets no `<head>` da página pública
- **Providers:** Meta (`fbevents.js`), TikTok (`ttq.load()`), Google (`gtag.js`)
- **`SnippetCard`** em `TrackingClient.tsx` exibe o HTML para instalação manual
- **Status:** ✅ Implementado

### UTMs

- Gravadas em `transactions.utm_source`, `.utm_medium`, `.utm_campaign`, `.utm_content` (migração 037)
- Gravadas em `checkout_events.utm_source`, `.utm_medium`, `.utm_campaign` (migração 038)
- Enviadas opcionalmente no body de `POST /api/payments/pix`
- Enviadas no body de `POST /api/checkout/pay`

---

## 10. VARIÁVEIS DE AMBIENTE

Fonte: `.env.example` na raiz do repositório.

### Supabase

| Variável | Função | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL da instância Supabase | ✅ Sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima (browser) | ✅ Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (bypassa RLS) | ✅ Sim (webhook, cron) |
| `DATABASE_URL` | URL PostgreSQL direta | ❌ Não (só Prisma/Drizzle) |

### App

| Variável | Função | Obrigatória |
|---|---|---|
| `APP_URL` | URL pública da aplicação (registra webhooks Telegram) | ✅ Sim |

### Criptografia de Tokens

| Variável | Função | Obrigatória |
|---|---|---|
| `BOT_TOKEN_ENCRYPTION_KEY` | 64-char hex (32 bytes AES-256) — criptografa tokens de bot e pixels | ✅ Sim |

### Mercado Pago

| Variável | Função | Obrigatória |
|---|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | Token global de fallback | ✅ Sim (em dev/demo) |
| `MERCADOPAGO_WEBHOOK_SECRET` | Segredo HMAC para webhooks | ✅ Sim (prod) |
| `MERCADOPAGO_CLIENT_ID` | Client ID OAuth | ❌ Não (habilita botão OAuth) |
| `MERCADOPAGO_CLIENT_SECRET` | Client Secret OAuth | ❌ Não (obrigatório se CLIENT_ID definido) |

### Upstash Redis

| Variável | Função | Obrigatória |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | URL REST Upstash | ❌ Não (fallback memória em dev) |
| `UPSTASH_REDIS_REST_TOKEN` | Token Upstash | ❌ Não (idem) |

### Cron Jobs

| Variável | Função | Obrigatória |
|---|---|---|
| `CRON_SECRET` | Bearer token para todas as rotas `/api/cron/*` | ✅ Sim |

### Admin

| Variável | Função | Obrigatória |
|---|---|---|
| `ADMIN_EMAIL` | Email do admin (acessa `/api/migrations`) | ❌ Não |
| `ADMIN_MIGRATION_SECRET` | Bearer token para `/api/admin/migrate-tokens` | ❌ Não |

### Web Push (VAPID)

| Variável | Função | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Chave pública VAPID | ❌ Não (push desabilitado) |
| `VAPID_PRIVATE_KEY` | Chave privada VAPID | ❌ Não (idem) |
| `VAPID_EMAIL` | Email de contato VAPID | ❌ Não (idem) |

### Sentry

| Variável | Função | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | DSN do projeto | ❌ Não (só em prod) |
| `SENTRY_ORG` | Organização (build) | ❌ Não |
| `SENTRY_PROJECT` | Projeto (build) | ❌ Não |
| `SENTRY_AUTH_TOKEN` | Upload de source maps | ❌ Não |

### PostHog

| Variável | Função | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | Chave do projeto | ❌ Não (analytics desabilitado) |
| `NEXT_PUBLIC_POSTHOG_HOST` | Host da API | ❌ Não (default: us.i.posthog.com) |

### Google reCAPTCHA v2

| Variável | Função | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Chave pública (widget) | ❌ Não (widget oculto) |
| `RECAPTCHA_SECRET_KEY` | Chave secreta (verificação) | ❌ Não (retorna true se ausente) |

### Telegram MTProto

| Variável | Função | Obrigatória |
|---|---|---|
| `TELEGRAM_API_ID` | ID do app MTProto | ❌ Não (só para upload de foto) |
| `TELEGRAM_API_HASH` | Hash do app MTProto | ❌ Não (idem) |

### Supabase Management API

| Variável | Função | Obrigatória |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Token da Management API | ❌ Não (só `/api/migrations`) |
| `SUPABASE_PROJECT_REF` | Ref do projeto Supabase | ❌ Não (idem) |

---

## 11. TABELAS DO BANCO

Total de migrações: **92 arquivos** (numeradas de 000 a 091, mais arquivos de timestamp).

| Tabela | Função |
|---|---|
| `profiles` | Perfil público do usuário (nome, plano, saldo, avatar) |
| `bots` | Bots Telegram cadastrados (token criptografado, webhook_secret, status) |
| `flows` | Fluxos de automação (nodes, edges, trigger_type, keywords) |
| `contacts` | Leads/compradores capturados pelos bots (flow_id, flow_node_id, flow_vars) |
| `transactions` | Transações financeiras (PIX, status, customer, UTMs, affiliate_id, checkout_id, customer_device) |
| `withdrawals` | Solicitações de saque (amount, status, account_id, notes, payout_tx_id) |
| `bank_accounts` | Contas bancárias dos usuários (pix_key, kind, label) |
| `gateways` | Gateways de pagamento conectados (credentials criptografadas, token_expires_at) |
| `pixels` | Pixels de rastreamento (provider, pixel_id, pixel_code, access_token criptografado, capi) |
| `checkouts` | Páginas de checkout públicas (slug, price, fields, order_bump, upsell, coupons) |
| `checkout_coupons` | Cupons de desconto por checkout (code, type, value, max_uses, uses) |
| `checkout_events` | Funil de conversão (visited, cart_added, paid, conversation_started) |
| `affiliates` | Afiliados cadastrados (slug, commission_pct, status, clicks, sales) |
| `affiliate_payments` | Histórico de pagamentos de comissão |
| `affiliate_config` | Configuração do programa de afiliados (active, program_name, benefits) |
| `remarketing_campaigns` | Campanhas de remarketing (steps, trigger_type, audience, bot_id) |
| `remarketing_executions` | Execuções pendentes de remarketing (contact_id, step_index, scheduled_at) |
| `broadcasts` | Disparos em massa (message, audience, status, sent, delivered, failed) |
| `redirects` | Links de redirecionamento (slug, destination, cloaking, utm) |
| `redirect_click_events` | Eventos de clique em redirecionadores (ip_hash, device_type, referrer) |
| `alerts` | Alertas do dashboard (type, severity, source, context, resolved_by_id) |
| `activity_events` | Feed de atividade (type, title, description, bot_id, contact_id) |
| `notification_prefs` | Preferências de notificação por canal (email, panel, telegram) |
| `push_subscriptions` | Subscriptions WebPush por usuário |
| `invoices` | Faturas de billing (period, value, due_date, status) |
| `bank_accounts` | Contas bancárias (duplicado acima para clareza) |
| `biolinks` | Páginas de bio link públicas (múltiplos por usuário, slug único, status published/draft) |
| `biolink_view_events` | Eventos de visita ao bio link (ip_hash, device_type, referrer) |
| `biolink_click_events` | Eventos de clique em links do bio link (link_id, link_url, ip_hash, device_type) |
| `webhooks` | Webhooks de saída (funcional — CRUD real + delivery log + retry + HMAC) |
| `team_members` | Membros de equipe (funcional — convites in-app via RPCs SECURITY DEFINER; controle de acesso por papel pendente) |
| `guide_articles` | Artigos do guia da plataforma (SSR ISR 3600s + Server Actions: views, votos, body lazy) |
| `guide_article_votes` | Votos de utilidade por artigo (UNIQUE article_id + user_id; toggle via RPC vote_article) |
| `guide_faqs` | FAQs da plataforma (SSR + accordion no GuideClient) |
| `guide_search_logs` | Logs de busca no guia (telemetria — INSERT via logGuideSearchAction) |
| `courses` | Cursos da academia (RLS SELECT-only para autenticados — migração 094) |
| `course_enrollments` | Matrículas de usuários em cursos (PK composta user_id+course_id; RPC `enroll_in_course`) |
| `course_progress` | Progresso por aula (user_id, course_id, lesson_id PK; done, watched_sec, done_at; RPC `upsert_lesson_progress`) |
| `course_certificates` | Certificados emitidos (UNIQUE user_id+course_id; RPC `issue_certificate` verifica 100% conclusão) |
| `course_modules` | Módulos relacionais dos cursos (tabela normalizada; fallback JSONB via RPC `get_course_with_modules`) |
| `course_lessons` | Aulas relacionais por módulo (video_url, duration_min, order_num; FK → course_modules + courses) |
| `audit_log` | Log de auditoria (tabela criada, uso limitado) |
| `cron_log` | Log de execução dos cron jobs (job, status, processed, error_message) |

---

## 12. SEGURANÇA APLICADA A INTEGRAÇÕES

### Criptografia AES-256-GCM (`lib/crypto.ts`)

- **Algoritmo:** AES-256-GCM, chave de 32 bytes
- **Chave:** `BOT_TOKEN_ENCRYPTION_KEY` (64-char hex)
- **Formato no banco:** `enc:<iv_hex>:<tag_hex>:<ciphertext_hex>`
- **Backward compatible:** valores sem prefixo `enc:` são tratados como plain text (tokens legados)
- **O que é criptografado:**
  - `bots.token` (token do bot Telegram)
  - `gateways.credentials.token` (access token do gateway)
  - `pixels.access_token` (token da API de pixels Meta/TikTok/Google)
- **Migração de tokens legados:** `POST /api/admin/migrate-tokens` (protegido por `ADMIN_MIGRATION_SECRET`)

### CSP (Content-Security-Policy) — `middleware.ts`

Origens permitidas por diretiva:

| Diretiva | Origens |
|---|---|
| `default-src` | `'self'` |
| `script-src` | `'self'` `'unsafe-inline'` (+ `'unsafe-eval'` apenas em dev) |
| `style-src` | `'self'` `'unsafe-inline'` |
| `img-src` | `'self'` `data:` `https:` `blob:` |
| `font-src` | `'self'` `data:` |
| `connect-src` | `'self'` `https://*.supabase.co` `wss://*.supabase.co` `https://*.posthog.com` `https://api.mercadopago.com` `https://api.telegram.org` `https://vercel.live` |
| `worker-src` | `'self'` `blob:` |
| `object-src` | `'none'` |
| `frame-ancestors` | `'none'` |
| `base-uri` | `'self'` |
| `form-action` | `'self'` |

**Headers de segurança adicionais:**

| Header | Valor |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |

### Verificação de segredo nos webhooks

| Webhook | Mecanismo | Variável |
|---|---|---|
| Telegram | Header `X-Telegram-Bot-Api-Secret-Token` comparado com `bot.webhook_secret` (banco) | Sem env var — segredo gerado por bot |
| Mercado Pago | HMAC-SHA256 do header `x-signature` com mensagem `id:{id};request-id:{rid};ts:{ts}` | `MERCADOPAGO_WEBHOOK_SECRET` |

**Proteção CSRF OAuth MP:** cookie `mp_oauth_state` (httpOnly, sameSite=lax, maxAge=600s) comparado com parâmetro `state` do callback.

### IDOR Prevention

- Todas as Server Actions leem `userId` via `supabase.auth.getUser()` (servidor) — nunca do body/params
- Todas as queries de mutação usam `.eq('user_id', user.id)` (dupla proteção: código + RLS)
- Webhook Telegram valida `webhook_secret` por bot — sem acesso cruzado entre bots
- Checkout pay busca `user_id` do checkout no banco, nunca aceita do comprador
- OAuth MP verifica que `bank_account_id` pertence ao usuário antes de iniciar o fluxo

---

## 13. MANUTENÇÃO DESTE DOCUMENTO

Atualizar este arquivo sempre que uma integração for adicionada, removida ou trocada.

**Checklist ao adicionar integração:**
1. Adicionar linha na tabela da Seção 1 (Visão Geral)
2. Documentar na seção temática correspondente (4, 5, 6, etc.)
3. Listar variáveis de ambiente novas na Seção 10
4. Atualizar `CLAUDE.md` se a integração afetar o fluxo de desenvolvimento
5. Atualizar `.env.example` com as novas variáveis
