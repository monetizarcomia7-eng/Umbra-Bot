-- ============================================================
-- Umbra Bot — Remarketing: bot_id + campos de execução
-- Migração 067
-- ============================================================

-- Adiciona bot_id FK para vincular campanha a um bot específico
alter table public.remarketing_campaigns
  add column if not exists bot_id uuid references public.bots(id) on delete set null;

-- Campos de rastreamento de execução
alter table public.remarketing_campaigns
  add column if not exists last_run_at  timestamptz,
  add column if not exists total_sent   integer not null default 0;

create index if not exists remarketing_bot_id_idx on public.remarketing_campaigns (bot_id);
