-- ============================================================
-- Umbra Bot — Tabela: affiliate_payments
-- Rota: /dashboard/affiliates → Pagamentos
-- Depende de: affiliates
-- ============================================================

create table if not exists public.affiliate_payments (
  id              uuid          primary key default gen_random_uuid(),
  affiliate_id    uuid          not null references public.affiliates (id) on delete cascade,
  cycle           text          not null,
  sales           integer       not null default 0,
  amount          numeric(12,2) not null default 0,
  status          text          not null default 'pending'
                    check (status in ('pending', 'paid')),
  paid_at         date,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create index if not exists aff_payments_affiliate_idx on public.affiliate_payments (affiliate_id);
create index if not exists aff_payments_status_idx    on public.affiliate_payments (status);
create index if not exists aff_payments_cycle_idx     on public.affiliate_payments (cycle);

create or replace trigger affiliate_payments_updated_at
  before update on public.affiliate_payments
  for each row execute function public.set_updated_at();

alter table public.affiliate_payments enable row level security;
drop policy if exists "affiliate_payments_open" on public.affiliate_payments;
create policy "affiliate_payments_open" on public.affiliate_payments for all using (true) with check (true);
