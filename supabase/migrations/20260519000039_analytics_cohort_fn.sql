-- ============================================================
-- Umbra Bot — Função: analytics_cohort_weekly
--
-- Resolve P4 (auditoria): coorte O(n²) no JavaScript → SQL eficiente.
-- Calcula retenção semanal S0–S5 diretamente no banco, sem transferir
-- registros brutos para Node.js.
--
-- Parâmetros:
--   p_user_id  uuid  — usuário autenticado
--   p_cohorts  int   — quantas coortes retornar (default 6)
--   p_weeks    int   — semanas de offset (default 6, ou seja S0–S5)
--
-- Retorna uma linha por (cohort_week, week_index):
--   cohort_date   date    — segunda-feira da semana da coorte
--   cohort_label  text    — label formatado ex: "12 Jan"
--   cohort_size   bigint  — qtd de clientes na coorte
--   week_index    int     — 0 = semana da primeira compra, 1-5 = semanas seguintes
--   retention_pct int     — % de retorno; NULL = semana ainda não ocorreu
-- ============================================================

create or replace function public.analytics_cohort_weekly(
  p_user_id uuid,
  p_cohorts int default 6,
  p_weeks   int default 6
)
returns table (
  cohort_date   date,
  cohort_label  text,
  cohort_size   bigint,
  week_index    int,
  retention_pct int
)
language plpgsql
stable
security invoker   -- respeita RLS do caller
set search_path = public
as $$
declare
  v_now_week date := date_trunc('week', now())::date;
begin
  return query
  with
  -- Todas as transações aprovadas com identificador de cliente
  approved as (
    select
      coalesce(customer_telegram_id, customer_email) as cid,
      date_trunc('week', created_at)::date            as pw
    from public.transactions
    where user_id = p_user_id
      and status  = 'approved'
      and (customer_telegram_id is not null or customer_email is not null)
  ),
  -- Primeira semana de compra por cliente
  first_week as (
    select cid, min(pw) as cohort_week
    from approved
    group by cid
  ),
  -- Tamanho de cada coorte — limita às p_cohorts mais recentes
  cohort_sizes as (
    select
      cohort_week,
      count(*)           as cohort_size,
      array_agg(cid)     as member_cids
    from first_week
    group by cohort_week
    order by cohort_week desc
    limit p_cohorts
  ),
  -- Todos os (cliente, semana) distintos com compra
  all_purchase_weeks as (
    select distinct cid, pw
    from approved
  ),
  -- Produto cartesiano: cada coorte × cada offset 0..p_weeks-1
  cohort_week_offsets as (
    select
      cs.cohort_week,
      cs.cohort_size,
      cs.member_cids,
      o.wi,
      (cs.cohort_week + (o.wi || ' weeks')::interval)::date as target_week
    from cohort_sizes cs
    cross join generate_series(0, p_weeks - 1) as o(wi)
  )
  select
    cwo.cohort_week                               as cohort_date,
    to_char(cwo.cohort_week, 'DD Mon')            as cohort_label,
    cwo.cohort_size,
    cwo.wi                                        as week_index,
    case
      when cwo.wi = 0 then 100
      when cwo.target_week > v_now_week then null
      else round(
        count(distinct apw.cid)::numeric
        / nullif(cwo.cohort_size, 0) * 100
      )::int
    end                                           as retention_pct
  from cohort_week_offsets cwo
  left join all_purchase_weeks apw
    on apw.pw  = cwo.target_week
   and apw.cid = any(cwo.member_cids)
  group by
    cwo.cohort_week,
    cwo.cohort_size,
    cwo.wi,
    cwo.target_week
  order by cwo.cohort_week asc, cwo.wi asc;
end;
$$;

-- Permite que usuários autenticados chamem a função
grant execute
  on function public.analytics_cohort_weekly(uuid, int, int)
  to authenticated;
