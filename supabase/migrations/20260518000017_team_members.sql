-- ============================================================
-- Umbra Bot — Tabela: team_members
-- Rota: /dashboard/profile (seção Equipe)
-- ============================================================

create table if not exists public.team_members (
  id          text        primary key default gen_random_uuid()::text,
  name        text        not null default '',
  email       text        not null unique,
  avatar      text        not null default '',
  color       text        not null default '#7c3aed',
  role        text        not null default 'editor'
                check (role in ('owner', 'admin', 'editor', 'analyst')),
  status      text        not null default 'invited'
                check (status in ('active', 'invited')),
  last_seen   bigint,
  joined_at   bigint      not null default extract(epoch from now())::bigint * 1000,
  self        boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists team_members_role_idx       on public.team_members (role);
create index if not exists team_members_status_idx     on public.team_members (status);
create index if not exists team_members_updated_at_idx on public.team_members (updated_at desc);

create or replace trigger team_members_updated_at
  before update on public.team_members
  for each row execute function public.set_updated_at();

alter table public.team_members enable row level security;
drop policy if exists "team_members_open" on public.team_members;
create policy "team_members_open" on public.team_members for all using (true) with check (true);
