-- ============================================================
-- Umbra Bot — Migração 107: Webhooks do Instagram
-- ============================================================
-- Armazena eventos recebidos do Instagram via webhook
-- (comentários, menções, DMs, story_insights, etc.)
--
-- O endpoint /api/webhooks/instagram persiste cada evento aqui
-- para debug / processamento futuro. Não há RLS owner porque
-- os webhooks chegam por bot/conta global — filtragem por user
-- acontece no app via JOIN com instagram_accounts.ig_user_id.
-- ============================================================

create table if not exists public.instagram_webhook_events (
  id            uuid        primary key default gen_random_uuid(),
  object        text        not null,                              -- 'instagram', 'page', etc.
  entry_id      text,                                              -- ID do objeto (ex: ig_user_id ou page_id)
  field         text,                                              -- 'comments', 'mentions', 'messages', etc.
  payload       jsonb       not null,                              -- evento completo
  received_at   timestamptz not null default now(),
  processed     boolean     not null default false,                -- worker pode marcar como processado
  processed_at  timestamptz,
  error_msg     text
);

create index if not exists ig_webhook_received_idx
  on public.instagram_webhook_events (received_at desc);

create index if not exists ig_webhook_entry_idx
  on public.instagram_webhook_events (entry_id, received_at desc)
  where entry_id is not null;

create index if not exists ig_webhook_unprocessed_idx
  on public.instagram_webhook_events (received_at)
  where processed = false;

alter table public.instagram_webhook_events enable row level security;

-- SELECT: apenas o dono da conta IG associada ao entry_id pode ver
-- (filtragem via JOIN com instagram_accounts)
drop policy if exists "ig_webhook_owner_select" on public.instagram_webhook_events;
create policy "ig_webhook_owner_select" on public.instagram_webhook_events
  for select using (
    exists (
      select 1 from public.instagram_accounts
      where ig_user_id = instagram_webhook_events.entry_id
        and user_id = auth.uid()
    )
  );

-- ─── RPC: cleanup TTL 30d ─────────────────────────────────────────────────
create or replace function public.cleanup_instagram_webhook_events(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.instagram_webhook_events
  where received_at < now() - (p_days || ' days')::interval;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.cleanup_instagram_webhook_events(integer) to authenticated, anon;

comment on table public.instagram_webhook_events is
  'Eventos brutos recebidos do Instagram via webhook. TTL 30d via cron cleanup-instagram-logs.';
