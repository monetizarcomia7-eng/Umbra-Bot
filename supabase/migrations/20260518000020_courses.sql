-- ============================================================
-- Umbra Bot — Tabela: courses
-- Rota: /dashboard/academy
-- ============================================================

create table if not exists public.courses (
  id                text        primary key default gen_random_uuid()::text,
  title             text        not null default '',
  subtitle          text        not null default '',
  instructor        text        not null default '',
  instructor_role   text        not null default '',
  instructor_avatar text        not null default '',
  level             text        not null default 'Iniciante',
  duration_min      integer     not null default 60,
  cover_accent      text        not null default 'var(--primary)',
  cover_pattern     text        not null default 'wave'
                      check (cover_pattern in ('wave','grid','rays','dots','mesh')),
  featured          boolean     not null default false,
  enrolled_at       bigint,
  modules           jsonb       not null default '[]',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists courses_featured_idx    on public.courses (featured);
create index if not exists courses_updated_at_idx  on public.courses (updated_at desc);

create or replace trigger courses_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

alter table public.courses enable row level security;
drop policy if exists "courses_open" on public.courses;
create policy "courses_open" on public.courses for all using (true) with check (true);
