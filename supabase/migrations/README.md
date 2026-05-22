# Umbra Bot — Schema do Banco de Dados

Schema extraído diretamente do banco Supabase (projeto: `aoycxcepjvpmeptdafxn`).
**32 tabelas** no schema `public`.

---

## public.activity_events

```
id:          uuid        NOT NULL  default gen_random_uuid()
type:        text        NOT NULL
title:       text        NOT NULL
description: text        NOT NULL  default ''
bot:         text        NOT NULL  default ''
amount:      numeric
created_at:  timestamptz NOT NULL  default now()
user_id:     uuid
bot_id:      uuid        FK → bots(id)
contact_id:  uuid        FK → contacts(id)
```

---

## public.affiliate_config

```
id:                    uuid        NOT NULL  default gen_random_uuid()
user_id:               uuid        NOT NULL  FK → auth.users(id)  UNIQUE
percentage:            numeric     NOT NULL  default 30
attribution_rule:      text        NOT NULL  default 'last_click'
cookie_window:         integer     NOT NULL  default 30
upsell_commissions:    boolean     NOT NULL  default true
recurring_commissions: boolean     NOT NULL  default false
auto_payment:          boolean     NOT NULL  default false
min_payout:            numeric     NOT NULL  default 100
created_at:            timestamptz NOT NULL  default now()
updated_at:            timestamptz NOT NULL  default now()
program_name:          text
program_description:   text
benefits:              text[]               default ARRAY[]::text[]
active:                boolean     NOT NULL  default true
redirect_url:          text
```

---

## public.affiliate_payments

```
id:           uuid        NOT NULL  default gen_random_uuid()
affiliate_id: uuid        NOT NULL  FK → affiliates(id)
cycle:        text        NOT NULL
sales:        integer     NOT NULL  default 0
amount:       numeric     NOT NULL  default 0
status:       text        NOT NULL  default 'pending'
paid_at:      date
created_at:   timestamptz NOT NULL  default now()
updated_at:   timestamptz NOT NULL  default now()
user_id:      uuid        FK → auth.users(id)
```

---

## public.affiliates

```
id:              uuid        NOT NULL  default gen_random_uuid()
name:            text        NOT NULL
email:           text        NOT NULL
slug:            text        NOT NULL  UNIQUE
status:          text        NOT NULL  default 'active'
clicks:          integer     NOT NULL  default 0
sales:           integer     NOT NULL  default 0
commission:      numeric     NOT NULL  default 0
conversion_rate: numeric     NOT NULL  default 0
payment_method:  text
joined_at:       timestamptz NOT NULL  default now()
created_at:      timestamptz NOT NULL  default now()
updated_at:      timestamptz NOT NULL  default now()
user_id:         uuid        FK → auth.users(id)
commission_pct:  numeric     NOT NULL  default 30
notes:           text
```

---

## public.alerts

```
id:             uuid        NOT NULL  default gen_random_uuid()
type:           text        NOT NULL
severity:       text        NOT NULL  default 'warning'
title:          text        NOT NULL
description:    text        NOT NULL  default ''
context:        jsonb       NOT NULL  default '[]'
resolved:       boolean     NOT NULL  default false
resolved_at:    timestamptz
resolved_by:    text
created_at:     timestamptz NOT NULL  default now()
updated_at:     timestamptz NOT NULL  default now()
user_id:        uuid        FK → auth.users(id)
resolved_by_id: uuid        FK → auth.users(id)
source:         text
action_taken:   text
viewed_at:      timestamptz
```

---

## public.audit_log

```
id:         bigint      NOT NULL  default nextval('audit_log_id_seq')
user_id:    uuid        FK → auth.users(id)
action:     text        NOT NULL
table_name: text
record_id:  text
old_data:   jsonb
new_data:   jsonb
ip:         text
user_agent: text
created_at: timestamptz NOT NULL  default now()
```

---

## public.bank_accounts

```
id:         uuid        NOT NULL  default gen_random_uuid()
user_id:    uuid        NOT NULL  FK → auth.users(id)
label:      text        NOT NULL
pix_key:    text        NOT NULL
kind:       text        NOT NULL  default 'pix'
created_at: timestamptz NOT NULL  default now()
```

---

## public.biolinks

