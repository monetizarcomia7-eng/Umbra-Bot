-- ============================================================
-- Umbra Bot — Migração 104: Flows schema hardening
-- ============================================================
-- Endurece a tabela flows após a migração 103:
--   1. user_id NOT NULL — bloqueia INSERTs sem owner
--   2. CHECK constraints em nodes/edges — garante shape válido
--   3. Size limit em nodes/edges — evita payload bombs (1 MB cada)
--   4. CHECK em trigger_type/status já estavam presentes
--   5. updated_at trigger garantido
--   6. cron_log entry para o cron recompute-flow-conversion
-- ============================================================

-- ─── 1. Limpar fluxos órfãos (user_id NULL) ──────────────────────────────
-- Antes de aplicar NOT NULL, removemos qualquer linha sem dono.
-- Esses fluxos já eram inacessíveis pela RLS (auth.uid() = user_id falha
-- com user_id NULL) — apenas formaliza a regra no schema.
delete from public.flows where user_id is null;

-- ─── 2. user_id NOT NULL ────────────────────────────────────────────────
alter table public.flows
  alter column user_id set not null;

-- ─── 3. CHECK constraints em nodes/edges JSONB ───────────────────────────
-- nodes/edges devem ser arrays JSONB (não objetos/strings/numbers).
-- Tamanho limitado a 1 MB cada para evitar payloads abusivos.
alter table public.flows
  drop constraint if exists flows_nodes_is_array,
  drop constraint if exists flows_edges_is_array,
  drop constraint if exists flows_nodes_size,
  drop constraint if exists flows_edges_size;

alter table public.flows
  add constraint flows_nodes_is_array
    check (jsonb_typeof(nodes) = 'array'),
  add constraint flows_edges_is_array
    check (jsonb_typeof(edges) = 'array'),
  add constraint flows_nodes_size
    check (octet_length(nodes::text) <= 1048576),  -- 1 MB
  add constraint flows_edges_size
    check (octet_length(edges::text) <= 1048576);  -- 1 MB

comment on constraint flows_nodes_is_array on public.flows is
  'nodes deve ser um JSON array (não objeto/string).';
comment on constraint flows_edges_is_array on public.flows is
  'edges deve ser um JSON array (não objeto/string).';
comment on constraint flows_nodes_size on public.flows is
  'Limite de 1 MB para nodes — evita payload bombs no Supabase Realtime.';
comment on constraint flows_edges_size on public.flows is
  'Limite de 1 MB para edges — evita payload bombs no Supabase Realtime.';

-- ─── 4. Garante trigger updated_at (se já existe, no-op) ─────────────────
do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'flows_updated_at'
  ) then
    create trigger flows_updated_at
      before update on public.flows
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ─── 5. RPC: recompute_all_flow_conversions (chamada pelo cron) ──────────
-- Atualiza conversion% para todos os fluxos que tiveram movimento.
-- Chamada pelo cron /api/cron/recompute-flow-conversion 1x/dia.
create or replace function public.recompute_all_flow_conversions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
  v_row record;
begin
  for v_row in
    select id, executions
    from public.flows
    where executions > 0
  loop
    update public.flows
    set conversion = round((
      (select count(*)::numeric from public.transactions
       where flow_id = v_row.id and status = 'approved')
      / nullif(v_row.executions, 0)::numeric
    ) * 100, 2)
    where id = v_row.id;
    v_updated := v_updated + 1;
  end loop;
  return v_updated;
end;
$$;

grant execute on function public.recompute_all_flow_conversions() to authenticated, anon;

comment on function public.recompute_all_flow_conversions() is
  'Recalcula conversion% de todos os fluxos com executions > 0. '
  'Chamado pelo cron /api/cron/recompute-flow-conversion 1x/dia.';

-- ─── 6. View: fluxos órfãos (debug — não usada pela app) ─────────────────
-- Útil para o admin verificar fluxos com bot_id que aponta para bot deletado
create or replace view public.flows_orphaned as
  select f.id, f.user_id, f.name, f.bot, f.bot_id, f.updated_at
  from public.flows f
  left join public.bots b on b.id = f.bot_id
  where f.bot_id is not null and b.id is null;

comment on view public.flows_orphaned is
  'Debug: fluxos com bot_id apontando para bots já deletados.';
