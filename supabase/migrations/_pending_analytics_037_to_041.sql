-- ============================================================
-- Umbra Bot — SQL PENDENTE (rodar no Supabase SQL Editor)
-- Migrações 037 a 042 — Analytics + SEGURANÇA flows RLS
--
-- CRÍTICO: migração 040 fecha a vulnerabilidade de privacidade
-- na tabela flows (RLS usando (true) → auth.uid() = user_id).
--
-- Ordem de execução: 037 → 038 → 039 → 040 → 041
-- Todos os comandos são idempotentes (if not exists / or replace).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- MIGRATION 037 — transactions: colunas UTM e flow_id
-- ────────────────────────────────────────────────────────────

alter table public.transactions
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content  text,
  add column if not exists flow_id      uuid references public.flows(id) on delete set null;

create index if not exists transactions_utm_source_idx
  on public.transactions (utm_source)
  where utm_source is not null;

create index if not exists transactions_flow_id_idx
  on public.transactions (flow_id)
  where flow_id is not null;


-- ────────────────────────────────────────────────────────────
-- MIGRATION 038 — Tabela: checkout_events (funil de conversão)
-- ────────────────────────────────────────────────────────────

create table if not exists public.checkout_events (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  bot_id         uuid        references public.bots(id) on delete set null,
  flow_id        uuid        references public.flows(id) on delete set null,
  contact_id     uuid        references public.contacts(id) on delete set null,
  transaction_id uuid        references public.transactions(id) on delete set null,
  event_type     text        not null
                   check (event_type in (
                     'visited',
                     'conversation_started',
                     'cart_added',
                     'payment_initiated',
                     'paid'
                   )),
  product_name   text        not null default '',
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  metadata       jsonb       not null default '{}',
  created_at     timestamptz not null default now()
);

create index if not exists checkout_events_user_id_idx
  on public.checkout_events (user_id);

create index if not exists checkout_events_event_type_idx
  on public.checkout_events (event_type);

create index if not exists checkout_events_created_at_idx
  on public.checkout_events (created_at desc);

create index if not exists checkout_events_bot_id_idx
  on public.checkout_events (bot_id)
  where bot_id is not null;

create index if not exists checkout_events_flow_id_idx
  on public.checkout_events (flow_id)
  where flow_id is not null;

create index if not exists checkout_events_user_event_date_idx
  on public.checkout_events (user_id, event_type, created_at desc);

alter table public.checkout_events enable row level security;

drop policy if exists "checkout_events_owner" on public.checkout_events;
create policy "checkout_events_owner" on public.checkout_events
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- MIGRATION 039 — Função: analytics_cohort_weekly
-- ────────────────────────────────────────────────────────────

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
security invoker
set search_path = public
as $$
declare
  v_now_week date := date_trunc('week', now())::date;
begin
  return query
  with
  approved as (
    select
      coalesce(customer_telegram_id, customer_email) as cid,
      date_trunc('week', created_at)::date            as pw
    from public.transactions
    where user_id = p_user_id
      and status  = 'approved'
      and (customer_telegram_id is not null or customer_email is not null)
  ),
  first_week as (
    select cid, min(pw) as cohort_week
    from approved
    group by cid
  ),
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
  all_purchase_weeks as (
    select distinct cid, pw
    from approved
  ),
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

grant execute
  on function public.analytics_cohort_weekly(uuid, int, int)
  to authenticated;


-- ────────────────────────────────────────────────────────────
-- MIGRATION 040 — SEGURANÇA: flows RLS (CRÍTICO)
--
-- Problema: flows criada com using (true) — qualquer usuário
-- autenticado podia ler fluxos de outros via Supabase direto.
-- Fix: adiciona user_id + policy restrita por auth.uid().
-- ────────────────────────────────────────────────────────────

alter table public.flows
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists flows_user_id_idx
  on public.flows (user_id);

drop policy if exists "flows_open"  on public.flows;
drop policy if exists "flows_owner" on public.flows;

create policy "flows_owner" on public.flows
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────
-- MIGRATION 041 — Função: track_checkout_event (security definer)
--
-- Permite que páginas de checkout públicas (sem sessão) registrem
-- o evento 'visited' no funil sem expor user_id ao caller.
-- ────────────────────────────────────────────────────────────

create or replace function public.track_checkout_event(
  p_bot_id       uuid,
  p_event_type   text,
  p_product_name text default '',
  p_flow_id      uuid default null,
  p_utm_source   text default null,
  p_utm_medium   text default null,
  p_utm_campaign text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if p_event_type not in ('visited', 'cart_added', 'payment_initiated') then
    raise exception 'event_type não permitido via tracking público: %', p_event_type;
  end if;

  select user_id into v_user_id
  from public.bots
  where id = p_bot_id;

  if v_user_id is null then
    return;
  end if;

  insert into public.checkout_events (
    user_id,
    bot_id,
    flow_id,
    event_type,
    product_name,
    utm_source,
    utm_medium,
    utm_campaign
  ) values (
    v_user_id,
    p_bot_id,
    p_flow_id,
    p_event_type,
    coalesce(p_product_name, ''),
    p_utm_source,
    p_utm_medium,
    p_utm_campaign
  );
end;
$$;

grant execute
  on function public.track_checkout_event(uuid, text, text, uuid, text, text, text)
  to anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- MIGRATION 042 — Função: analytics_filter_options
-- Performance: SELECT DISTINCT no banco substitui 2 queries de
-- 500 linhas + dedup em JavaScript nos dropdowns de filtro.
-- ────────────────────────────────────────────────────────────

create or replace function public.analytics_filter_options(p_user_id uuid)
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select json_build_object(
    'products', (
      select coalesce(json_agg(p order by p), '[]'::json)
      from (
        select distinct product_name as p
        from public.transactions
        where user_id = p_user_id
          and product_name is not null
          and product_name <> ''
      ) _
    ),
    'utm_sources', (
      select coalesce(json_agg(u order by u), '[]'::json)
      from (
        select distinct utm_source as u
        from public.transactions
        where user_id = p_user_id
          and utm_source is not null
      ) _
    )
  )
$$;

grant execute
  on function public.analytics_filter_options(uuid)
  to authenticated;
