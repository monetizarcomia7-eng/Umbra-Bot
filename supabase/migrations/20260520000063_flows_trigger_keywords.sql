-- ============================================================
-- Umbra Bot — Migração 063: trigger_type e keywords nos fluxos
-- Permite configurar palavras-chave que ativam o fluxo além do /start
-- ============================================================

alter table public.flows
  add column if not exists trigger_type text not null default 'start'
    check (trigger_type in ('start', 'keyword')),
  add column if not exists keywords text[] not null default '{}';

create index if not exists flows_trigger_type_idx on public.flows (trigger_type);

comment on column public.flows.trigger_type is 'Tipo de gatilho: start (comando /start) ou keyword (palavras-chave)';
comment on column public.flows.keywords     is 'Lista de palavras-chave que ativam este fluxo (trigger_type=keyword)';
