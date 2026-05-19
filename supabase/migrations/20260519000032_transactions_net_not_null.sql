-- ============================================================
-- Umbra Bot — transactions.net: NOT NULL + trigger de auto-cálculo
--
-- Problema: net pode ser NULL, causando fallback inconsistente
-- (net ?? amount ao invés de net ?? amount - fee).
--
-- Solução:
--   1. Trigger BEFORE INSERT/UPDATE que calcula net quando NULL
--   2. Corrige NULLs existentes
--   3. Adiciona NOT NULL à coluna
-- ============================================================

-- Trigger para auto-calcular net antes do insert/update
create or replace function public.compute_transaction_net()
returns trigger
language plpgsql
as $$
begin
  if new.net is null then
    new.net := new.amount - coalesce(new.fee, 0);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_compute_transaction_net on public.transactions;
create trigger trg_compute_transaction_net
  before insert or update on public.transactions
  for each row execute function public.compute_transaction_net();

-- Corrige valores NULL existentes
update public.transactions
set net = amount - coalesce(fee, 0)
where net is null;

-- Adiciona NOT NULL (seguro após a correção acima e com o trigger ativo)
alter table public.transactions
  alter column net set not null,
  alter column net set default 0;
