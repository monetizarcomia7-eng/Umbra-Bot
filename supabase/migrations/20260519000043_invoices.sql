-- ============================================================
-- Umbra Bot — Tabela: invoices (faturas da plataforma)
--
-- Faturas mensais geradas pelo sistema de billing.
-- Enquanto o módulo de billing não existe, a tabela fica vazia
-- e o Financeiro usa dados de demonstração.
-- ============================================================

create table if not exists public.invoices (
  id            uuid          primary key default gen_random_uuid(),
  user_id       uuid          not null references auth.users(id) on delete cascade,
  period        text          not null,           -- ex: 'Maio/2026'
  period_start  date          not null,
  period_end    date          not null,
  value         numeric(10,2) not null default 0,
  due_date      date          not null,
  status        text          not null default 'pending'
                  check (status in ('paid', 'pending', 'overdue')),
  paid_at       timestamptz,
  notes         text,
  created_at    timestamptz   not null default now()
);

create index if not exists invoices_user_id_idx    on public.invoices (user_id);
create index if not exists invoices_status_idx     on public.invoices (status);
create index if not exists invoices_period_start_idx on public.invoices (user_id, period_start desc);

alter table public.invoices enable row level security;

drop policy if exists "invoices_owner" on public.invoices;
create policy "invoices_owner" on public.invoices
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