```
id:           text        NOT NULL
slug:         text        NOT NULL
name:         text        NOT NULL  default ''
bio:          text        NOT NULL  default ''
avatar:       text        NOT NULL  default ''
avatar_color: text        NOT NULL  default '#7c3aed'
theme_id:     text        NOT NULL  default 'violet'
background:   text        NOT NULL  default 'solid'
button_style: text        NOT NULL  default 'rounded'
links:        jsonb       NOT NULL  default '[]'
views:        integer     NOT NULL  default 0
clicks:       integer     NOT NULL  default 0
conversion:   numeric     NOT NULL  default 0
top_referrer: text        NOT NULL  default ''
status:       text        NOT NULL  default 'draft'
created_at:   timestamptz NOT NULL  default now()
updated_at:   timestamptz NOT NULL  default now()
user_id:      uuid        FK → auth.users(id)
```

---

## public.bots

```
id:               uuid        NOT NULL  default gen_random_uuid()
name:             text        NOT NULL
username:         text        NOT NULL
status:           text        NOT NULL  default 'offline'
leads:            integer     NOT NULL  default 0
sales:            integer     NOT NULL  default 0
conversion:       numeric     NOT NULL  default 0
revenue:          numeric     NOT NULL  default 0
active_flow_id:   uuid        FK → flows(id)
color:            text        NOT NULL  default '#6366f1'
telegram_id:      text
token:            text        (criptografado AES-256-GCM)
welcome_message:  text        NOT NULL  default ''
fallback_message: text        NOT NULL  default ''
description:      text        NOT NULL  default ''
webhook_url:      text        NOT NULL  default ''
last_sync:        timestamptz
added_at:         timestamptz NOT NULL  default now()
created_at:       timestamptz NOT NULL  default now()
updated_at:       timestamptz NOT NULL  default now()
user_id:          uuid        FK → auth.users(id)
webhook_secret:   text        UNIQUE    default gen_random_uuid()::text
```

---

## public.broadcasts

```
id:             uuid        NOT NULL  default gen_random_uuid()
title:          text        NOT NULL  default 'Novo disparo'
bot:            text        NOT NULL  default ''
audience:       text        NOT NULL  default 'leads'
audience_count: integer     NOT NULL  default 0
status:         text        NOT NULL  default 'draft'
sent:           integer     NOT NULL  default 0
delivered:      integer     NOT NULL  default 0
failed:         integer     NOT NULL  default 0
scheduled_for:  bigint
started_at:     bigint
finished_at:    bigint
failure_reason: text
message:        text        NOT NULL  default ''
media:          jsonb
buttons:        jsonb       NOT NULL  default '[]'
created_at:     timestamptz NOT NULL  default now()
updated_at:     timestamptz NOT NULL  default now()
user_id:        uuid        NOT NULL  FK → auth.users(id)
bot_id:         uuid        FK → bots(id)
filters:        jsonb       NOT NULL  default '{}'
```

---

## public.checkout_events

```
id:             uuid        NOT NULL  default gen_random_uuid()
user_id:        uuid        NOT NULL  FK → auth.users(id)
bot_id:         uuid        FK → bots(id)
flow_id:        uuid        FK → flows(id)
contact_id:     uuid        FK → contacts(id)
transaction_id: uuid        FK → transactions(id)
checkout_id:    text        FK → checkouts(id)  ON DELETE SET NULL  [migração 078]
event_type:     text        NOT NULL
product_name:   text        NOT NULL  default ''
utm_source:     text
utm_medium:     text
utm_campaign:   text
metadata:       jsonb       NOT NULL  default '{}'
created_at:     timestamptz NOT NULL  default now()
```

Trigger `trg_sync_checkout_stats` (migração 078): dispara após INSERT em `checkout_events` onde `checkout_id IS NOT NULL`. Atualiza `checkouts.visits` (quando `event_type = 'visited'`) e `checkouts.conversions` + `checkouts.conversion` (quando `event_type = 'paid'`).

RPC `track_checkout_visit(p_slug, p_utm_source, p_utm_medium, p_utm_campaign)` — security definer, grant to anon:
- Resolve `checkout_id` e `user_id` via slug (checkouts WHERE status='published')
- Insere evento 'visited' em checkout_events — trigger sincroniza visits++
- Chamada pelo CheckoutPageClient no mount (sem auth necessária)

