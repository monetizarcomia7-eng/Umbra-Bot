-- ============================================================
-- Umbra Bot — Tabela: gateways
-- Rota: /dashboard/gateways
-- ============================================================

create table if not exists public.gateways (
  id               text          primary key,
  name             text          not null,
  connected        boolean       not null default false,
  account          text,
  api_key          text,
  processed_volume numeric(14,2) not null default 0,
  processed_tx     integer       not null default 0,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

create index if not exists gateways_connected_idx on public.gateways (connected);

create or replace trigger gateways_updated_at
  before update on public.gateways
  for each row execute function public.set_updated_at();

alter table public.gateways enable row level security;
drop policy if exists "gateways_open" on public.gateways;
create policy "gateways_open" on public.gateways for all using (true) with check (true);
