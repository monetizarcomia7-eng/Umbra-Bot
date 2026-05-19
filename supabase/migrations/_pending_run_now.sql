-- ============================================================
-- Umbra Bot — SQL PENDENTE (rodar no Supabase SQL Editor)
-- Migrações 025, 027, 028, 029 ainda não aplicadas.
-- Migração 032 ignorada: transactions.net já é GENERATED ALWAYS.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- MIGRATION 025 — Tabela withdrawals
-- ────────────────────────────────────────────────────────────

create table if not exists public.withdrawals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  amount          numeric(12, 2) not null check (amount > 0),
  account_id      text not null,
  account_label   text not null,
  status          text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at      timestamptz not null default now(),
  concluded_at    timestamptz
);

alter table public.withdrawals enable row level security;

create policy "users can view own withdrawals"
  on public.withdrawals for select
  using (auth.uid() = user_id);

create policy "users can insert own withdrawals"
  on public.withdrawals for insert
  with check (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- MIGRATION 027 — Índice composto em transactions
-- ────────────────────────────────────────────────────────────

create index if not exists transactions_user_status_created_idx
  on public.transactions (user_id, status, created_at desc);

-- ────────────────────────────────────────────────────────────
-- MIGRATION 028 — withdrawals.account_id: TEXT → UUID + FK
-- ────────────────────────────────────────────────────────────

-- 1. Permite null temporariamente (necessário para on delete set null)
alter table public.withdrawals alter column account_id drop not null;

-- 2. Limpa valores não-UUID (só existirão em dados legados)
update public.withdrawals
set account_id = null
where account_id is not null
  and account_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 3. Converte para UUID
alter table public.withdrawals
  alter column account_id type uuid using account_id::uuid;

-- 4. FK (on delete set null → preserva histórico se conta for deletada)
alter table public.withdrawals
  add constraint withdrawals_account_id_fk
  foreign key (account_id)
  references public.bank_accounts(id)
  on delete set null;

-- 5. Índice para lookup por conta
create index if not exists withdrawals_account_id_idx
  on public.withdrawals (account_id)
  where account_id is not null;

-- ────────────────────────────────────────────────────────────
-- MIGRATION 029 — profiles.balance cacheado + triggers
-- ────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists balance numeric(12, 2) not null default 0;

-- Trigger em transactions
create or replace function public.sync_balance_on_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta numeric(12,2) := 0;
begin
  if tg_op = 'INSERT' then
    if new.status = 'approved' then
      delta := coalesce(new.net, new.amount - coalesce(new.fee, 0));
    end if;

  elsif tg_op = 'UPDATE' then
    if old.status = 'approved' and new.status = 'approved' then
      delta := coalesce(new.net, new.amount - coalesce(new.fee, 0))
             - coalesce(old.net, old.amount - coalesce(old.fee, 0));
    elsif old.status != 'approved' and new.status = 'approved' then
      delta := coalesce(new.net, new.amount - coalesce(new.fee, 0));
    elsif old.status = 'approved' and new.status != 'approved' then
      delta := -(coalesce(old.net, old.amount - coalesce(old.fee, 0)));
    end if;

  elsif tg_op = 'DELETE' then
    if old.status = 'approved' then
      update public.profiles
        set balance = balance - coalesce(old.net, old.amount - coalesce(old.fee, 0))
        where id = old.user_id;
    end if;
    return old;
  end if;

  if delta <> 0 then
    update public.profiles set balance = balance + delta where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_balance_transaction on public.transactions;
create trigger trg_sync_balance_transaction
  after insert or update or delete on public.transactions
  for each row execute function public.sync_balance_on_transaction();

-- Trigger em withdrawals
create or replace function public.sync_balance_on_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta numeric(12,2) := 0;
  was_active bool;
  now_active bool;
begin
  if tg_op = 'INSERT' then
    if new.status in ('pending', 'completed') then
      delta := -new.amount;
    end if;

  elsif tg_op = 'UPDATE' then
    was_active := old.status in ('pending', 'completed');
    now_active := new.status in ('pending', 'completed');
    if was_active and not now_active then
      delta := old.amount;   -- saque falhou → devolve
    elsif not was_active and now_active then
      delta := -new.amount;  -- saque reativado → debita
    end if;

  elsif tg_op = 'DELETE' then
    if old.status in ('pending', 'completed') then
      update public.profiles set balance = balance + old.amount where id = old.user_id;
    end if;
    return old;
  end if;

  if delta <> 0 then
    update public.profiles set balance = balance + delta where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_balance_withdrawal on public.withdrawals;
create trigger trg_sync_balance_withdrawal
  after insert or update or delete on public.withdrawals
  for each row execute function public.sync_balance_on_withdrawal();

-- Calcula saldo inicial para usuários com transações existentes
update public.profiles p
set balance = greatest(0, coalesce((
  select
    coalesce(sum(t.net), 0)
    - coalesce((
        select sum(w.amount)
        from public.withdrawals w
        where w.user_id = t.user_id
          and w.status in ('pending', 'completed')
      ), 0)
  from public.transactions t
  where t.user_id = p.id
    and t.status = 'approved'
  group by t.user_id
), 0));
