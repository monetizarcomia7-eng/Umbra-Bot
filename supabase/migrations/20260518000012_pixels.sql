-- ============================================================
-- Umbra Bot — Tabela: pixels
-- Rota: /dashboard/tracking
-- ============================================================

create table if not exists public.pixels (
  id                 text          primary key,
  name               text          not null,
  full_name          text          not null default '',
  description        text          not null default '',
  initial            text          not null default '',
  color              text          not null default '',
  pixel_id           text,
  access_token       text,
  status             text          not null default 'inactive'
                       check (status in ('healthy', 'warning', 'error', 'inactive')),
  events_sent_today  integer       not null default 0,
  events_matched     integer       not null default 0,
  last_event         bigint,
  events             jsonb         not null default '{}',
  capi               boolean       not null default false,
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now()
);

create index if not exists pixels_status_idx on public.pixels (status);

create or replace trigger pixels_updated_at
  before update on public.pixels
  for each row execute function public.set_updated_at();

alter table public.pixels enable row level security;
drop policy if exists "pixels_open" on public.pixels;
create policy "pixels_open" on public.pixels for all using (true) with check (true);