---

## public.checkouts

```
id:             text        NOT NULL
name:           text        NOT NULL
slug:           text        NOT NULL  UNIQUE
product_name:   text        NOT NULL  default ''
product_desc:   text        NOT NULL  default ''
product_image:  text                  (URL pública no bucket checkout-images) [migração 080]
price:          numeric     NOT NULL  default 0
installments:   integer     NOT NULL  default 1
gateway:        text        NOT NULL  default 'pushinpay'
pixel:          text        NOT NULL  default 'none'
primary_color:  text        NOT NULL  default '#7c3aed'
bg_variant:     text        NOT NULL  default 'light'
font:           text        NOT NULL  default 'Inter'
logo:           text        NOT NULL  default ''
badge:          text
fields:         jsonb       NOT NULL  default '{"cep":false,"cpf":true,"name":true,"email":true,"phone":false,"address":false}'
methods:        jsonb       NOT NULL  default '{"pix":true,"card":true,"boleto":false}'
layout:         text        NOT NULL  default 'two_col'
status:         text        NOT NULL  default 'draft'
visits:         integer     NOT NULL  default 0
conversions:    integer     NOT NULL  default 0
conversion:     numeric     NOT NULL  default 0
created_at:     timestamptz NOT NULL  default now()
updated_at:     timestamptz NOT NULL  default now()
user_id:        uuid        FK → auth.users(id)
success_url:       text                  (URL de redirecionamento após pagamento confirmado) [migração 081]
guarantee_days:    integer               (dias de garantia — exibidos como badge no checkout público) [migração 081]
countdown_end:     timestamptz           (fim do contador de urgência no checkout público) [migração 081]
order_bump:        jsonb                 ({ title, desc, price, image }) — produto complementar exibido antes do pagamento [migração 085]
logo_image:        text                  (URL da logo do negócio exibida no checkout público) [migração 085]
two_step:          boolean     NOT NULL  default false  (divide formulário em 2 etapas: dados → pagamento) [migração 085]
upsell:            jsonb                 ({ title, desc, price, cta, link }) — oferta exibida após pagamento aprovado [migração 085]
visitor_tracking:  boolean     NOT NULL  default false  (habilita contador de visitantes ao vivo via Supabase Realtime Presence) [migração 085]
```

**Colunas adicionadas por migração:**
- Migração 080: `product_image text` — URL pública da imagem do produto no Supabase Storage
- Migração 081: `success_url text`, `guarantee_days integer`, `countdown_end timestamptz`
- Migração 085: `order_bump jsonb`, `logo_image text`, `two_step boolean`, `upsell jsonb`, `visitor_tracking boolean`

**RLS — migração 082:**
- Política `checkouts_open` (`using(true)`) substituída por `checkouts_owner` (`auth.uid() = user_id`)
- Nota: `checkouts.id` é `text` e `user_id` é `uuid`, portanto o cast `::text` é obrigatório
- Índice `checkouts_user_id_idx` criado para acelerar queries filtradas por `user_id`
- Vulnerabilidade IDOR crítica resolvida — antes qualquer autenticado via SDK direto podia ler/alterar checkouts alheios

**Supabase Storage — bucket `checkout-images`** (migração 080):
- Bucket público, max 2 MB por arquivo, tipos aceitos: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- Organização por pasta: `{user_id}/{checkout_id}.{ext}`
- 4 políticas RLS de storage: insert/select/update/delete verificam `auth.uid()` no path

**RPC `checkout_tx_status(p_tx_id, p_checkout_id)`** (migração 079) — security definer, grant to anon:
- Retorna `{ status: string }` apenas — sem dados sensíveis
- Usado pelo CheckoutPageClient para polling do status PIX (intervalo 4s, sem auth necessária)
- Valida que `tx_id` pertence ao `checkout_id` informado (sem cross-checkout leak)

---

## public.checkout_coupons

