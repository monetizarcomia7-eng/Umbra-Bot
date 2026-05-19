-- ============================================================
-- Umbra Bot — Gateways: adiciona colunas para credenciais por usuário
--
-- O wizard de onboarding insere provider/status/credentials mas esses
-- campos não existiam na tabela original. Também corrige o id para ter
-- default UUID para novas linhas inseridas pelo wizard.
-- ============================================================

-- Adiciona default ao id (garante que insert sem id gera UUID válido)
alter table public.gateways
  alter column id set default gen_random_uuid()::text;

-- Adiciona colunas usadas pelo onboarding e pelo sistema de credenciais
alter table public.gateways
  add column if not exists provider    text,
  add column if not exists status      text not null default 'pending'
                             check (status in ('active', 'pending', 'error', 'disabled')),
  add column if not exists credentials jsonb not null default '{}';

-- Índice por user_id + provider para lookup rápido no getMercadoPagoToken
create index if not exists gateways_user_provider_idx
  on public.gateways (user_id, provider)
  where provider is not null;
