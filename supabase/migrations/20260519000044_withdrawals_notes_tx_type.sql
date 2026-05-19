-- ============================================================
-- Umbra Bot — Migration 044
-- 1. withdrawals.notes  — motivo de falha / observação do admin
-- 2. transactions.type  — distingue sale / fee / commission / refund
-- ============================================================

-- 1. Coluna notes em withdrawals
--    Permite que o cron (process-withdrawals) ou um admin registre
--    o motivo pelo qual um saque foi reprovado.
alter table public.withdrawals
  add column if not exists notes text;

-- 2. Coluna type em transactions
--    Permite distinguir vendas de cobranças de taxa, comissões e
--    reembolsos sem depender apenas do campo status.
alter table public.transactions
  add column if not exists type text not null default 'sale'
    check (type in ('sale', 'fee', 'commission', 'refund'));

-- Índice parcial — buscas por tipo != sale (menos frequente)
create index if not exists transactions_type_idx
  on public.transactions (user_id, type)
  where type <> 'sale';
