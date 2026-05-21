-- Migration 081: melhorias no checkout
-- Adiciona: success_url, guarantee_days, countdown_end

alter table public.checkouts
  add column if not exists success_url    text,
  add column if not exists guarantee_days integer,
  add column if not exists countdown_end  timestamptz;

comment on column public.checkouts.success_url    is 'URL de redirecionamento após confirmação do pagamento PIX';
comment on column public.checkouts.guarantee_days is 'Dias de garantia exibidos no checkout público (null = sem badge)';
comment on column public.checkouts.countdown_end  is 'Timestamp de fim do contador de urgência (null = sem contador)';