```
id:          uuid        NOT NULL  default gen_random_uuid()
user_id:     uuid        NOT NULL  FK → auth.users(id)  ON DELETE CASCADE
checkout_id: text                  FK → checkouts(id)   ON DELETE CASCADE  (null = cupom global do vendedor)
code:        text        NOT NULL  (código do cupom — case-insensitive na validação)
type:        text        NOT NULL  default 'percent'  check in ('percent', 'fixed')
value:       numeric     NOT NULL  default 0          check >= 0
max_uses:    integer               (null = uso ilimitado; valor > 0 quando definido)
uses:        integer     NOT NULL  default 0          (incrementado atomicamente pela RPC)
valid_until: timestamptz           (null = sem data de expiração)
active:      boolean     NOT NULL  default true
created_at:  timestamptz NOT NULL  default now()
```

CONSTRAINT: `checkout_coupons_user_code_key UNIQUE (user_id, code)` — mesmo vendedor não pode ter 2 cupons com o mesmo código
RLS: `coupons_owner` → `auth.uid() = user_id` (for all)
Índices: `checkout_coupons_user_id_idx (user_id)`, `checkout_coupons_checkout_id_idx (checkout_id)`

**RPC `validate_and_apply_coupon(p_user_id uuid, p_code text, p_price numeric)`** → `json`:
- Security definer, grant to `authenticated, anon` — chamada pelo `/api/checkout/pay` via admin client
- Busca cupom por `user_id + code` (case-insensitive via `lower()`)
- Valida: `active = true`, `valid_until` não expirado, `uses < max_uses` (se definido)
- Calcula desconto: `percent` → `round(price * value/100, 2)`; `fixed` → `least(value, price)`
- Aplica `greatest(0, price - discount)` para garantir preço nunca negativo
- Incrementa `uses = uses + 1` atomicamente (UPDATE WHERE id — sem race condition)
- Retorna sucesso: `{ valid: true, coupon_id, type, value, discount, final }`
- Retorna falha: `{ valid: false, error: "Cupom inválido ou expirado." | "Cupom expirado." | "Cupom atingiu o limite de usos." }`

**GET `/api/checkout/validate-coupon`** (preview sem incremento):
- Rate limit 30/min por IP; busca checkout (user_id + price) via `checkout_id` + `slug`
- Calcula desconto manualmente sem chamar a RPC (sem side-effects)
- Usado pelo formulário público antes do submit para exibir o desconto ao comprador
- Chamado pelo `CheckoutPageClient` ao clicar "Aplicar"

---

## public.contacts

```
id:             uuid        NOT NULL  default gen_random_uuid()
name:           text        NOT NULL  default ''
telegram_id:    text
phone:          text
email:          text
bot:            text        (legado — string do username)
status:         text        NOT NULL  default 'new'
tags:           text[]      NOT NULL  default '{}'
total_spent:    numeric     NOT NULL  default 0
orders_count:   integer     NOT NULL  default 0
city:           text
state:          text
first_contact:  timestamptz NOT NULL  default now()
last_contact:   timestamptz NOT NULL  default now()
created_at:     timestamptz NOT NULL  default now()
updated_at:     timestamptz NOT NULL  default now()
user_id:        uuid        FK → auth.users(id)
bot_id:         uuid        FK → bots(id)
first_name:     text        NOT NULL  default ''
last_name:      text        NOT NULL  default ''
username:       text
language:       text        NOT NULL  default 'pt'
purchases:      integer     NOT NULL  default 0
origin:         text
first_purchase: timestamptz
last_purchase:  timestamptz
avg_ticket:     numeric     NOT NULL  default 0
flow_id:        uuid        FK → flows(id)
flow_node_id:   text
flow_vars:      jsonb       NOT NULL  default '{}'
```

CONSTRAINT: `contacts_bot_telegram_key UNIQUE (bot_id, telegram_id)`

---

## public.courses

```
id:                text        NOT NULL  default gen_random_uuid()::text
title:             text        NOT NULL  default ''
subtitle:          text        NOT NULL  default ''
instructor:        text        NOT NULL  default ''
instructor_role:   text        NOT NULL  default ''
instructor_avatar: text        NOT NULL  default ''
level:             text        NOT NULL  default 'Iniciante'
duration_min:      integer     NOT NULL  default 60
cover_accent:      text        NOT NULL  default 'var(--primary)'
cover_pattern:     text        NOT NULL  default 'wave'
featured:          boolean     NOT NULL  default false
enrolled_at:       bigint
modules:           jsonb       NOT NULL  default '[]'
created_at:        timestamptz NOT NULL  default now()
updated_at:        timestamptz NOT NULL  default now()
```

