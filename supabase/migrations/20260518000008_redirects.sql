-- ============================================================
-- Umbra Bot — Tabela: redirects
-- Rota: /dashboard/redirects
-- ============================================================

create table if not exists public.redirects (
  id                uuid          primary key default gen_random_uuid(),
  slug              text          not null unique,
  url               text          not null,
  destination       text          not null,
  destination_label text          not null default '',
  clicks            integer       not null default 0,
  unique_clicks     integer       not null default 0,
  status            text          not null default 'active'
                      check (status in ('active', 'paused', 'archived')),
  cloaking          boolean       not null default false,
  decoy_url         text,
  utm               jsonb         not null default '{}',
  redirect_type     text          not null default '302'
                      check (redirect_type in ('301', '302', 'js', 'meta')),
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

create index if not exists redirects_status_idx     on public.redirects (status);
create index if not exists redirects_slug_idx       on public.redirects (slug);
create index if not exists redirects_clicks_idx     on public.redirects (clicks desc);
create index if not exists redirects_created_at_idx on public.redirects (created_at desc);

create or replace trigger redirects_updated_at
  before update on public.redirects
  for each row execute function public.set_updated_at();

alter table public.redirects enable row level security;
drop policy if exists "redirects_open" on public.redirects;
create policy "redirects_open" on public.redirects for all using (true) with check (true);
