-- ============================================================
-- Umbra Bot — Migração 105: Performance + TTL de telemetria
-- ============================================================
-- Resolve 2 itens da re-auditoria:
--   3.3 — recompute_all_flow_conversions O(N²) → O(1) com JOIN
--   6.2 — cleanup automático de flow_node_events (TTL 30 dias)
-- ============================================================

-- ─── 1. Refactor: recompute_all_flow_conversions em 1 UPDATE ──────────────
-- Antes: 1 SELECT count() por fluxo → N+1 queries
-- Depois: 1 UPDATE com subselect agregado → 1 query
create or replace function public.recompute_all_flow_conversions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  with t as (
    select flow_id, count(*) as cnt
    from public.transactions
    where status = 'approved' and flow_id is not null
    group by flow_id
  )
  update public.flows f
  set conversion = round(
    (coalesce(t.cnt, 0)::numeric / nullif(f.executions, 0)::numeric) * 100,
    2
  )
  from t
  where t.flow_id = f.id
    and f.executions > 0;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

grant execute on function public.recompute_all_flow_conversions() to authenticated, anon;

comment on function public.recompute_all_flow_conversions() is
  'Recalcula conversion% de todos os fluxos em 1 query (JOIN agregado). '
  'Substitui implementação O(N²) da mig 104.';

-- ─── 2. RPC: cleanup de flow_node_events (TTL 30 dias) ────────────────────
create or replace function public.cleanup_flow_node_events(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.flow_node_events
  where created_at < now() - (p_days || ' days')::interval;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.cleanup_flow_node_events(integer) to authenticated, anon;

comment on function public.cleanup_flow_node_events is
  'Apaga eventos de telemetria de fluxos com mais de N dias (default 30). '
  'Chamado pelo cron /api/cron/cleanup-flow-events 1x/dia.';

-- ─── 3. RPC: contagens agregadas para o dashboard analytics por fluxo ────
-- Retorna por nó: entered, sent, failed, completed, abandoned + avg latency
create or replace function public.flow_node_stats_v2(p_flow_id uuid, p_days int default 30)
returns table(
  node_id text,
  node_type text,
  entered bigint,
  sent bigint,
  failed bigint,
  completed bigint,
  abandoned bigint,
  avg_latency_ms numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.node_id,
    max(e.node_type) as node_type,
    count(*) filter (where e.event = 'entered')   as entered,
    count(*) filter (where e.event = 'sent')      as sent,
    count(*) filter (where e.event = 'failed')    as failed,
    count(*) filter (where e.event = 'completed') as completed,
    count(*) filter (where e.event = 'abandoned') as abandoned,
    round(avg(e.latency_ms) filter (where e.latency_ms is not null), 0) as avg_latency_ms
  from public.flow_node_events e
  where e.flow_id = p_flow_id
    and e.created_at >= now() - (p_days || ' days')::interval
    and exists (
      select 1 from public.flows f
      where f.id = p_flow_id and f.user_id = auth.uid()
    )
  group by e.node_id
$$;

grant execute on function public.flow_node_stats_v2(uuid, int) to authenticated;

-- ─── 4. RPC: timeseries diário de eventos (para gráfico) ──────────────────
create or replace function public.flow_events_timeseries(p_flow_id uuid, p_days int default 7)
returns table(
  day date,
  entered bigint,
  sent bigint,
  failed bigint,
  completed bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select generate_series(
      (current_date - (p_days - 1))::date,
      current_date::date,
      '1 day'::interval
    )::date as day
  )
  select
    d.day,
    coalesce(count(*) filter (where e.event = 'entered'),   0) as entered,
    coalesce(count(*) filter (where e.event = 'sent'),      0) as sent,
    coalesce(count(*) filter (where e.event = 'failed'),    0) as failed,
    coalesce(count(*) filter (where e.event = 'completed'), 0) as completed
  from days d
  left join public.flow_node_events e
    on (e.created_at at time zone 'America/Sao_Paulo')::date = d.day
   and e.flow_id = p_flow_id
   and exists (
     select 1 from public.flows f
     where f.id = p_flow_id and f.user_id = auth.uid()
   )
  group by d.day
  order by d.day
$$;

grant execute on function public.flow_events_timeseries(uuid, int) to authenticated;

-- ─── 5. CHECK: limite de tamanho em contacts.flow_vars (7.4) ──────────────
-- Previne payload bomb via question + remarketing tags acumuladas
alter table public.contacts
  drop constraint if exists contacts_flow_vars_size;

alter table public.contacts
  add constraint contacts_flow_vars_size
    check (
      flow_vars is null
      or octet_length(flow_vars::text) <= 65536  -- 64 KB
    );

comment on constraint contacts_flow_vars_size on public.contacts is
  'Limite de 64 KB em flow_vars — previne payload bomb via captures repetidas.';
