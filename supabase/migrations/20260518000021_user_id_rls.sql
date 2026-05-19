-- ============================================================
-- Umbra Bot — Multi-tenancy: adiciona user_id + RLS real
-- Substitui as políticas abertas (using true) por filtragem
-- por auth.uid() em todas as tabelas de dados.
-- ============================================================

-- ── bots ───────────────────────────────────────────────────
alter table public.bots
  add column if not exists user_id         uuid references auth.users(id) on delete cascade,
  add column if not exists webhook_secret  text unique default gen_random_uuid()::text;

create index if not exists bots_user_id_idx on public.bots (user_id);

drop policy if exists "bots_open"  on public.bots;
create policy "bots_owner" on public.bots
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── contacts ───────────────────────────────────────────────
alter table public.contacts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists contacts_user_id_idx on public.contacts (user_id);

drop policy if exists "contacts_open" on public.contacts;
create policy "contacts_owner" on public.contacts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── activity_events ────────────────────────────────────────
alter table public.activity_events
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists activity_events_user_id_idx on public.activity_events (user_id);

drop policy if exists "activity_events_open" on public.activity_events;
create policy "activity_events_owner" on public.activity_events
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── affiliates ─────────────────────────────────────────────
alter table public.affiliates
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists affiliates_user_id_idx on public.affiliates (user_id);

drop policy if exists "affiliates_open" on public.affiliates;
create policy "affiliates_owner" on public.affiliates
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── affiliate_payments ─────────────────────────────────────
alter table public.affiliate_payments
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

drop policy if exists "affiliate_payments_open" on public.affiliate_payments;
create policy "affiliate_payments_owner" on public.affiliate_payments
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── alerts ─────────────────────────────────────────────────
alter table public.alerts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists alerts_user_id_idx on public.alerts (user_id);

drop policy if exists "alerts_open" on public.alerts;
create policy "alerts_owner" on public.alerts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── flows ──────────────────────────────────────────────────
alter table public.flows
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists flows_user_id_idx on public.flows (user_id);

drop policy if exists "flows_open" on public.flows;
create policy "flows_owner" on public.flows
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── redirects ──────────────────────────────────────────────
alter table public.redirects
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists redirects_user_id_idx on public.redirects (user_id);

drop policy if exists "redirects_open" on public.redirects;
create policy "redirects_owner" on public.redirects
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── remarketing_campaigns ──────────────────────────────────
alter table public.remarketing_campaigns
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists remarketing_campaigns_user_id_idx on public.remarketing_campaigns (user_id);

drop policy if exists "remarketing_campaigns_open" on public.remarketing_campaigns;
create policy "remarketing_campaigns_owner" on public.remarketing_campaigns
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── broadcasts ─────────────────────────────────────────────
alter table public.broadcasts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists broadcasts_user_id_idx on public.broadcasts (user_id);

drop policy if exists "broadcasts_open" on public.broadcasts;
create policy "broadcasts_owner" on public.broadcasts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── gateways ───────────────────────────────────────────────
alter table public.gateways
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists gateways_user_id_idx on public.gateways (user_id);

drop policy if exists "gateways_open" on public.gateways;
create policy "gateways_owner" on public.gateways
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── pixels ─────────────────────────────────────────────────
alter table public.pixels
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists pixels_user_id_idx on public.pixels (user_id);

drop policy if exists "pixels_open" on public.pixels;
create policy "pixels_owner" on public.pixels
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── checkouts ──────────────────────────────────────────────
alter table public.checkouts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists checkouts_user_id_idx on public.checkouts (user_id);

drop policy if exists "checkouts_open" on public.checkouts;
create policy "checkouts_owner" on public.checkouts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── biolinks ───────────────────────────────────────────────
alter table public.biolinks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists biolinks_user_id_idx on public.biolinks (user_id);

drop policy if exists "biolinks_open" on public.biolinks;
create policy "biolinks_owner" on public.biolinks
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── webhooks ───────────────────────────────────────────────
alter table public.webhooks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists webhooks_user_id_idx on public.webhooks (user_id);

drop policy if exists "webhooks_open" on public.webhooks;
create policy "webhooks_owner" on public.webhooks
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── notification_prefs ─────────────────────────────────────
alter table public.notification_prefs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

drop policy if exists "notification_prefs_open" on public.notification_prefs;
create policy "notification_prefs_owner" on public.notification_prefs
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── transactions (nova tabela) ─────────────────────────────
create table if not exists public.transactions (
  id                 uuid          primary key default gen_random_uuid(),
  user_id            uuid          not null references auth.users(id) on delete cascade,
  bot_id             uuid          references public.bots(id) on delete set null,
  contact_id         uuid          references public.contacts(id) on delete set null,
  gateway            text          not null default '',
  gateway_payment_id text,
  amount             numeric(12,2) not null,
  fee                numeric(12,2) not null default 0,
  net                numeric(12,2),
  status             text          not null default 'pending'
                       check (status in ('pending','approved','refunded','cancelled','expired')),
  pix_qr_code        text,
  pix_copy_paste     text,
  pix_expires_at     timestamptz,
  product_name       text          not null default '',
  customer_name      text,
  customer_email     text,
  customer_telegram_id text,
  metadata           jsonb         not null default '{}',
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now()
);

create index if not exists transactions_user_id_idx    on public.transactions (user_id);
create index if not exists transactions_status_idx     on public.transactions (status);
create index if not exists transactions_created_at_idx on public.transactions (created_at desc);
create index if not exists transactions_gateway_pid_idx on public.transactions (gateway_payment_id);

create or replace trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;
create policy "transactions_owner" on public.transactions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
