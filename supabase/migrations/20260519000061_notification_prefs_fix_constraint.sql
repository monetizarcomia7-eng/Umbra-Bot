-- migration 061: corrige notification_prefs — constraint único para upsert
-- O índice PARCIAL (WHERE user_id IS NOT NULL) da migração 060 é incompatível
-- com ON CONFLICT no PostgREST/Supabase. Substitui por CONSTRAINT UNIQUE completo.
-- Seguro rodar mesmo que a migração 060 não tenha sido aplicada (add column if not exists).

-- Garante a coluna user_id (idempotente)
alter table public.notification_prefs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Remove o índice parcial caso tenha sido criado pela migração 060
drop index if exists notification_prefs_user_id_key;

-- Remove o constraint se por acaso já existir com definição errada
alter table public.notification_prefs
  drop constraint if exists notification_prefs_user_id_key;

-- Adiciona CONSTRAINT UNIQUE completo — compatível com ON CONFLICT (user_id) no PostgREST
-- PostgreSQL trata NULL como distinto, então múltiplas linhas sem user_id são permitidas
alter table public.notification_prefs
  add constraint notification_prefs_user_id_key unique (user_id);

-- Fix RLS (idempotente — garante mesmo que 060 não tenha rodado)
drop policy if exists "notification_prefs_open"  on public.notification_prefs;
drop policy if exists "notification_prefs_owner" on public.notification_prefs;

create policy "notification_prefs_owner" on public.notification_prefs
  for all
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);
