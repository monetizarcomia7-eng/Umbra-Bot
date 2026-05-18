-- ============================================================
-- Umbra Bot — Tabela: affiliates
-- Rota: /dashboard/affiliates
-- ============================================================

create table if not exists public.affiliates (
  id              uuid          primary key default gen_random_uuid(),
  name            text          not null,
  email           text          not null,
  slug            text          not null unique,
  status          text          not null default 'active'
                    check (status in ('active', 'paused', 'archived')),
  clicks          integer       not null default 0,
  sales           integer       not null default 0,
  commission      numeric(12,2) not null default 0,
  conversion_rate numeric(5,2)  not null default 0,
  payment_method  text,
  joined_at       timestamptz   not null default now(),
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create index if not exists affiliates_status_idx     on public.affiliates (status);
create index if not exists affiliates_commission_idx on public.affiliates (commission desc);
create index if not exists affiliates_slug_idx       on public.affiliates (slug);

create or replace trigger affiliates_updated_at
  before update on public.affiliates
  for each row execute function public.set_updated_at();

alter table public.affiliates enable row level security;
drop policy if exists "affiliates_open" on public.affiliates;
create policy "affiliates_open" on public.affiliates for all using (true) with check (true);
