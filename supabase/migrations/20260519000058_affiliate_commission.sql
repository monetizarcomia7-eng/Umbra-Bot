-- ============================================================
-- Umbra Bot — affiliate commission (migration 058)
--
-- Vincula transações a afiliados e credita comissão atomicamente
-- quando o pagamento é confirmado pelo webhook do Mercado Pago.
-- ============================================================

-- ── 1. Coluna affiliate_id em transactions ───────────────────

alter table public.transactions
  add column if not exists affiliate_id uuid
    references public.affiliates(id) on delete set null;

create index if not exists transactions_affiliate_id_idx
  on public.transactions(affiliate_id)
  where affiliate_id is not null;

-- ── 2. RPC para creditar venda ao afiliado atomicamente ──────
--
-- security definer → bypassa RLS (necessário pois o webhook MP
-- roda com a anon key, sem sessão de usuário).
-- Incrementa sales + commission em um único UPDATE.

create or replace function public.credit_affiliate_sale(
  p_affiliate_id uuid,
  p_commission   numeric
)
returns void language sql security definer set search_path = public
as $$
  update public.affiliates
  set    sales      = sales + 1,
         commission = commission + p_commission
  where  id = p_affiliate_id;
$$;

grant execute on function public.credit_affiliate_sale to anon, authenticated;
