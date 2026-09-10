-- Umbra Bot — Produtos, parcerias, assinaturas e integração SaaS

create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  short_id            text not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 7),
  name                text not null,
  description         text not null default '',
  image_url           text,
  price               numeric(12,2) not null default 0 check (price >= 0),
  payment_type        text not null default 'unique' check (payment_type in ('unique','recurring')),
  subscription_period integer not null default 1 check (subscription_period between 1 and 24),
  delivery_type       text not null default 'umbra_members' check (delivery_type in ('umbra_members','external_members','in_person','payments_only','saas')),
  members_area_name   text,
  external_url        text,
  support_email       text not null default '',
  invoice_description text not null default '',
  status              text not null default 'draft' check (status in ('draft','active','archived')),
  webhook_url         text,
  webhook_secret      uuid not null default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, short_id)
);

create table if not exists public.product_partnerships (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products(id) on delete cascade,
  producer_id      uuid not null references auth.users(id) on delete cascade,
  partner_id       uuid references auth.users(id) on delete cascade,
  partner_email    text not null,
  role             text not null check (role in ('coproducer','affiliate')),
  commission_pct   numeric(5,2) not null check (commission_pct between 0 and 100),
  status           text not null default 'pending' check (status in ('pending','active','rejected','canceled','expired')),
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (product_id, partner_email, role)
);

create table if not exists public.product_subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  product_id              uuid not null references public.products(id) on delete restrict,
  producer_id             uuid not null references auth.users(id) on delete cascade,
  customer_name           text not null,
  customer_email          text not null,
  status                  text not null default 'waiting_payment' check (status in ('active','trial','unpaid','waiting_payment','canceled','ended')),
  gross_amount            numeric(12,2) not null default 0 check (gross_amount >= 0),
  net_amount              numeric(12,2) not null default 0 check (net_amount >= 0),
  gateway                 text,
  gateway_subscription_id text,
  started_at              timestamptz not null default now(),
  next_billing_at         timestamptz,
  canceled_at             timestamptz,
  ended_at                timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.checkouts add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.transactions add column if not exists product_id uuid references public.products(id) on delete set null;

create index if not exists products_user_status_updated_idx on public.products (user_id, status, updated_at desc);
create index if not exists product_partnerships_partner_role_idx on public.product_partnerships (partner_id, role, created_at desc);
create index if not exists product_partnerships_producer_role_idx on public.product_partnerships (producer_id, role, created_at desc);
create index if not exists product_partnerships_product_idx on public.product_partnerships (product_id);
create index if not exists product_subscriptions_producer_status_idx on public.product_subscriptions (producer_id, status, started_at desc);
create index if not exists product_subscriptions_product_idx on public.product_subscriptions (product_id);
create index if not exists checkouts_product_id_idx on public.checkouts (product_id) where product_id is not null;
create index if not exists transactions_product_id_idx on public.transactions (product_id) where product_id is not null;

alter table public.products enable row level security;
alter table public.product_partnerships enable row level security;
alter table public.product_subscriptions enable row level security;

drop policy if exists products_owner on public.products;
create policy products_owner on public.products for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists product_partnerships_visible on public.product_partnerships;
create policy product_partnerships_visible on public.product_partnerships for select to authenticated
  using ((select auth.uid()) = producer_id or (select auth.uid()) = partner_id);
drop policy if exists product_partnerships_producer_write on public.product_partnerships;
create policy product_partnerships_producer_write on public.product_partnerships for all to authenticated
  using ((select auth.uid()) = producer_id) with check ((select auth.uid()) = producer_id);

drop policy if exists product_subscriptions_owner on public.product_subscriptions;
create policy product_subscriptions_owner on public.product_subscriptions for all to authenticated
  using ((select auth.uid()) = producer_id) with check ((select auth.uid()) = producer_id);

create or replace trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create or replace trigger product_partnerships_updated_at before update on public.product_partnerships
  for each row execute function public.set_updated_at();
create or replace trigger product_subscriptions_updated_at before update on public.product_subscriptions
  for each row execute function public.set_updated_at();
