-- ============================================================
-- Umbra Bot — Gateways: token_expires_at para controle de expiração OAuth
-- ============================================================
-- Tokens do Mercado Pago via OAuth expiram em 180 dias.
-- Esta coluna é preenchida pelo callback OAuth e zerada ao desconectar.
-- Quando NULL → conexão manual (sem expiração definida).

alter table public.gateways
  add column if not exists token_expires_at timestamptz;

comment on column public.gateways.token_expires_at is
  'Data de expiração do access token OAuth (NULL = token manual sem expiração definida).';
