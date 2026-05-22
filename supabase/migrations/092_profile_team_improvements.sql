-- ============================================================
-- Umbra Bot — Melhoras na aba Perfil
-- 1. Adiciona avatar_initials em profiles (iniciais customizáveis)
-- 2. Corrige team_members: user_id FK + RLS por dono + unique por usuário
-- ============================================================

-- === profiles: coluna de iniciais customizadas ===
alter table public.profiles
  add column if not exists avatar_initials text not null default '';

-- === team_members: adiciona user_id (isolamento por usuário) ===
alter table public.team_members
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Remove dados mock (tabela nunca teve funcionalidade real)
truncate public.team_members;

-- user_id obrigatório (seguro após truncate)
alter table public.team_members alter column user_id set not null;

-- Substitui unique global de email por unique por usuário
alter table public.team_members drop constraint if exists team_members_email_key;
alter table public.team_members drop constraint if exists team_members_user_email_key;
alter table public.team_members
  add constraint team_members_user_email_key unique (user_id, email);

-- Índice para queries por user_id
create index if not exists team_members_user_id_idx on public.team_members (user_id);

-- Substitui RLS aberta (using true) por política de dono
drop policy if exists "team_members_open" on public.team_members;
create policy "team_members_owner" on public.team_members
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
