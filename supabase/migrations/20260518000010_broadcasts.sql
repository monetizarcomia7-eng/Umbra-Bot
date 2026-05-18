-- ============================================================
-- Umbra Bot — Tabela: broadcasts
-- Rota: /dashboard/broadcasts
-- ============================================================

create table if not exists public.broadcasts (
  id             uuid          primary key default gen_random_uuid(),
  title          text          not null default 'Novo disparo',
  bot            text          not null default '',
  audience       text          not null default 'leads',
  audience_count integer       not null default 0,
  status         text          not null default 'draft'
                   check (status in ('draft', 'scheduled', 'sending', 'done', 'failed', 'canceled')),
  sent           integer       not null default 0,
  delivered      integer       not null default 0,
  failed         integer       not null default 0,
  scheduled_for  bigint,
  started_at     bigint,
  finished_at    bigint,
  failure_reason text,
  message        text          not null default '',
  media          jsonb,
  buttons        jsonb         not null default '[]',
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now()
);

create index if not exists broadcasts_status_idx     on public.broadcasts (status);
create index if not exists broadcasts_bot_idx        on public.broadcasts (bot);
create index if not exists broadcasts_created_at_idx on public.broadcasts (created_at desc);

create or replace trigger broadcasts_updated_at
  before update on public.broadcasts
  for each row execute function public.set_updated_at();

alter table public.broadcasts enable row level security;
drop policy if exists "broadcasts_open" on public.broadcasts;
create policy "broadcasts_open" on public.broadcasts for all using (true) with check (true);
