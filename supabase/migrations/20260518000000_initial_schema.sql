-- ============================================================
-- Umbra Bot — Initial Schema
-- Migration: 20260518000000_initial_schema.sql
-- ============================================================
-- Tabelas referenciadas pelas páginas do dashboard.
-- Todas usam RLS (Row Level Security).
-- Por enquanto as políticas são abertas (auth ainda não implementado).
-- Quando o auth for adicionado, substituir as políticas por:
--   USING (auth.uid() = user_id)
-- ============================================================

-- Habilitar extensão uuid (disponível por padrão no Supabase)
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. CONTACTS  (página: /dashboard/customers)
-- ============================================================
-- Leads/clientes captados pelos bots do Telegram.

create table if not exists public.contacts (
  id              uuid primary key default gen_random_uuid(),

  name            text        not null,
  telegram_id     text,                       -- @username ou ID numérico
  phone           text,
  email           text,
  bot             text,                       -- nome do bot que captou o lead
  status          text        not null default 'new'
                    check (status in ('new', 'active', 'vip', 'inactive', 'blocked')),

  tags            text[]      not null default '{}',

  total_spent     numeric(12,2) not null default 0,
  orders_count    integer     not null default 0,

  city            text,
  state           text,

  first_contact   timestamptz not null default now(),
  last_contact    timestamptz not null default now(),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Índices
create index if not exists contacts_status_idx      on public.contacts (status);
create index if not exists contacts_last_contact_idx on public.contacts (last_contact desc);
create index if not exists contacts_tags_idx         on public.contacts using gin (tags);
create index if not exists contacts_telegram_id_idx  on public.contacts (telegram_id);

-- Trigger: atualiza updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- RLS
alter table public.contacts enable row level security;
create policy "contacts_open" on public.contacts for all using (true) with check (true);

-- ============================================================
-- 2. ACTIVITY_EVENTS  (página: /dashboard/activity)
-- ============================================================
-- Feed de eventos em tempo real dos bots e integrações.

create table if not exists public.activity_events (
  id          uuid primary key default gen_random_uuid(),

  type        text not null
                check (type in (
                  'sale', 'new_lead', 'checkout', 'bot_online', 'bot_offline',
                  'refund', 'webhook', 'flow', 'block', 'affiliate_join',
                  'broadcast', 'payment_fail'
                )),

  title       text        not null,
  description text        not null default '',
  bot         text        not null default '',
  amount      numeric(12,2),             -- presente em vendas/reembolsos

  created_at  timestamptz not null default now()
);

-- Índices
create index if not exists activity_events_created_at_idx on public.activity_events (created_at desc);
create index if not exists activity_events_type_idx       on public.activity_events (type);
create index if not exists activity_events_bot_idx        on public.activity_events (bot);

-- RLS
alter table public.activity_events enable row level security;
create policy "activity_events_open" on public.activity_events for all using (true) with check (true);

-- Habilitar Realtime para a tabela (necessário no Supabase Dashboard também)
-- alter publication supabase_realtime add table public.activity_events;

-- ============================================================
-- 3. AFFILIATES  (página: /dashboard/affiliates)
-- ============================================================
-- Parceiros do programa de afiliados.

create table if not exists public.affiliates (
  id              uuid primary key default gen_random_uuid(),

  name            text    not null,
  email           text    not null,
  slug            text    not null unique,      -- parte da URL de divulgação
  status          text    not null default 'active'
                    check (status in ('active', 'paused', 'archived')),

  clicks          integer     not null default 0,
  sales           integer     not null default 0,
  commission      numeric(12,2) not null default 0,  -- total acumulado
  conversion_rate numeric(5,2) not null default 0,

  payment_method  text,                   -- ex.: "Pix · chave@email.com"

  joined_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists affiliates_status_idx     on public.affiliates (status);
create index if not exists affiliates_commission_idx  on public.affiliates (commission desc);
create index if not exists affiliates_slug_idx        on public.affiliates (slug);

create trigger affiliates_updated_at
  before update on public.affiliates
  for each row execute function public.set_updated_at();

alter table public.affiliates enable row level security;
create policy "affiliates_open" on public.affiliates for all using (true) with check (true);

-- ============================================================
-- 4. AFFILIATE_PAYMENTS  (página: /dashboard/affiliates → aba Pagamentos)
-- ============================================================
-- Registro de comissões pendentes e pagas por ciclo.

create table if not exists public.affiliate_payments (
  id              uuid primary key default gen_random_uuid(),

  affiliate_id    uuid        not null references public.affiliates (id) on delete cascade,
  cycle           text        not null,   -- ex.: "maio/2026"
  sales           integer     not null default 0,
  amount          numeric(12,2) not null default 0,

  status          text        not null default 'pending'
                    check (status in ('pending', 'paid')),

  paid_at         date,                   -- data em que foi pago
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists aff_payments_affiliate_idx on public.affiliate_payments (affiliate_id);
create index if not exists aff_payments_status_idx    on public.affiliate_payments (status);
create index if not exists aff_payments_cycle_idx     on public.affiliate_payments (cycle);

create trigger affiliate_payments_updated_at
  before update on public.affiliate_payments
  for each row execute function public.set_updated_at();

alter table public.affiliate_payments enable row level security;
create policy "affiliate_payments_open" on public.affiliate_payments for all using (true) with check (true);

-- ============================================================
-- 5. ALERTS  (página: /dashboard/alerts)
-- ============================================================
-- Alertas críticos de bots, gateways e integrações.

create table if not exists public.alerts (
  id          uuid primary key default gen_random_uuid(),

  type        text not null
                check (type in (
                  'gateway_fail', 'bot_banned', 'bot_offline', 'send_quota',
                  'webhook_fail', 'payment_pending', 'limit_warning', 'ssl_expiring'
                )),

  severity    text not null default 'warning'
                check (severity in ('critical', 'warning', 'info')),

  title       text    not null,
  description text    not null default '',

  context     jsonb   not null default '[]',  -- array de { icon, label }

  resolved    boolean not null default false,
  resolved_at timestamptz,
  resolved_by text,                           -- nome do usuário ou 'auto'

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists alerts_resolved_idx   on public.alerts (resolved);
create index if not exists alerts_severity_idx   on public.alerts (severity);
create index if not exists alerts_created_at_idx on public.alerts (created_at desc);

create trigger alerts_updated_at
  before update on public.alerts
  for each row execute function public.set_updated_at();

alter table public.alerts enable row level security;
create policy "alerts_open" on public.alerts for all using (true) with check (true);

-- Habilitar Realtime
-- alter publication supabase_realtime add table public.alerts;

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
-- Para aplicar no Supabase:
--   1. Supabase Dashboard → SQL Editor → colar este arquivo
--   2. OU: supabase db push  (requer Supabase CLI)
--
-- Para habilitar Realtime nas tabelas activity_events e alerts:
--   Supabase Dashboard → Database → Replication → habilitar as tabelas
-- ============================================================
