-- ============================================================
-- Umbra Bot — transactions.payment_method
-- Distingue o método de pagamento real (pix, card, boleto, ted)
-- do gateway (mercadopago, stripe…).
-- Default 'pix': retrocompatível com todas as transações existentes.
-- ============================================================

alter table public.transactions
  add column if not exists payment_method text not null default 'pix'
    check (payment_method in ('pix', 'card', 'boleto', 'ted', 'other'));

create index if not exists transactions_payment_method_idx
  on public.transactions (payment_method);
