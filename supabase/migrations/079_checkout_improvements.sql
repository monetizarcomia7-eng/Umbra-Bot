-- ============================================================
-- Umbra Bot — Checkout: checkout_id + customer_phone em
-- transactions; status RPC pública para polling PIX
-- ============================================================

-- ── 1. Adiciona checkout_id em transactions ─────────────────
alter table public.transactions
  add column if not exists checkout_id text references public.checkouts(id) on delete set null;

create index if not exists transactions_checkout_id_idx
  on public.transactions (checkout_id)
  where checkout_id is not null;

-- ── 2. Adiciona customer_phone em transactions ──────────────
alter table public.transactions
  add column if not exists customer_phone text;

-- ── 3. RPC pública para polling de status PIX ───────────────
-- Aceita tx_id + checkout_id para evitar enumeração.
-- Retorna apenas { status } — sem dados sensíveis.
create or replace function public.checkout_tx_status(
  p_tx_id       text,
  p_checkout_id text
)
returns json language sql stable security definer set search_path = public as $$
  select to_json(t.status)
  from public.transactions t
  where t.id = p_tx_id::uuid
    and t.checkout_id = p_checkout_id
  limit 1;
$$;

grant execute on function public.checkout_tx_status to anon, authenticated;

-- ── 4. Atualiza trigger sync_checkout_stats para contar 'paid'
--       a partir do checkout_id na transação aprovada também ──
-- O trigger existente já funciona via checkout_events;
-- esta view materializada não é necessária — a RPC acima é suficiente.
