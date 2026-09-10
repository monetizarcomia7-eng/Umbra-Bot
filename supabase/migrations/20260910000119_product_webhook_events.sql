-- Umbra Bot — eventos selecionáveis e histórico de integrações SaaS
alter table public.products add column if not exists webhook_events text[] not null default array['purchase_approved']::text[];

alter table public.transactions drop constraint if exists transactions_status_check;
alter table public.transactions add constraint transactions_status_check
  check (status in ('pending','approved','refunded','cancelled','expired','chargeback'));

alter table public.product_subscriptions drop constraint if exists product_subscriptions_status_check;
alter table public.product_subscriptions add constraint product_subscriptions_status_check
  check (status in ('active','trial','unpaid','waiting_payment','paused','canceled','ended'));

create table if not exists public.product_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  resource_id text not null,
  payload jsonb not null default '{}'::jsonb,
  response_status integer,
  response_body text,
  attempt integer not null default 1 check (attempt between 1 and 5),
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists product_webhook_deliveries_product_created_idx on public.product_webhook_deliveries(product_id,created_at desc);
create index if not exists product_webhook_deliveries_user_created_idx on public.product_webhook_deliveries(user_id,created_at desc);
alter table public.product_webhook_deliveries enable row level security;
drop policy if exists product_webhook_deliveries_owner on public.product_webhook_deliveries;
create policy product_webhook_deliveries_owner on public.product_webhook_deliveries for select to authenticated
  using ((select auth.uid()) = user_id);
