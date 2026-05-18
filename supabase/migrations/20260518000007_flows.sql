-- ============================================================
-- Umbra Bot — Tabela: flows
-- Rota: /dashboard/flows
-- ============================================================

create table if not exists public.flows (
  id          uuid          primary key default gen_random_uuid(),
  name        text          not null,
  bot         text          not null default '',
  bot_color   text          not null default '#6366f1',
  status      text          not null default 'draft'
                check (status in ('published', 'draft')),
  executions  integer       not null default 0,
  conversion  numeric(5,2)  not null default 0,
  description text          not null default '',
  nodes       jsonb         not null default '[]',
  edges       jsonb         not null default '[]',
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

create index if not exists flows_status_idx     on public.flows (status);
create index if not exists flows_bot_idx        on public.flows (bot);
create index if not exists flows_updated_at_idx on public.flows (updated_at desc);

create or replace trigger flows_updated_at
  before update on public.flows
  for each row execute function public.set_updated_at();

alter table public.flows enable row level security;
drop policy if exists "flows_open" on public.flows;
create policy "flows_open" on public.flows for all using (true) with check (true);
