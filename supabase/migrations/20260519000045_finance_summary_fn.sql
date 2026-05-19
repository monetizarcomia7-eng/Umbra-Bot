-- ============================================================
-- Umbra Bot — Migration 045
-- Função: finance_summary(p_user_id)
--
-- Problema: FinanceDashboard carrega max 500 transactions e
-- computa KPI cards (saldo, a liberar, total recebido, comissões)
-- client-side — valores ficam errados para usuários com >500 txs.
--
-- Solução: RPC que retorna os 4 valores calculados diretamente
-- no banco, usando:
--   • profiles.balance — saldo já mantido atomicamente por triggers
--     (sync_balance_on_transaction + sync_balance_on_withdrawal, mig 029)
--   • SUM() de transactions — sem limite de rows
--
-- A função é STABLE (sem side-effects, cacheável por sessão).
-- ============================================================

create or replace function public.finance_summary(p_user_id uuid)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'saldo_disponivel',
      greatest(0, coalesce(
        (select balance from public.profiles where id = p_user_id),
        0
      )),
    'a_liberar',
      coalesce((
        select sum(coalesce(net, amount - coalesce(fee, 0)))
        from public.transactions
        where user_id = p_user_id
          and status  = 'pending'
      ), 0),
    'total_recebido',
      coalesce((
        select sum(amount)
        from public.transactions
        where user_id = p_user_id
          and status  = 'approved'
      ), 0),
    'comissoes_plataforma',
      coalesce((
        select sum(coalesce(fee, 0))
        from public.transactions
        where user_id = p_user_id
          and status  = 'approved'
      ), 0)
  )
$$;

grant execute
  on function public.finance_summary(uuid)
  to authenticated;
