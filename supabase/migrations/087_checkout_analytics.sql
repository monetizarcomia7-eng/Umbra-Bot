-- Migration 087: adiciona customer_device à tabela transactions
-- Detectado no servidor (/api/checkout/pay) a partir do User-Agent do comprador

alter table public.transactions
  add column if not exists customer_device text
    check (customer_device in ('mobile', 'desktop', 'tablet', 'unknown'));

comment on column public.transactions.customer_device is
  'Dispositivo do comprador detectado via User-Agent (mobile/desktop/tablet/unknown)';

-- Índice para análise de conversão por device
create index if not exists transactions_customer_device_idx
  on public.transactions (user_id, customer_device)
  where customer_device is not null;
