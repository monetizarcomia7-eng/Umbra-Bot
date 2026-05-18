-- ============================================================
-- Umbra Bot — Tabela: profiles
-- Rota: /dashboard/profile
-- ============================================================

create table if not exists public.profiles (
  id            text        primary key default gen_random_uuid()::text,
  name          text        not null default '',
  email         text        not null default '',
  phone         text        not null default '',
  avatar        text        not null default '',
  avatar_color  text        not null default '#7c3aed',
  timezone      text        not null default 'America/Sao_Paulo (GMT-03)',
  language      text        not null default 'Português (Brasil)',
  workspace     text        not null default '',
  two_fa_enabled   boolean  not null default false,
  two_fa_enabled_at bigint,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_email_idx      on public.profiles (email);
create index if not exists profiles_updated_at_idx on public.profiles (updated_at desc);

create or replace trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
drop policy if exists "profiles_open" on public.profiles;
create policy "profiles_open" on public.profiles for all using (true) with check (true);
