-- ============================================================
-- Migration 076: Pixels — schema correto, RLS owner, RPC stats
--
-- Problemas corrigidos:
--   1. PK era 'text' ('meta'|'tiktok'|'google') — colisão entre usuários
--   2. RLS "pixels_open" (using true) — IDOR crítico
--   3. access_token em plain text — agora deve ser criptografado pela app
--   4. Sem UNIQUE(user_id, provider) — múltiplos rows impossíveis por design
--   5. Sem RPC para stats reais de checkout_events
-- ============================================================

-- 1. Backup dos dados existentes (caso haja algum usuário real com pixel configurado)
create table if not exists public.pixels_backup_076 as
  select * from public.pixels;

-- 2. Drop e recriação com schema correto
drop table if exists public.pixels cascade;

create table public.pixels (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  provider     text        not null check (provider in ('meta', 'tiktok', 'google')),
  pixel_id     text,
  access_token text,   -- criptografado AES-256-GCM pelo savePixelAction (enc:<iv>:<tag>:<cipher>)
  status       text    not null default 'inactive'
                         check (status in ('healthy', 'warning', 'error', 'inactive')),
  events       jsonb   not null default '{}',
  capi         boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint   pixels_user_provider_key unique (user_id, provider)
);

-- 3. Índices
create index if not exists pixels_user_id_idx on public.pixels (user_id);
create index if not exists pixels_status_idx  on public.pixels (status);

-- 4. Trigger updated_at
create or replace trigger pixels_updated_at
  before update on public.pixels
  for each row execute function public.set_updated_at();

-- 5. RLS corrigida — apenas o dono lê/escreve seus pixels
alter table public.pixels enable row level security;
drop policy if exists "pixels_open"  on public.pixels;
drop policy if exists "pixels_owner" on public.pixels;
create policy "pixels_owner" on public.pixels
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. Restaurar dados do backup que tinham user_id válido
-- (os ids antigos eram 'meta'|'tiktok'|'google' → viram provider)
insert into public.pixels (user_id, provider, pixel_id, access_token, status, events, capi, created_at, updated_at)
select
  b.user_id,
  b.id as provider,
  b.pixel_id,
  b.access_token,
  b.status,
  b.events,
  b.capi,
  b.created_at,
  b.updated_at
from public.pixels_backup_076 b
where b.user_id is not null
  and b.id in ('meta', 'tiktok', 'google')
on conflict (user_id, provider) do nothing;

-- ============================================================
-- 7. RPC pixels_stats — estatísticas reais de checkout_events
--
-- Retorna para o user_id:
--   events_sent_today  → total de checkout_events nas últimas 24h
--                        (todos os eventos que SERIAM enviados aos pixels)
--   events_matched     → subset que têm contato com email ou telefone
--                        (eventos atribuíveis = "com match")
--   last_event         → timestamp do evento mais recente
--
-- Nota: como checkout_events não tem coluna por pixel/provider,
-- os stats são globais para o usuário (todos os pixels recebem os mesmos eventos).
-- ============================================================

create or replace function public.pixels_stats(p_user_id uuid)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'events_sent_today',
      coalesce(
        (select count(*)::integer
         from public.checkout_events
         where user_id = p_user_id
           and created_at >= now() - interval '24 hours'),
        0
      ),
    'events_matched',
      coalesce(
        (select count(*)::integer
         from public.checkout_events ce
         join public.contacts c on c.id = ce.contact_id
         where ce.user_id = p_user_id
           and ce.created_at >= now() - interval '24 hours'
           and (c.email is not null or c.phone is not null)),
        0
      ),
    'last_event',
      (select max(created_at)
       from public.checkout_events
       where user_id = p_user_id)
  )
$$;

grant execute on function public.pixels_stats(uuid) to authenticated;
