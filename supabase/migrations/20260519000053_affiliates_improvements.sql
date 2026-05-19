-- ============================================================
-- Umbra Bot — Affiliates improvements (migration 053)
--
-- 1. Adiciona user_id + commission_pct em affiliates + corrige RLS
-- 2. Adiciona user_id em affiliate_payments + corrige RLS
-- 3. Cria tabela affiliate_config (configuração do programa por usuário)
-- 4. Índices auxiliares
-- ============================================================

-- ── 1. affiliates ────────────────────────────────────────────

alter table public.affiliates
  add column if not exists user_id        uuid references auth.users(id) on delete cascade,
  add column if not exists commission_pct numeric(5,2) not null default 30;

create index if not exists affiliates_user_id_idx
  on public.affiliates (user_id)
  where user_id is not null;

-- Corrige RLS: era using (true) → restrita ao dono
drop policy if exists "affiliates_open"  on public.affiliates;
drop policy if exists "affiliates_owner" on public.affiliates;
create policy "affiliates_owner" on public.affiliates
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 2. affiliate_payments ────────────────────────────────────

alter table public.affiliate_payments
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists aff_payments_user_id_idx
  on public.affiliate_payments (user_id)
  where user_id is not null;

-- Corrige RLS
drop policy if exists "affiliate_payments_open"  on public.affiliate_payments;
drop policy if exists "affiliate_payments_owner" on public.affiliate_payments;
create policy "affiliate_payments_owner" on public.affiliate_payments
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 3. affiliate_config ──────────────────────────────────────

create table if not exists public.affiliate_config (
  id                    uuid          primary key default gen_random_uuid(),
  user_id               uuid          not null unique references auth.users(id) on delete cascade,
  percentage            numeric(5,2)  not null default 30,
  attribution_rule      text          not null default 'last_click'
                          check (attribution_rule in ('first_click', 'last_click')),
  cookie_window         integer       not null default 30,
  upsell_commissions    boolean       not null default true,
  recurring_commissions boolean       not null default false,
  auto_payment          boolean       not null default false,
  min_payout            numeric(10,2) not null default 100,
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now()
);

alter table public.affiliate_config enable row level security;

drop policy if exists "affiliate_config_owner" on public.affiliate_config;
create policy "affiliate_config_owner" on public.affiliate_config
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace trigger affiliate_config_updated_at
  before update on public.affiliate_config
  for each row execute function public.set_updated_at();

create index if not exists affiliate_config_user_id_idx
  on public.affiliate_config (user_id);
