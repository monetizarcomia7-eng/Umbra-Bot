-- ============================================================
-- Umbra Bot — Tabela: webhooks
-- Rota: /dashboard/webhooks
-- ============================================================

create table if not exists public.webhooks (
  id              text        primary key,
  name            text        not null,
  url             text        not null,
  events          text[]      not null default '{}',
  secret          text        not null default '',
  status          text        not null default 'healthy'
                    check (status in ('healthy', 'failing', 'paused')),
  active          boolean     not null default true,
  deliveries_24h  integer     not null default 0,
  success_rate    numeric(5,2) not null default 100,
  last_delivery   bigint,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists webhooks_status_idx     on public.webhooks (status);
create index if not exists webhooks_active_idx     on public.webhooks (active);
create index if not exists webhooks_updated_at_idx on public.webhooks (updated_at desc);

create or replace trigger webhooks_updated_at
  before update on public.webhooks
  for each row execute function public.set_updated_at();

alter table public.webhooks enable row level security;
drop policy if exists "webhooks_open" on public.webhooks;
create policy "webhooks_open" on public.webhooks for all using (true) with check (true);
