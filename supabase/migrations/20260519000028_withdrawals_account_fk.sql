-- ============================================================
-- Umbra Bot — Corrige withdrawals.account_id: TEXT → UUID + FK
--
-- account_id era TEXT sem FK, permitindo valores órfãos.
-- Tornamos nullable (on delete set null preserva histórico de saques
-- mesmo quando a conta bancária é deletada — account_label já guarda
-- o rótulo legível para exibição histórica).
-- ============================================================

-- 1. Remove a constraint NOT NULL para permitir on delete set null
alter table public.withdrawals alter column account_id drop not null;

-- 2. Limpa valores que não sejam UUIDs válidos (registro órfão / legado)
update public.withdrawals
set account_id = null
where account_id is not null
  and account_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 3. Converte coluna para UUID
alter table public.withdrawals
  alter column account_id type uuid using account_id::uuid;

-- 4. Adiciona FK — preserva o saque se a conta for deletada (set null)
alter table public.withdrawals
  add constraint withdrawals_account_id_fk
  foreign key (account_id)
  references public.bank_accounts(id)
  on delete set null;

-- 5. Índice para lookup rápido por conta
create index if not exists withdrawals_account_id_idx
  on public.withdrawals (account_id)
  where account_id is not null;
