-- ============================================================
-- Umbra Bot — withdrawals: campos de auditoria e payout
--
-- requester_ip  : IP de quem solicitou o saque (segurança / fraude)
-- payout_tx_id  : ID externo retornado pela API de transferência
--                 (evita reprocessamento duplo quando cron retomado)
-- processed_by  : quem processou — 'cron' | uuid do admin
-- ============================================================

alter table public.withdrawals
  add column if not exists requester_ip  text,
  add column if not exists payout_tx_id  text,
  add column if not exists processed_by  text;
