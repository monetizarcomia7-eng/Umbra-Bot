-- ============================================================
-- Umbra Bot — Affiliates notes (migration 055)
--
-- Adiciona coluna notes em affiliates para armazenar
-- a configuração de aprovação (bots + produtos que irá divulgar)
-- ============================================================

alter table public.affiliates
  add column if not exists notes text;