---

## public.cron_log

```
id:            bigint      NOT NULL  default nextval('cron_log_id_seq')
job:           text        NOT NULL
started_at:    timestamptz NOT NULL  default now()
finished_at:   timestamptz
processed:     integer     NOT NULL  default 0
status:        text        NOT NULL  default 'running'
error_message: text
metadata:      jsonb
```

---

## public.flows

```
id:           uuid        NOT NULL  default gen_random_uuid()
name:         text        NOT NULL
bot:          text        NOT NULL  default ''  (legado — string do username)
bot_color:    text        NOT NULL  default '#6366f1'
status:       text        NOT NULL  default 'draft'
executions:   integer     NOT NULL  default 0
conversion:   numeric     NOT NULL  default 0
description:  text        NOT NULL  default ''
nodes:        jsonb       NOT NULL  default '[]'
edges:        jsonb       NOT NULL  default '[]'
created_at:   timestamptz NOT NULL  default now()
updated_at:   timestamptz NOT NULL  default now()
user_id:      uuid        FK → auth.users(id)
trigger_type: text        NOT NULL  default 'start'
keywords:     text[]      NOT NULL  default '{}'
```

---

## public.gateways

```
id:               text        NOT NULL  default gen_random_uuid()::text
name:             text        NOT NULL
connected:        boolean     NOT NULL  default false
account:          text
api_key:          text
processed_volume: numeric     NOT NULL  default 0
processed_tx:     integer     NOT NULL  default 0
created_at:       timestamptz NOT NULL  default now()
updated_at:       timestamptz NOT NULL  default now()
user_id:          uuid        FK → auth.users(id)
provider:         text
status:           text        NOT NULL  default 'pending'
credentials:      jsonb       NOT NULL  default '{}'
account_id:       uuid        FK → bank_accounts(id)  ON DELETE SET NULL
token_expires_at: timestamptz           (NULL = token manual sem expiração definida)
```

CONSTRAINT: `gateways_user_provider_key UNIQUE (user_id, provider)` — permite upsert onConflict
RLS: `gateways_owner` → `auth.uid() = user_id` (migração 074 — substituiu policy open)

Coluna `credentials` armazena:
- Conexão manual: `{ token: "enc:<iv>:<tag>:<cipher>" }`
- Conexão OAuth:  `{ token: "enc:...", account_info: "email@user.com", oauth: true }`

Coluna `token_expires_at`:
- Preenchida pelo callback OAuth = `now() + 180 dias` (limite do MP OAuth)
- Zerada para NULL ao desconectar (`disconnectGatewayAction`)
- NULL = conexão manual (sem expiração definida)
- Migração 075: `alter table public.gateways add column if not exists token_expires_at timestamptz`

RPC `gateways_stats(p_user_id uuid)` → `json`:
```json
{ "mercadopago": { "volume_30d": 1500.00, "tx_30d": 12, "avg_fee_pct": 0.99 } }
```

---

## public.guide_articles

```
id:         text        NOT NULL  default gen_random_uuid()::text
title:      text        NOT NULL  default ''
excerpt:    text        NOT NULL  default ''
category:   text        NOT NULL  default ''
read_min:   integer     NOT NULL  default 5
views:      integer     NOT NULL  default 0
featured:   boolean     NOT NULL  default false
body:       text        NOT NULL  default ''
created_at: timestamptz NOT NULL  default now()
updated_at: timestamptz NOT NULL  default now()
```

---

## public.invoices

```
id:           uuid        NOT NULL  default gen_random_uuid()
user_id:      uuid        NOT NULL  FK → auth.users(id)
period:       text        NOT NULL
period_start: date        NOT NULL
period_end:   date        NOT NULL
value:        numeric     NOT NULL  default 0
due_date:     date        NOT NULL
status:       text        NOT NULL  default 'pending'
paid_at:      timestamptz
notes:        text
created_at:   timestamptz NOT NULL  default now()
```

---

## public.notification_prefs

