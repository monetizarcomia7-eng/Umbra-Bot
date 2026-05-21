-- ============================================================
-- Umbra Bot — Gateways: corrige RLS, adiciona constraint e RPC
-- ============================================================

-- 1. Corrige RLS: era 'using (true)' — qualquer usuário autenticado via
--    Supabase SDK direto podia ler credenciais de todos os outros usuários.
drop policy if exists "gateways_open"  on public.gateways;
drop policy if exists "gateways_owner" on public.gateways;
create policy "gateways_owner" on public.gateways
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. FK account_id → bank_accounts (substituí string frágil por chave real)
alter table public.gateways
  add column if not exists account_id uuid
    references public.bank_accounts(id) on delete set null;

-- 3. UNIQUE constraint (user_id, provider) para upsert seguro
--    Remove duplicatas antes de criar (idempotente: só afeta linhas extras)
delete from public.gateways g1
  using public.gateways g2
  where g1.ctid > g2.ctid
    and g1.user_id  = g2.user_id
    and g1.provider = g2.provider
    and g1.provider is not null
    and g1.user_id  is not null;

alter table public.gateways
  drop constraint if exists gateways_user_provider_key;
alter table public.gateways
  add constraint gateways_user_provider_key unique (user_id, provider);

-- 4. RPC: volume e contagem de transações por provider (últimos 30 dias)
--    Retorna JSON { mercadopago: { volume_30d, tx_30d, avg_fee_pct }, ... }
create or replace function public.gateways_stats(p_user_id uuid)
returns json language sql stable security invoker set search_path = public as $$
  select coalesce(
    (
      select json_object_agg(
        gateway,
        json_build_object(
          'volume_30d',  coalesce(v, 0),
          'tx_30d',      coalesce(n, 0),
          'avg_fee_pct', coalesce(f, 0)
        )
      )
      from (
        select
          gateway,
          sum(amount)                                                as v,
          count(*)                                                   as n,
          round(avg(fee / nullif(amount, 0) * 100)::numeric, 2)     as f
        from public.transactions
        where user_id    = p_user_id
          and status     = 'approved'
          and gateway   is not null
          and created_at >= now() - interval '30 days'
        group by gateway
      ) t
    ),
    '{}'::json
  )
$$;

grant execute on function public.gateways_stats(uuid) to authenticated;
