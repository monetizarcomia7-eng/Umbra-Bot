-- ============================================================
-- Umbra Bot — Profiles vinculados ao auth.users
-- Recria a tabela profiles com UUID como PK (= auth user id)
-- e adiciona trigger para criação automática no signup.
-- ============================================================

-- Recriar profiles com id = auth.users.id
drop table if exists public.profiles cascade;

create table public.profiles (
  id            uuid        primary key references auth.users(id) on delete cascade,
  name          text        not null default '',
  email         text        not null default '',
  phone         text        not null default '',
  avatar_url    text        not null default '',
  avatar_color  text        not null default '#7c3aed',
  timezone      text        not null default 'America/Sao_Paulo (GMT-03)',
  language      text        not null default 'Português (Brasil)',
  workspace     text        not null default '',
  two_fa_enabled   boolean  not null default false,
  two_fa_enabled_at bigint,
  plan          text        not null default 'free' check (plan in ('free','pro','enterprise')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);

create or replace trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Cada usuário só vê e edita o próprio perfil
create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Trigger: cria perfil automaticamente quando um novo usuário se registra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