```
id:            text        NOT NULL  default gen_random_uuid()::text
prefs:         jsonb       NOT NULL  default '{}'
channel_state: jsonb       NOT NULL  default '{"email":{"linked":true},"panel":{"linked":true},"telegram":{"linked":false}}'
quiet:         jsonb       NOT NULL  default '{"to":"07:00","from":"22:00","enabled":true,"exceptCritical":true}'
created_at:    timestamptz NOT NULL  default now()
updated_at:    timestamptz NOT NULL  default now()
user_id:       uuid        FK → auth.users(id)  UNIQUE
```

CONSTRAINT: `notification_prefs_user_id_key UNIQUE (user_id)`

---

## public.pixels

```
id:           uuid        NOT NULL  default gen_random_uuid()
user_id:      uuid        NOT NULL  FK → auth.users(id)  ON DELETE CASCADE
provider:     text        NOT NULL  check in ('meta', 'tiktok', 'google')
pixel_id:     text                  (ID do pixel/advertiser/measurement)
pixel_code:   text                  (TikTok Pixel Code — distinto do Advertiser ID em pixel_id) [migração 077]
access_token: text                  (criptografado AES-256-GCM — enc:<iv>:<tag>:<cipher>)
status:       text        NOT NULL  default 'inactive'  check in ('healthy','warning','error','inactive')
events:       jsonb       NOT NULL  default '{}'        (mapa evento→boolean)
capi:         boolean     NOT NULL  default false
last_test_at: timestamptz           (timestamp do último evento de teste enviado) [migração 077]
created_at:   timestamptz NOT NULL  default now()
updated_at:   timestamptz NOT NULL  default now()
```

CONSTRAINT: `pixels_user_provider_key UNIQUE (user_id, provider)` — 1 row por provider por usuário
RLS: `pixels_owner` → `auth.uid() = user_id` (migração 076 — substituiu schema com IDOR crítico)
Trigger: `pixels_updated_at` (chama `set_updated_at()`)

**Migração 076** corrigiu problemas críticos do schema anterior:
- PK era `text` ('meta'|'tiktok'|'google') → colisão entre usuários
- RLS `pixels_open` (`using true`) → IDOR crítico
- `access_token` em plain text → agora criptografado pela app
- Sem `UNIQUE(user_id, provider)` → agora garantido em nível de banco

**Migração 077** adicionou:
- `pixel_code text`: TikTok Pixel Code — campo separado do Advertiser ID (`pixel_id`). Usado para envio de eventos via Events API (`/pixel/track/`). O Advertiser ID continua em `pixel_id` para verificação da conta via `/pixel/list/`.
- `last_test_at timestamptz`: timestamp do último evento de teste enviado com sucesso via VerifyPixelModal. Exibido no PixelCard como "Último teste: há Xh".

RPC `pixels_stats(p_user_id uuid)` → `json`:
```json
{ "events_sent_today": 5, "events_matched": 3, "last_event": "2026-05-21T12:34:56Z" }
```
- `events_sent_today`: count de `checkout_events` nas últimas 24h
- `events_matched`: subset com contato que tem email ou phone
- `last_event`: MAX(created_at) de checkout_events para o user
- Stats são globais por usuário (todos os providers compartilham o mesmo pool de eventos)

---

## public.profiles

```
id:                uuid        NOT NULL  FK → auth.users(id)  (= auth.users.id)
name:              text        NOT NULL  default ''
email:             text        NOT NULL  default ''
phone:             text        NOT NULL  default ''
avatar_url:        text        NOT NULL  default ''
avatar_color:      text        NOT NULL  default '#7c3aed'
timezone:          text        NOT NULL  default 'America/Sao_Paulo (GMT-03)'
language:          text        NOT NULL  default 'Português (Brasil)'
workspace:         text        NOT NULL  default ''
two_fa_enabled:    boolean     NOT NULL  default false
two_fa_enabled_at: bigint
plan:              text        NOT NULL  default 'free'
created_at:        timestamptz NOT NULL  default now()
updated_at:        timestamptz NOT NULL  default now()
balance:           numeric     NOT NULL  default 0
```

---

## public.push_subscriptions

```
id:           uuid        NOT NULL  default gen_random_uuid()
user_id:      uuid        NOT NULL  FK → auth.users(id)
subscription: jsonb       NOT NULL
created_at:   timestamptz NOT NULL  default now()
updated_at:   timestamptz NOT NULL  default now()
```

