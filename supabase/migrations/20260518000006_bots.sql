-- ============================================================
-- Umbra Bot — Tabela: bots
-- Rota: /dashboard/bots
-- ============================================================

create table if not exists public.bots (
  id               uuid          primary key default gen_random_uuid(),
  name             text          not null,
  username         text          not null,
  status           text          not null default 'offline'
                     check (status in ('online', 'offline', 'banned', 'paused')),
  leads            integer       not null default 0,
  sales            integer       not null default 0,
  conversion       numeric(5,2)  not null default 0,
  revenue          numeric(12,2) not null default 0,
  active_flow_id   uuid,
  color            text          not null default '#6366f1',
  telegram_id      text,
  token            text,
  welcome_message  text          not null default '',
  fallback_message text          not null default '',
  description      text          not null default '',
  webhook_url      text          not null default '',
  last_sync        timestamptz,
  added_at         timestamptz   not null default now(),
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

create index if not exists bots_status_idx   on public.bots (status);
create index if not exists bots_username_idx on public.bots (username);
create index if not exists bots_revenue_idx  on public.bots (revenue desc);

create or replace trigger bots_updated_at
  before update on public.bots
  for each row execute function public.set_updated_at();

alter table public.bots enable row level security;
drop policy if exists "bots_open" on public.bots;
create policy "bots_open" on public.bots for all using (true) with check (true);
