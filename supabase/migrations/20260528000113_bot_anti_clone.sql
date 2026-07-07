-- Migração 113 — Proteção Anti-Clonagem por bot
-- Quando ativada, os envios do bot (fluxo, remarketing, order bump, upsell)
-- usam protect_content=true no Telegram: bloqueia encaminhar e salvar as mídias.
-- Não afeta mensagens de compra (checkout) nem o QR Code do PIX.

alter table public.bots
  add column if not exists anti_clone boolean not null default false;

comment on column public.bots.anti_clone is 'Proteção anti-clonagem: envia protect_content=true (bloqueia forward/salvar)';
