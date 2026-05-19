-- ============================================================
-- Umbra Bot — activity_events: schema v2
-- 1. Adiciona colunas bot_id e contact_id (relacionais)
-- 2. Corrige CHECK constraint (tipos do banco ≠ tipos do frontend)
-- 3. Índice composto (user_id, created_at DESC) para query principal
-- ============================================================

-- Novas colunas relacionais
alter table public.activity_events
  add column if not exists bot_id     uuid references public.bots(id)     on delete set null,
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

-- Remove o CHECK de tipo antigo pelo nome auto-gerado pelo PostgreSQL.
-- O pg_get_constraintdef retorna sintaxe ANY(ARRAY[...]), por isso
-- o padrão ilike '%type in%' não é confiável. Usamos IF EXISTS pelo nome.
alter table public.activity_events
  drop constraint if exists activity_events_type_check;

-- Novo CHECK alinhado ao frontend (eventTypes map em ActivityClient.tsx)
alter table public.activity_events
  add constraint activity_events_type_check
    check (type in (
      'sale', 'lead', 'payment', 'refund', 'reconnect', 'disconnect',
      'limit', 'newBot', 'webhookFailed', 'flowPublished', 'cancellation', 'failure'
    ));

-- Índice composto principal: filtra por usuário, ordena por data
create index if not exists activity_events_user_created_idx
  on public.activity_events (user_id, created_at desc)
  where user_id is not null;

-- Índice para filtrar por bot_id
create index if not exists activity_events_bot_id_idx
  on public.activity_events (bot_id)
  where bot_id is not null;