---

## public.redirect_click_events

```
id:          uuid        NOT NULL  default gen_random_uuid()
redirect_id: uuid        NOT NULL  FK → redirects(id)
user_id:     uuid        NOT NULL  FK → auth.users(id)
ip_hash:     text        (SHA-256 truncado 16 chars — sem IP real)
referrer:    text
device_type: text
clicked_at:  timestamptz NOT NULL  default now()
```

---

## public.redirects

```
id:                uuid        NOT NULL  default gen_random_uuid()
slug:              text        NOT NULL  UNIQUE
destination:       text        NOT NULL
destination_label: text        NOT NULL  default ''
clicks:            integer     NOT NULL  default 0
unique_clicks:     integer     NOT NULL  default 0
status:            text        NOT NULL  default 'active'
cloaking:          boolean     NOT NULL  default false
decoy_url:         text
utm:               jsonb
redirect_type:     text        NOT NULL  default '302'
created_at:        timestamptz NOT NULL  default now()
updated_at:        timestamptz NOT NULL  default now()
user_id:           uuid        NOT NULL  FK → auth.users(id)
```

---

## public.remarketing_campaigns

```
id:               uuid        NOT NULL  default gen_random_uuid()
name:             text        NOT NULL
description:      text        NOT NULL  default ''
trigger_type:     text        NOT NULL  default 'carrinho_abandonado'
audience:         text        NOT NULL  default 'all'
trigger_config:   jsonb       NOT NULL  default '{}'
status:           text        NOT NULL  default 'draft'
leads_recovered:  integer     NOT NULL  default 0
revenue_recovered:numeric     NOT NULL  default 0
leads_triggered:  integer     NOT NULL  default 0
conversion:       numeric     NOT NULL  default 0
steps:            jsonb       NOT NULL  default '[]'
step_stats:       jsonb       NOT NULL  default '[]'
created_at:       timestamptz NOT NULL  default now()
updated_at:       timestamptz NOT NULL  default now()
user_id:          uuid        FK → auth.users(id)
bot_id:           uuid        FK → bots(id)
last_run_at:      timestamptz
total_sent:       integer     NOT NULL  default 0
next_run_at:      timestamptz
```

---

## public.remarketing_executions

```
id:           uuid        NOT NULL  default gen_random_uuid()
campaign_id:  uuid        NOT NULL  FK → remarketing_campaigns(id)
user_id:      uuid        NOT NULL  FK → auth.users(id)
contact_id:   uuid        FK → contacts(id)
bot_id:       uuid        FK → bots(id)
step_index:   integer     NOT NULL  default 0
status:       text        NOT NULL  default 'pending'
message_sent: text
error_message:text
scheduled_at: timestamptz NOT NULL  default now()
executed_at:  timestamptz
created_at:   timestamptz NOT NULL  default now()
```

---

## public.team_members

```
id:         text        NOT NULL  default gen_random_uuid()::text
name:       text        NOT NULL  default ''
email:      text        NOT NULL
avatar:     text        NOT NULL  default ''
color:      text        NOT NULL  default '#7c3aed'
role:       text        NOT NULL  default 'editor'
status:     text        NOT NULL  default 'invited'
last_seen:  bigint
joined_at:  bigint      NOT NULL  default EXTRACT(epoch FROM now())::bigint * 1000
self:       boolean     NOT NULL  default false
created_at: timestamptz NOT NULL  default now()
updated_at: timestamptz NOT NULL  default now()
```

---

## public.transactions

```
id:                   uuid        NOT NULL  default gen_random_uuid()
user_id:              uuid        NOT NULL  FK → auth.users(id)
bot_id:               uuid        FK → bots(id)
contact_id:           uuid        FK → contacts(id)
checkout_id:          text        FK → checkouts(id)  ON DELETE SET NULL  [migração 079]
gateway:              text        NOT NULL  default ''
gateway_payment_id:   text
amount:               numeric     NOT NULL
fee:                  numeric     NOT NULL  default 0
net:                  numeric
status:               text        NOT NULL  default 'pending'
pix_qr_code:          text
pix_copy_paste:       text
pix_expires_at:       timestamptz
product_name:         text        NOT NULL  default ''
customer_name:        text
customer_email:       text
customer_phone:       text                  [migração 079]
customer_telegram_id: text
metadata:             jsonb       NOT NULL  default '{}'
created_at:           timestamptz NOT NULL  default now()
updated_at:           timestamptz NOT NULL  default now()
utm_source:           text
utm_medium:           text
utm_campaign:         text
utm_content:          text
flow_id:              uuid        FK → flows(id)
type:                 text        NOT NULL  default 'sale'
payment_method:       text        NOT NULL  default 'pix'
affiliate_id:         uuid        FK → affiliates(id)
customer_device:      text        check in ('mobile', 'desktop', 'tablet', 'unknown')  [migração 087]
```

