-- ============================================================
-- Umbra Bot — Broadcasts: adiciona bot_id UUID + filters JSONB
--
-- bot_id  → qual bot vai disparar + qual audiência filtrar (contatos do bot)
-- filters → segmentação avançada: registered_after, registered_before
-- ============================================================

alter table public.broadcasts
  add column if not exists bot_id  uuid references public.bots(id) on delete set null,
  add column if not exists filters jsonb not null default '{}';

create index if not exists broadcasts_bot_id_idx on public.broadcasts (bot_id)
  where bot_id is not null;
