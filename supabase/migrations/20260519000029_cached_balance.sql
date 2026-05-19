-- ============================================================
-- Umbra Bot — Saldo cacheado em profiles.balance
--
-- Problema: saldo é recalculado em cada request varrendo todas
-- as transações e saques do usuário (O(n) crescente).
--
-- Solução: campo balance em profiles mantido por triggers:
--   balance = Σ net (transactions aprovadas)
--           − Σ amount (withdrawals pending + completed)
--
-- O campo é atualizado atomicamente pelos triggers, eliminando
-- race conditions e seq scans em leitura.
-- ============================================================

-- 1. Adiciona campo balance à tabela profiles
alter table public.profiles
  add column if not exists balance numeric(12, 2) not null default 0;

-- ─── Trigger: transactions ────────────────────────────────────────────────────

create or replace function public.sync_balance_on_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta numeric(12,2) := 0;
  net_val numeric(12,2);
begin
  if tg_op = 'INSERT' then
    if new.status = 'approved' then
      net_val := coalesce(new.net, new.amount - coalesce(new.fee, 0));
      delta   := net_val;
    end if;

  elsif tg_op = 'UPDATE' then
    if old.status = 'approved' and new.status = 'approved' then
      -- valor líquido mudou (ex: correção manual)
      delta := coalesce(new.net, new.amount - coalesce(new.fee, 0))
             - coalesce(old.net, old.amount - coalesce(old.fee, 0));
    elsif old.status != 'approved' and new.status = 'approved' then
      -- aprovada agora
      delta := coalesce(new.net, new.amount - coalesce(new.fee, 0));
    elsif old.status = 'approved' and new.status != 'approved' then
      -- estornada / cancelada
      delta := -(coalesce(old.net, old.amount - coalesce(old.fee, 0)));
    end if;

  elsif tg_op = 'DELETE' then
    if old.status = 'approved' then
      delta := -(coalesce(old.net, old.amount - coalesce(old.fee, 0)));
    end if;
    update public.profiles set balance = balance + delta where id = old.user_id;
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

-- ─── Trigger: withdrawals ─────────────────────────────────────────────────────

create or replace function public.sync_balance_on_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta numeric(12,2) := 0;
begin
  if tg_op = 'INSERT' then
    if new.status in ('pending', 'completed') then
      delta := -new.amount;
    end if;

  elsif tg_op = 'UPDATE' then
    declare
      was_active bool := old.status in ('pending', 'completed');
      now_active bool := new.status in ('pending', 'completed');
    begin
      if was_active and not now_active then
        -- saque falhou → devolve ao saldo
        delta := old.amount;
      elsif not was_active and now_active then
        -- saque reativado → debita do saldo
        delta := -new.amount;
      end if;
    end;

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

-- ─── População inicial ────────────────────────────────────────────────────────
-- Recalcula o saldo correto para todos os usuários com dados existentes.

update public.profiles p
set balance = greatest(0, coalesce((
  select
    coalesce(sum(coalesce(t.net, t.amount - coalesce(t.fee, 0))), 0)
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
