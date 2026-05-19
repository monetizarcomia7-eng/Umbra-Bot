-- ============================================================
-- Umbra Bot — Alerts: adiciona tipo 'sale' ao check constraint
--
-- Permite criar alertas automáticos de "nova venda aprovada"
-- no webhook do Mercado Pago.
-- ============================================================

alter table public.alerts
  drop constraint if exists alerts_type_check;

alter table public.alerts
  add constraint alerts_type_check check (type in (
    'gateway_fail', 'bot_banned', 'bot_offline', 'send_quota',
    'webhook_fail', 'payment_pending', 'limit_warning', 'ssl_expiring',
    'sale'
  ));
