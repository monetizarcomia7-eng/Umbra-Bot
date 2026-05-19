-- ============================================================
-- Umbra Bot — Fix: transactions.net gerada → coluna normal
-- Contexto: migração 021 criou net como GENERATED ALWAYS,
-- impedindo insert manual em pix/route.ts. Esta migração
-- converte para coluna numérica simples preservando os dados.
-- ============================================================

do $$
declare
  v_is_generated text;
begin
  select is_generated
    into v_is_generated
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'transactions'
     and column_name  = 'net';

  if v_is_generated = 'ALWAYS' then
    alter table public.transactions
      drop column net;
    alter table public.transactions
      add column net numeric(12,2);
    -- Recalcula net para os registros existentes
    update public.transactions
       set net = amount - fee
     where net is null;
  end if;
end $$;
