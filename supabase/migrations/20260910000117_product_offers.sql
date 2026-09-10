-- Umbra Bot — múltiplos preços/ofertas por produto
create table if not exists public.product_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Oferta principal',
  price numeric(12,2) not null default 0 check (price >= 0),
  payment_type text not null default 'unique' check (payment_type in ('unique','recurring')),
  subscription_period integer not null default 1 check (subscription_period between 1 and 24),
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_offers_product_idx on public.product_offers (product_id, active, created_at);
create index if not exists product_offers_user_idx on public.product_offers (user_id);
create unique index if not exists product_offers_one_default_idx on public.product_offers (product_id) where is_default;
alter table public.product_offers enable row level security;
drop policy if exists product_offers_owner on public.product_offers;
create policy product_offers_owner on public.product_offers for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create or replace trigger product_offers_updated_at before update on public.product_offers
  for each row execute function public.set_updated_at();
insert into public.product_offers (product_id,user_id,name,price,payment_type,subscription_period,is_default)
select p.id,p.user_id,'Oferta principal',p.price,p.payment_type,p.subscription_period,true from public.products p
where not exists (select 1 from public.product_offers o where o.product_id=p.id);
alter table public.checkouts add column if not exists offer_id uuid references public.product_offers(id) on delete set null;
alter table public.transactions add column if not exists offer_id uuid references public.product_offers(id) on delete set null;
create index if not exists checkouts_offer_id_idx on public.checkouts (offer_id) where offer_id is not null;
create index if not exists transactions_offer_id_idx on public.transactions (offer_id) where offer_id is not null;
