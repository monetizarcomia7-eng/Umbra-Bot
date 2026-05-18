-- ============================================================
-- Umbra Bot — Tabela: biolinks
-- Rota: /dashboard/biolink
-- ============================================================

create table if not exists public.biolinks (
  id            text        primary key,
  slug          text        not null unique,
  name          text        not null default '',
  bio           text        not null default '',
  avatar        text        not null default '',
  avatar_color  text        not null default '#7c3aed',
  theme_id      text        not null default 'violet',
  background    text        not null default 'solid'
                  check (background in ('solid', 'gradient', 'dots')),
  button_style  text        not null default 'rounded'
                  check (button_style in ('rounded', 'sharp', 'pill')),
  links         jsonb       not null default '[]',
  views         integer     not null default 0,
  clicks        integer     not null default 0,
  conversion    numeric(5,2) not null default 0,
  top_referrer  text        not null default '',
  status        text        not null default 'draft'
                  check (status in ('published', 'draft')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists biolinks_slug_idx       on public.biolinks (slug);
create index if not exists biolinks_status_idx     on public.biolinks (status);
create index if not exists biolinks_updated_at_idx on public.biolinks (updated_at desc);

create or replace trigger biolinks_updated_at
  before update on public.biolinks
  for each row execute function public.set_updated_at();

alter table public.biolinks enable row level security;
drop policy if exists "biolinks_open" on public.biolinks;
create policy "biolinks_open" on public.biolinks for all using (true) with check (true);