**Colunas adicionadas por migração:**
- Migração 079: `checkout_id text FK → checkouts(id)` — vincula transação ao checkout público que gerou o pagamento; preenchido pelo `/api/checkout/pay` ao criar o PIX
- Migração 079: `customer_phone text` — telefone do comprador (colhido no formulário quando campo habilitado)
- Migração 087: `customer_device text` — dispositivo detectado via `User-Agent` do comprador (`detectDevice()` em `/api/checkout/pay`); valores: `mobile`, `desktop`, `tablet`, `unknown`

---

## public.webhooks

```
id:             text        NOT NULL
name:           text        NOT NULL
url:            text        NOT NULL
events:         text[]      NOT NULL  default '{}'
secret:         text        NOT NULL  default ''
status:         text        NOT NULL  default 'healthy'
active:         boolean     NOT NULL  default true
deliveries_24h: integer     NOT NULL  default 0
success_rate:   numeric     NOT NULL  default 100
last_delivery:  bigint
created_at:     timestamptz NOT NULL  default now()
updated_at:     timestamptz NOT NULL  default now()
user_id:        uuid        FK → auth.users(id)
```

---

## public.withdrawals

```
id:            uuid        NOT NULL  default gen_random_uuid()
user_id:       uuid        NOT NULL  FK → auth.users(id)
amount:        numeric     NOT NULL
account_id:    uuid        FK → bank_accounts(id)
account_label: text        NOT NULL
status:        text        NOT NULL  default 'pending'
created_at:    timestamptz NOT NULL  default now()
concluded_at:  timestamptz
notes:         text
requester_ip:  text
payout_tx_id:  text
processed_by:  text
```

---

## Relações entre tabelas

```
auth.users
  ├── profiles           (id = auth.users.id)
  ├── bots               (user_id) ──────────────────────────────────────┐
  │     └── active_flow_id → flows(id)                                   │
  ├── contacts           (user_id)                                        │
  │     ├── bot_id       → bots(id) ◄─────────────────────────────────────┘
  │     └── flow_id      → flows(id)
  ├── transactions       (user_id)
  │     ├── bot_id       → bots(id)
  │     ├── contact_id   → contacts(id)
  │     ├── flow_id      → flows(id)
  │     ├── affiliate_id → affiliates(id)
  │     └── checkout_id  → checkouts(id)  [mig 079]
  ├── flows              (user_id)
  ├── broadcasts         (user_id)  bot_id → bots(id)
  ├── activity_events    (user_id)  bot_id → bots(id)  contact_id → contacts(id)
  ├── alerts             (user_id)
  ├── checkout_events    (user_id)  bot_id / flow_id / contact_id / transaction_id / checkout_id [mig 078]
  ├── affiliates         (user_id)
  │     └── affiliate_payments (affiliate_id)
  ├── affiliate_config   (user_id)
  ├── redirects          (user_id)
  │     └── redirect_click_events (redirect_id)
  ├── remarketing_campaigns (user_id)  bot_id → bots(id)
  │     └── remarketing_executions (campaign_id)  contact_id / bot_id
  ├── gateways           (user_id)
  ├── bank_accounts      (user_id)
  │     └── withdrawals.account_id → bank_accounts(id)
  ├── withdrawals        (user_id)
  ├── invoices           (user_id)
  ├── push_subscriptions (user_id)
  ├── notification_prefs (user_id)
  ├── biolinks           (user_id)
  ├── checkouts          (user_id)
  │     └── checkout_coupons (user_id)  checkout_id → checkouts(id)  [mig 086]
  ├── pixels             (user_id)
  └── webhooks           (user_id)
```
