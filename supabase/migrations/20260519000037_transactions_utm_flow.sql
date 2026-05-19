-- ============================================================
-- Umbra Bot — Transactions: colunas UTM e flow_id
--
-- Necessário para:
--   - Card "Vendas por origem (UTM)" na aba Análises
--   - Filtro "Todos os fluxos" na aba Análises
--   - Rastrear origem do tráfego de cada transação aprovada
-- Popular via: rota PIX (utm nos query params), webhook Telegram
-- ============================================================

alter table public.transactions
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content  text,
  add column if not exists flow_id      uuid references public.flows(id) on delete set null;

create index if not exists transactions_utm_source_idx
  on public.transactions (utm_source)
  where utm_source is not null;

create index if not exists transactions_flow_id_idx
  on public.transactions (flow_id)
  where flow_id is not null;
