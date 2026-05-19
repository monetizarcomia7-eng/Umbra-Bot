-- migration 060: notification_prefs_user_id
-- Adiciona user_id à tabela notification_prefs para suporte multi-usuário correto.
-- Fix na RLS: de política aberta (using true) para política por usuário.
-- Unique index permite upsert idempotente por user_id.

alter table public.notification_prefs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Unique index para suportar upsert ON CONFLICT (user_id)
-- WHERE user_id IS NOT NULL protege linhas legadas sem user_id (de testes)
create unique index if not exists notification_prefs_user_id_key
  on public.notification_prefs (user_id)
  where user_id is not null;

-- Fix RLS: substitui política aberta por política por usuário
drop policy if exists "notification_prefs_open"  on public.notification_prefs;
drop policy if exists "notification_prefs_owner" on public.notification_prefs;

create policy "notification_prefs_owner" on public.notification_prefs
  for all
  using     (auth.uid() = user_id)
  with check(auth.uid() = user_id);
