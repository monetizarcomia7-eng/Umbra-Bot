-- ============================================================
-- Umbra Bot — Tabela: guide_articles
-- Rota: /dashboard/guide
-- ============================================================

create table if not exists public.guide_articles (
  id          text        primary key default gen_random_uuid()::text,
  title       text        not null default '',
  excerpt     text        not null default '',
  category    text        not null default '',
  read_min    integer     not null default 5,
  views       integer     not null default 0,
  featured    boolean     not null default false,
  body        text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists guide_articles_category_idx    on public.guide_articles (category);
create index if not exists guide_articles_featured_idx    on public.guide_articles (featured);
create index if not exists guide_articles_updated_at_idx  on public.guide_articles (updated_at desc);

create or replace trigger guide_articles_updated_at
  before update on public.guide_articles
  for each row execute function public.set_updated_at();

alter table public.guide_articles enable row level security;
drop policy if exists "guide_articles_open" on public.guide_articles;
create policy "guide_articles_open" on public.guide_articles for all using (true) with check (true);
